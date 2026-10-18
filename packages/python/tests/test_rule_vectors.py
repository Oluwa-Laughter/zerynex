"""Independent Python SDK conformance to reviewed PCZT rule vectors.

All binary fixtures are deterministic nonspendable inputs from pczt 0.9.3.
"""
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'packages/python/src'))
from zerynex_py import Policy,ZerynexClient

class RuleVectorIntegration(unittest.TestCase):
    def test_local_rust_cli_and_python_adapter_match_all_rule_vectors(self):
        cli=ROOT/'target/debug/zerynex'
        if not cli.is_file():
            self.skipTest('Build the canonical local Rust binary first')
        client=ZerynexClient(cli=cli)
        dataset=json.loads((ROOT/'tests/fixtures/rules/expectations.json').read_text())
        self.assertEqual(dataset['schema_version'],1)
        self.assertEqual(dataset['rule_set_version'],client.rule_catalog()['rule_set_version'])
        observed=set()
        for case in dataset['cases']:
            path=(ROOT/('apps/web/public/examples' if case['fixture'] in (
                  'clean-v6.bin','flagged-v6.bin','transparent-v6.bin')
                  else 'tests/fixtures/rules')/case['fixture'])
            self.assertTrue(path.is_file())
            policy=Policy(profile=case['profile'],deny_transparent=case['deny_transparent'],
                          deny_sapling=case['deny_sapling'])
            with self.subTest(fixture=case['fixture'],policy=policy):
                report=client.analyze_file(path,policy)
                found=[{'rule':finding.rule,'field':finding.field} for finding in report.findings]
                self.assertEqual(found,case['findings'])
                self.assertEqual(report.passed,not bool(case['findings']))
                self.assertNotIn('synthetic-marker',str(report.agent_summary()))
                self.assertNotIn('example-synthetic-not-a-real-address',str(report.agent_summary()))
                observed.update(finding['rule'] for finding in found)
        rules=client.rule_catalog()['rules']
        expected={rule['id'] for rule in rules if 'analysis' in rule['applies_to']}
        self.assertEqual(observed,expected)

    def test_python_stage_comparisons_match_shared_vectors(self):
        cli=ROOT/'target/debug/zerynex'
        if not cli.is_file():
            self.skipTest('Build the canonical local Rust binary first')
        client=ZerynexClient(cli=cli)
        dataset=json.loads((ROOT/'tests/fixtures/rules/expectations.json').read_text())
        for case in dataset['stage_cases']:
            def filename(name):
                parent='apps/web/public/examples' if name in ('clean-v6.bin','flagged-v6.bin','transparent-v6.bin') else 'tests/fixtures/rules'
                return ROOT/parent/name
            policy=Policy(profile=case['profile'], deny_transparent=case['deny_transparent'],
                          deny_sapling=case['deny_sapling'])
            with self.subTest(stage=case['name']):
                report=client.compare_files(filename(case['before']),filename(case['after']),policy)
                self.assertEqual(report.passed,case['passed'])
                self.assertEqual(report.no_new_findings,case['no_new_findings'])
                self.assertEqual([{'rule':r,'field':f} for r,f in report.added_findings],case['added_findings'])
                self.assertEqual([{'rule':r,'field':f} for r,f in report.resolved_findings],case['resolved_findings'])
                self.assertEqual([{'component':n,'before':b,'after':a} for n,b,a in report.component_deltas],case['component_deltas'])
                self.assertNotIn('synthetic-marker',str(report.agent_summary()))

if __name__=='__main__':
    unittest.main()
