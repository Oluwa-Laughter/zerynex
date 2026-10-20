"""Keep copyable third-party integrations, fixtures and CI pins release-safe."""
from __future__ import annotations

import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
STARTER = ROOT / 'examples/consumer-integration'


class ConsumerStarterTests(unittest.TestCase):
    def test_all_public_metadata_vectors_match_reviewed_python_and_typescript_cases(self):
        for name in ('isolated', 'risky', 'regression-expanded'):
            with self.subTest(name=name):
                expected = ROOT / 'tests/fixtures/swap-refund' / (name + '.json')
                source = STARTER / 'fixtures' / (name + '.json')
                self.assertEqual(source.read_bytes(), expected.read_bytes())
                self.assertEqual(json.loads(source.read_text())['schema_version'], 1)

    def test_example_versions_match_publishable_distributions(self):
        npm = json.loads((ROOT / 'packages/sdk/package.json').read_text())
        consumer = json.loads((STARTER / 'node/package.json').read_text())
        py = (ROOT / 'packages/python/pyproject.toml').read_text()
        requirements = (STARTER / 'python/requirements.txt').read_text()
        self.assertEqual(consumer['dependencies'], {'@zerynex/sdk': npm['version']})
        self.assertIn('version = "' + npm['version'] + '"', py)
        self.assertIn('zerynex-python==' + npm['version'], requirements)

    def test_ci_example_pins_reviewed_full_source_commit(self):
        workflow = (STARTER / '.github/workflows/privacy-check.yml').read_text()
        refs = re.findall(r'uses:\s+Oluwa-Laughter/zerynex@([^\s]+)', workflow)
        self.assertEqual(len(refs), 1)
        self.assertRegex(refs[0], r'^[a-f0-9]{40}$')
        self.assertNotIn('Oluwa-Laughter/zerynex@main', workflow)
        self.assertIn("fail-on-findings: 'true'", workflow)
        self.assertNotIn('secrets.', workflow)
        self.assertIn('tests/fixtures/clean-v6.bin', workflow)

    def test_starters_use_offline_unprivileged_apis_only(self):
        node = (STARTER / 'node/check.mjs').read_text()
        python = (STARTER / 'python/check.py').read_text()
        for forbidden in ('fetch(', 'requests.get', 'mnemonic', 'process.env.SECRET', 'wallet.connect'):
            self.assertNotIn(forbidden, node + python)
        self.assertIn("from '@zerynex/sdk'", node)
        self.assertIn('compare_manifests', python)
        self.assertIn('refundSarifReport', node)
        self.assertIn('sarif_report', python)


if __name__ == '__main__':
    unittest.main()
