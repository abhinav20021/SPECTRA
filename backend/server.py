"""Run the Evaluation Studio and its Python API on one origin."""
import argparse
import hashlib
import json
import os
import re
import secrets
import select
import socket
import subprocess
import time
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import BoundedSemaphore
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
SLOTS = BoundedSemaphore(4)


class ServiceError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def render(action, **spec):
    p = subprocess.run(['node', str(ROOT / 'backend/render.cjs')], input=json.dumps(dict(action=action, **spec)),
                       text=True, capture_output=True, timeout=60, cwd=ROOT)
    if p.returncode:
        raise RuntimeError(p.stderr.strip() or 'Renderer failed')
    return json.loads(p.stdout)


@lru_cache(maxsize=24)
def generate(family, task, seed, difficulty, baseline=False):
    scene = render('baseline' if baseline else 'generate', family=family, task=task, seed=seed, difficulty=difficulty)
    variants = scene['variants']
    first, restyled, changed = [v['key'] for v in variants]
    if first != restyled or changed == first:
        raise RuntimeError('The three scenario answers disagree with the task definition.')
    digest = hashlib.sha256(scene['question'].encode())
    for v in variants:
        digest.update(v['image'].encode('ascii'))
    scene['fingerprint'] = digest.hexdigest()
    return scene


def spec_for(data, catalog):
    family, task, seed = (data.get(k) for k in ('family', 'task', 'seed'))
    difficulty = data.get('difficulty', 'standard')
    if not isinstance(family, str) or not isinstance(task, str) or task not in catalog.get(family, {}):
        raise ValueError('Choose a task from GET /api/tasks.')
    if seed is None:
        seed = secrets.randbits(32)
    if type(seed) is not int or not 0 <= seed <= 0xffffffff or difficulty not in ('standard', 'close'):
        raise ValueError('Expected a uint32 seed and standard or close difficulty.')
    return family, task, seed, difficulty


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def model_answer(image, question, choices):
    base = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1').rstrip('/')
    name, token = os.getenv('VTF_MODEL'), os.getenv('OPENAI_API_KEY')
    if not name:
        raise ServiceError(503, 'Set VTF_MODEL to enable live model inference.')
    url = urlsplit(base)
    local_http = url.scheme == 'http' and url.hostname in ('127.0.0.1', 'localhost', '::1')
    if not url.hostname or url.username or url.password or url.query or url.fragment or (url.scheme != 'https' and not local_http):
        raise ServiceError(503, 'Configure a valid HTTPS or local inference base URL.')
    if url.hostname == 'api.openai.com' and not token:
        raise ServiceError(503, 'Set OPENAI_API_KEY for the configured provider.')
    suffix = ' Reply only with one allowed answer: ' + ' / '.join(choices) + '.' if choices else ' Reply with one whole number in digits.'
    content = [{'type': 'image_url', 'image_url': {'url': image}}, {'type': 'text', 'text': question + suffix}]
    body = json.dumps({'model': name, 'messages': [{'role': 'user', 'content': content}]}).encode()
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = Request(base + '/chat/completions', body, headers)
    try:
        with build_opener(NoRedirect()).open(req, timeout=120) as response:
            raw = json.load(response)['choices'][0]['message']['content']
        if not isinstance(raw, str) or not raw.strip():
            raise ValueError('Empty response')
        return raw
    except HTTPError as err:
        raise ServiceError(502, f'Model endpoint returned HTTP {err.code}.') from err
    except (KeyError, IndexError, TypeError, ValueError, OSError, URLError) as err:
        raise ServiceError(502, 'The model endpoint failed to return a text prediction.') from err


def normalize(raw, choices, family):
    token = raw.strip().lstrip('"\'*` ').rstrip('"\'*`.! ').strip().lower()
    if choices:
        def canonical(value):
            return re.sub(r'[\s,>→]+', ' ', value.lower()).strip() if family not in ('spatial', 'charts') else value.lower()
        return next((c for c in choices if canonical(c) == canonical(token)), None)
    digits = r'[0-9]{1,3}' if family == 'counting' else r'[0-9]{1,4}'
    return str(int(token)) if re.fullmatch(digits, token) else None


def evaluate(scene, evaluator, connected):
    answers, hits = [], []
    for v in scene['variants']:
        if not connected():
            raise ConnectionAbortedError()
        start = time.monotonic()
        raw = v['baseline'] if evaluator == 'local' else model_answer(v['image'], scene['question'], scene['choices'])
        answer = normalize(raw, scene['choices'], scene['family'])
        latency_ms = v['latencyMs'] if evaluator == 'local' else round(1000 * (time.monotonic() - start))
        answers.append({'raw': raw, 'answer': answer, 'latencyMs': latency_ms})
        hits.append(answer == v['key'])
    item = {k: scene[k] for k in ('family', 'seed', 'question', 'fingerprint')}
    item.update(type=scene['task'], answers=answers, keys=[v['key'] for v in scene['variants']],
                images=[v['image'] for v in scene['variants']], evidence=[v['evidence'] for v in scene['variants']])
    return {'model': 'Local image baseline' if evaluator == 'local' else os.environ['VTF_MODEL'], 'item': item,
            'stats': {'correct': sum(hits), 'total': 3, 'pairs': 1, 'style': int(hits[0] and hits[1]), 'change': int(hits[0] and hits[2])}}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def send_data(self, data, kind='application/json', status=200):
        body = json.dumps(data).encode() if kind == 'application/json' else data
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/tasks':
            return self.send_data(self.server.catalog)
        if path in ('/', '/index.html', '/studio.html'):
            file = 'index.html' if path == '/' else path[1:]
            html = (DIST / file).read_bytes().replace(b'<head>', b'<head><meta name="vtf-runtime" content="python">', 1)
            return self.send_data(html, 'text/html; charset=utf-8')
        return super().do_GET()

    def connected(self):
        readable, _, _ = select.select([self.connection], [], [], 0)
        return not readable or bool(self.connection.recv(1, socket.MSG_PEEK))

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in ('/api/challenge', '/api/evaluate'):
            return self.send_data({'error': 'Unknown endpoint.'}, status=404)
        origin = self.headers.get('Origin')
        if origin and urlsplit(origin).netloc != self.headers.get('Host'):
            return self.send_data({'error': 'Requests must come from the same Studio origin.'}, status=403)
        if self.headers.get_content_type() != 'application/json':
            return self.send_data({'error': 'Expected application/json.'}, status=415)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                raise ServiceError(413, 'Invalid request size.')
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('Expected a JSON object.')
            spec = spec_for(data, self.server.catalog)
            with SLOTS:
                if path == '/api/challenge':
                    result = generate(*spec)
                else:
                    evaluator = data.get('evaluator', 'local')
                    if evaluator not in ('local', 'openai'):
                        raise ValueError('Unknown evaluator.')
                    scene = generate(*spec, baseline=evaluator == 'local')
                    if data.get('fingerprint') != scene['fingerprint']:
                        raise ServiceError(409, 'Generate this challenge first and use its fingerprint.')
                    result = evaluate(scene, evaluator, self.connected)
            self.send_data(result)
        except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
            return
        except (ValueError, ServiceError) as err:
            self.send_data({'error': str(err)}, status=getattr(err, 'status', 400))
        except (OSError, RuntimeError, subprocess.SubprocessError) as err:
            self.log_error('%s', err)
            self.send_data({'error': 'Challenge generation or verification failed.'}, status=500)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.catalog = render('catalog')
    print(f'Python Evaluation Studio at http://127.0.0.1:{server.server_port}/studio.html', flush=True)
    server.serve_forever()
