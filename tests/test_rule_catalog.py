"""Public registry snapshots and canonical CLI declaration conformance."""
from pathlib import Path
import json
import re
import subprocess
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]

class PublicRegistryConformance(unittest.TestCase):
    def test_canonical_registry_is_deterministic_and_all_sdk_snapshots_match(self):
        output=subprocess.run([sys.executable,str(ROOT/'scripts/sync-rule-catalog.py'),'--check'],
                              capture_output=True,text=True,timeout=15)
        self.assertEqual(output.returncode,0,output.stderr)
        canonical=json.loads((ROOT/'rules/catalog.json').read_text())
        python=json.loads((ROOT/'packages/python/src/zerynex_py/fixtures/rule-catalog.json').read_text())
        self.assertEqual(canonical,python)
        self.assertEqual(len(canonical['rules']),8)
        self.assertEqual(canonical['rules'][0]['id'],'PCZT-DUMMY-KEY')

    def test_rust_emitted_rule_ids_match_versioned_registry(self):
        text=(ROOT/'src/lib.rs').read_text()
        used=set(re.findall(r'"(PCZT-[A-Z-]+)"',text))
        # Compare all IDs declared in analyzed PCZT rules; structural stage
        # drift is produced exclusively by the SARIF stage converter.
        declared={r['id'] for r in json.loads((ROOT/'rules/catalog.json').read_text())['rules']}
        self.assertEqual(used,declared-{'PCZT-STRUCTURE-DRIFT'})
        self.assertIn('PCZT-STRUCTURE-DRIFT',(ROOT/'src/sarif.rs').read_text())

    def test_rust_binary_exports_exact_registry_without_wallet_input(self):
        cli=ROOT/'target/debug/zerynex'
        if not cli.is_file():
            self.skipTest('Build the trusted Rust CLI for runtime conformance')
        result=subprocess.run([str(cli),'--rule-catalog'],capture_output=True,timeout=15)
        self.assertEqual(result.returncode,0)
        self.assertEqual(json.loads(result.stdout),json.loads((ROOT/'rules/catalog.json').read_text()))
        invalid=subprocess.run([str(cli),'--rule-catalog','missing.pczt'],capture_output=True,timeout=15)
        self.assertNotEqual(invalid.returncode,0)
        self.assertFalse(invalid.stdout)

if __name__=='__main__':
    unittest.main()
if __name__ == "__main__":
    unittest.main()
