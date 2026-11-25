import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import server


class PythonStudioTests(unittest.TestCase):
    def test_provider_sees_exact_png_and_same_prompt_for_each_variant(self):
        scene = server.generate('quantities', 'recolor', 82041, 'standard')
        keys = [v['key'] for v in scene['variants']]
        self.assertEqual(keys[0], keys[1])
        self.assertNotEqual(keys[0], keys[2])
        with patch.dict('os.environ', VTF_MODEL='protocol-test'), patch.object(server, 'model_answer', side_effect=[keys[0]] * 3) as predict:
            result = server.evaluate(scene, 'openai', lambda: True)
        self.assertEqual([c.args for c in predict.call_args_list], [
            (v['image'], scene['question'], scene['choices']) for v in scene['variants']
        ])
        self.assertEqual(result['stats'], dict(total=3, correct=2, pairs=1, style=1, change=0))
        self.assertEqual(result['item']['fingerprint'], scene['fingerprint'])

    def test_replays_and_validates_task_ids(self):
        args = ('charts', 'highest', 0, 'close')
        preview, baseline = server.generate(*args), server.generate(*args, baseline=True)
        self.assertEqual(preview['fingerprint'], baseline['fingerprint'])
        result = server.evaluate(baseline, 'local', lambda: True)
        self.assertTrue(all(v['pngVerified'] for v in result['item']['evidence']))
        with self.assertRaises(ValueError):
            server.spec_for({'family': 'charts', 'task': 'recolor'}, server.render('catalog'))


if __name__ == '__main__':
    unittest.main()
