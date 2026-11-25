"""Package the static studio and its single-file offline edition."""
from base64 import b64decode, b64encode
from pathlib import Path
import json
import re
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
# The overview uses the published report and the exact source and PNG from the recorded live case.
records = dist / "downloads/studio"
report = json.loads((records / "qwen-report.json").read_text())
rows = report["results"]
responses = [row for row in rows if row["status"] == "response"]
case_run = json.loads((records / "live-question-swap.json").read_text())
case = case_run["case"]
swapped = next(a for a in case_run["attempts"] if a["probe"] == "swap")
boards = case["source"]["scene"]
changed = sum(a != b for row_a, row_b in zip(boards["a"], boards["b"]) for a, b in zip(row_a, row_b))
assert str(changed) == case["questions"]["swap"]["pixelAnswer"] == case["questions"]["swap"]["reference"]
snapshot = {
    "published": {
        "images": len({row["image"] for row in rows}),
        "questions": len({row["group"] for row in rows}),
        "responses": len(responses),
        "correct": sum(row["correct"] for row in responses),
        "model": report["adapter"]["model"]
    },
    "case": {"boards": boards, "bay": case["source"]["query"]["bay"],
             "verified": changed, "modelAnswer": swapped["raw"]}
}
(dist / "home-data.js").write_text("window.FactorySnapshot = " + json.dumps(snapshot, separators=(",", ":")) + ";\n")
examples = dist / "examples"
examples.mkdir(exist_ok=True)
(examples / "warehouse.png").write_bytes(b64decode(case["image"].split(",", 1)[1]))
with ZipFile(records / "pilot-dataset.zip") as pilot:
    for task in ("chartmatch", "wallpaper", "columns"):
        row = next(row for row in rows if row["index"] == 0 and row["questionType"] == task)
        (examples / (task + ".png")).write_bytes(pilot.read("public/" + row["image"]))

html = (dist / "studio.html").read_text()
font = b64encode((dist / "fonts/inter-latin.woff2").read_bytes()).decode()
style = (dist / "style.css").read_text().replace("fonts/inter-latin.woff2", "data:font/woff2;base64," + font)
def inline_page(page):
    page = page.replace('<link rel="stylesheet" href="style.css">', '<style>' + style + '</style>')
    for name in re.findall(r'<link rel="stylesheet" href="([\w.-]+\.css)">', page):
        page = page.replace(f'<link rel="stylesheet" href="{name}">', '<style>' + (dist / name).read_text() + '</style>')
    scripts = re.findall(r'<script defer src="([\w.-]+\.js)"></script>', page)
    page = re.sub(r'<script defer src="[\w.-]+\.js"></script>', '', page)
    bundled = "\n".join('<script>' + (dist / name).read_text() + '</script>' for name in scripts)
    return page.replace('</body>', bundled + '\n</body>')


# Keep the judge's Live Demo reachable when only the single-file edition is available.
html = html.replace('href="live.html">Live Demo</a>', 'href="#live">Live Demo</a>').replace('<a data-online-only class="nav" style="text-decoration:none" href="#live">', '<a class="nav" style="text-decoration:none" href="#live">')
html = re.sub(r'<a data-online-only[^>]*>[^<]*</a>', '', html)
html = re.sub(r'<a class="offlinedl"[^>]*>[^<]*</a>', '', html)
html = inline_page(html.replace('class="brand" href="index.html"','class="brand" href="#studio"'))
live_page = (dist / "live.html").read_text()
live_page = live_page.replace('class="brand" href="index.html"', 'class="brand" href="studio.html"')
live_page = live_page.replace('href="studio.html"', 'href="#studio" target="_parent"').replace('href="live.html"', 'href="#live" target="_parent"')
live_page = re.sub(r'<a[^>]*href="framework.html"[^>]*>Framework</a>', '', live_page)
live_json = json.dumps(inline_page(live_page)).replace('<', r'\u003c')
router = """<script>
(() => {
  let frame;
  function route() {
    if(location.hash==='#live') {
      if(!frame) {
        frame=document.createElement('iframe');
        frame.title='Live Demo';
        frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;background:white;z-index:200';
        frame.srcdoc=LIVE_DOCUMENT;
        document.body.append(frame);
      }
      frame.hidden=false;
      document.body.style.overflow='hidden';
      frame.focus();
    } else if(frame) {
      frame.hidden=true;
      document.body.style.overflow='';
    }
  }
  window.addEventListener('hashchange',route);
  route();
})();
</script>""".replace('LIVE_DOCUMENT', live_json)
html = html.replace('</body>', router + '\n</body>')
license_text = (dist / "fonts/LICENSE.txt").read_text()
html = html.replace("</html>", "<!-- Bundled font license\n" + license_text + "\n-->\n</html>")
(dist / "visual-task-factory.html").write_text(html)

archive = dist / "visual-task-factory-source.zip"
sources = [root / name for name in ("README.md", "package.json", "package-lock.json", ".gitignore")]
for directory in ("backend", "framework", "adapters", "suites", "scripts", "tests", ".github/workflows"):
    sources.extend(sorted((root / directory).rglob("*")))
with ZipFile(archive, "w", ZIP_DEFLATED) as z:
    for p in [*sorted(dist.rglob("*")), *sources]:
        if p.is_file() and p != archive and "__pycache__" not in p.parts:
            z.write(p, p.relative_to(root))

