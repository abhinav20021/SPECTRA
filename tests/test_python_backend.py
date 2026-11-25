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


    def test_live_case_rejects_seeds_and_reuses_its_exact_image_for_both_prompts(self):
        config = dict(family='quantities', task='recolor', difficulty='standard')
        catalog = server.render('catalog')
        with self.assertRaises(ValueError):
            server.new_live_case(dict(config, seed=0), catalog)
        case = server.new_live_case(config, catalog)
        self.assertNotIn('seed', case)
        with patch.dict('os.environ', VTF_MODEL='protocol-test'), patch.object(server, 'model_answer', return_value='invalid') as predict:
            for key in ('direct', 'swap'):
                result = server.evaluate_live(dict(id=case['id'], probe=key, evaluator='openai'))
                self.assertFalse(result['correct'])
                probe = case['questions'][key]
                predict.assert_called_with(case['image'], probe['text'], probe['choices'])
        with self.assertRaises(server.ServiceError):
            server.evaluate_live(dict(id='missing', probe='direct', evaluator='local'))


if __name__ == '__main__':
    unittest.main()
