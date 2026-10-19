"""Metadata-only quantum-era refund privacy model; tests never use real wallets."""
from pathlib import Path
import json
from tempfile import TemporaryDirectory
import subprocess
import sys
import unittest

from zerynex_py.refund_privacy import audit_manifest, read_manifest, RefundAuditInputError

FIXTURES = Path(__file__).resolve().parents[3] / 'tests/fixtures/swap-refund'

class RefundPrivacyTests(unittest.TestCase):
    def test_isolated_refund_keys_are_not_claimed_quantum_secure(self):
        report=audit_manifest(read_manifest(str(FIXTURES/'isolated.json')))
        self.assertTrue(report['passed'])
        self.assertEqual(report['flows_checked'],2)
        self.assertEqual(report['public_refund_flows'],2)
        self.assertEqual(report['rule_ids'],[])
        self.assertEqual(report['status'],'declaration_review_only')
        self.assertIn('not', report['limitation'].lower())
        self.assertNotIn('quantum_resistant',report)

    def test_reused_address_keyscope_and_insecure_lookup_are_detected(self):
        report=audit_manifest(read_manifest(str(FIXTURES/'risky.json')))
        self.assertFalse(report['passed'])
        self.assertEqual(report['finding_count'],5)
        self.assertEqual(report['rule_ids'],[
            'SWAP-PUBLIC-REFUND-UNSCOPED',
            'SWAP-REFUND-ADDRESS-REUSE',
            'SWAP-REFUND-LOOKUP-DISCLOSURE',
            'SWAP-SPENDING-KEY-CUSTODY-UNVERIFIED',
            'SWAP-VIEWING-SCOPE-REUSE'])
        self.assertNotIn('11111111111111111111111111111111',json.dumps(report))
        self.assertNotIn('22222222222222222222222222222222',json.dumps(report))

    def test_key_scope_reuse_even_with_unique_address_is_detected(self):
        manifest=read_manifest(str(FIXTURES/'isolated.json'))
        manifest['flows'][1]['viewing_scope_ref']=manifest['flows'][0]['viewing_scope_ref']
        report=audit_manifest(manifest)
        self.assertIn('SWAP-VIEWING-SCOPE-REUSE',report['rule_ids'])
        self.assertIn('SWAP-PUBLIC-REFUND-UNSCOPED',report['rule_ids'])
        self.assertNotIn('SWAP-REFUND-ADDRESS-REUSE',report['rule_ids'])

    def test_duplicate_swaps_not_accepted(self):
        manifest=read_manifest(str(FIXTURES/'isolated.json'))
        manifest['flows'][1]['flow_ref']=manifest['flows'][0]['flow_ref']
        with self.assertRaises(RefundAuditInputError):audit_manifest(manifest)

    def test_raw_addresses_keys_unknown_fields_or_unbounded_flows_rejected(self):
        manifest=read_manifest(str(FIXTURES/'isolated.json'))
        candidates=[]
        m=json.loads(json.dumps(manifest));m['flows'][0]['refund_address_ref']='u1notanopaquetoken';candidates.append(m)
        m=json.loads(json.dumps(manifest));m['flows'][0]['spending_key']='secret';candidates.append(m)
        m=json.loads(json.dumps(manifest));m['flows'][0]['lookup_mode']='quantum_safe';candidates.append(m)
        m=json.loads(json.dumps(manifest));m['flows'][0]['published_publicly']=1;candidates.append(m)
        m=json.loads(json.dumps(manifest));m['flows']*=51;candidates.append(m)
        m=json.loads(json.dumps(manifest));m['schema_version']=True;candidates.append(m)
        m=json.loads(json.dumps(manifest));m['flows'][0]['spending_key_custody']=None;candidates.append(m)
        for candidate in candidates:
            with self.subTest(candidate=str(candidate)[:80]),self.assertRaises(RefundAuditInputError):
                audit_manifest(candidate)

    def test_json_duplicate_keys_symlinks_fifo_and_oversize_fail_closed(self):
        with TemporaryDirectory() as dir:
            root=Path(dir)
            source=root/'manifest.json'
            source.write_text('{"schema_version":1,"flows":[],"flows":[]}')
            with self.assertRaises(RefundAuditInputError):read_manifest(str(source))
            source.write_text('{"schema_version": NaN, "flows": []}')
            with self.assertRaises(RefundAuditInputError):read_manifest(str(source))
            (root/'link.json').symlink_to(source)
            with self.assertRaises(RefundAuditInputError):read_manifest(str(root/'link.json'))
            source.write_bytes(b'x'*(64*1024+1))
            with self.assertRaises(RefundAuditInputError):read_manifest(str(source))
            if hasattr(__import__('os'),'mkfifo'):
                import os
                os.mkfifo(root/'pipe')
                with self.assertRaises(RefundAuditInputError):read_manifest(str(root/'pipe'))

    def test_cli_exit_codes_and_no_input_echo(self):
        cmd=[sys.executable,'-m','zerynex_py.refund_privacy','--manifest']
        clean=subprocess.run(cmd+[str(FIXTURES/'isolated.json'),'--json'],text=True,capture_output=True,timeout=15)
        self.assertEqual(clean.returncode,0,clean.stderr)
        risky=subprocess.run(cmd+[str(FIXTURES/'risky.json'),'--json'],text=True,capture_output=True,timeout=15)
        self.assertEqual(risky.returncode,2,risky.stderr)
        self.assertIn('SWAP-VIEWING-SCOPE-REUSE',risky.stdout)
        with TemporaryDirectory() as path:
            secret=Path(path)/'SECRET_REFUND_KEY_MUST_NOT_PRINT.json'
            secret.write_text('{"flow":"private_material_NEVER_ECHO"}')
            bad=subprocess.run(cmd+[str(secret),'--json'],text=True,capture_output=True,timeout=15)
            self.assertEqual(bad.returncode,1)
            self.assertNotIn('SECRET_REFUND',bad.stdout+bad.stderr)
            self.assertNotIn('private_material',bad.stdout+bad.stderr)

if __name__=='__main__':unittest.main()

class RefundRegressionTests(unittest.TestCase):
    def test_forward_regression_counts_events_without_leaking_refs(self):
        from zerynex_py.refund_privacy import compare_manifests
        before=read_manifest(str(FIXTURES/'isolated.json'))
        after=read_manifest(str(FIXTURES/'risky.json'))
        diff=compare_manifests(before,after)
        self.assertFalse(diff['passed'])
        self.assertEqual(diff['baseline_risk_events'],0)
        self.assertEqual(diff['current_risk_events'],8)
        self.assertEqual(diff['new_risk_events'],8)
        self.assertEqual(len(diff['new_rule_ids']),5)
        self.assertEqual(diff['resolved_risk_events'],0)
        output=json.dumps(diff)
        for marker in ('11111111111111111111111111111111',
                       '22222222222222222222222222222222','33333333333333333333333333333333'):
            self.assertNotIn(marker,output)

    def test_fixes_are_not_new_regressions(self):
        from zerynex_py.refund_privacy import compare_manifests
        result=compare_manifests(read_manifest(str(FIXTURES/'risky.json')),
                                 read_manifest(str(FIXTURES/'isolated.json')))
        self.assertTrue(result['passed'])
        self.assertEqual(result['new_risk_events'],0)
        self.assertEqual(result['resolved_risk_events'],8)
        self.assertEqual(len(result['resolved_rule_ids']),5)

    def test_new_flow_fails_even_when_same_rule_category_was_already_present(self):
        from zerynex_py.refund_privacy import compare_manifests
        before=read_manifest(str(FIXTURES/'risky.json'))
        after=read_manifest(str(FIXTURES/'regression-expanded.json'))
        report=compare_manifests(before,after)
        self.assertEqual(report['baseline_risk_events'],8)
        self.assertEqual(report['current_risk_events'],9)
        self.assertEqual(report['new_risk_events'],1)
        self.assertEqual(report['new_rule_ids'],['SWAP-REFUND-LOOKUP-DISCLOSURE'])
        self.assertFalse(report['passed'])

    def test_manifest_reordering_does_not_create_false_findings(self):
        from zerynex_py.refund_privacy import compare_manifests
        before=read_manifest(str(FIXTURES/'risky.json'))
        after=json.loads(json.dumps(before))
        after['flows'].reverse()
        self.assertTrue(compare_manifests(before,after)['passed'])
        self.assertEqual(compare_manifests(before,after)['new_risk_events'],0)

    def test_invalid_baseline_still_rejected(self):
        from zerynex_py.refund_privacy import compare_manifests
        with self.assertRaises(RefundAuditInputError):
            compare_manifests({'schema_version':1,'flows':[]},
                              read_manifest(str(FIXTURES/'risky.json')))

    def test_cli_compare_exit_codes_and_opaque_outputs(self):
        command=[sys.executable,'-m','zerynex_py.refund_privacy','--baseline']
        safe=str(FIXTURES/'isolated.json')
        bad=str(FIXTURES/'risky.json')
        more=str(FIXTURES/'regression-expanded.json')
        forward=subprocess.run(command+[safe,'--manifest',bad,'--json'],
                               text=True,capture_output=True,timeout=15)
        self.assertEqual(forward.returncode,2,forward.stderr)
        self.assertEqual(json.loads(forward.stdout)['new_risk_events'],8)
        reverse=subprocess.run(command+[bad,'--manifest',safe,'--json'],
                               text=True,capture_output=True,timeout=15)
        self.assertEqual(reverse.returncode,0,reverse.stderr)
        expanded=subprocess.run(command+[bad,'--manifest',more,'--json'],
                                text=True,capture_output=True,timeout=15)
        self.assertEqual(expanded.returncode,2,expanded.stderr)
        self.assertEqual(json.loads(expanded.stdout)['new_risk_events'],1)
        same=subprocess.run(command+[bad,'--manifest',bad,'--json'],
                            text=True,capture_output=True,timeout=15)
        self.assertEqual(same.returncode,1)
        self.assertNotIn(bad,same.stderr)
        missing=subprocess.run(command+['/tmp/THIS_IS_PRIVATE_NOT_FOUND_FILE',
                                          '--manifest',bad,'--json'],
                               text=True,capture_output=True,timeout=15)
        self.assertEqual(missing.returncode,1)
        self.assertNotIn('PRIVATE',missing.stderr)

class RefundSarifTests(unittest.TestCase):
    def test_full_audit_sarif_has_no_artifact_or_identifying_locations(self):
        from zerynex_py.refund_privacy import sarif_report
        report=audit_manifest(read_manifest(str(FIXTURES/'risky.json')))
        sarif=sarif_report(report)
        self.assertEqual(sarif['version'],'2.1.0')
        run=sarif['runs'][0]
        self.assertEqual(len(run['results']),5)
        self.assertEqual(len(run['tool']['driver']['rules']),5)
        self.assertTrue(run['properties']['noInputLocations'])
        self.assertTrue(all('locations' not in result for result in run['results']))
        text=json.dumps(sarif)
        self.assertNotIn('11111111111111111111111111111111',text)
        self.assertNotIn('22222222222222222222222222222222',text)
        self.assertNotIn('risky.json',text)

    def test_regression_sarif_only_contains_newly_introduced_rule_ids(self):
        from zerynex_py.refund_privacy import compare_manifests, sarif_report
        report=compare_manifests(
            read_manifest(str(FIXTURES/'risky.json')),
            read_manifest(str(FIXTURES/'regression-expanded.json')))
        sarif=sarif_report(report)
        self.assertEqual(sarif['runs'][0]['properties']['mode'],'regression')
        self.assertEqual([x['ruleId'] for x in sarif['runs'][0]['results']],
                         ['SWAP-REFUND-LOOKUP-DISCLOSURE'])
        self.assertEqual(sarif['runs'][0]['properties']['warningCount'],1)

    def test_clean_regression_has_empty_sarif_results(self):
        from zerynex_py.refund_privacy import compare_manifests, sarif_report
        report=compare_manifests(
            read_manifest(str(FIXTURES/'risky.json')),
            read_manifest(str(FIXTURES/'isolated.json')))
        sarif=sarif_report(report)
        self.assertEqual(sarif['runs'][0]['results'],[])

    def test_sarif_cli_retains_findings_exit_codes(self):
        result=subprocess.run([sys.executable,'-m','zerynex_py.refund_privacy',
                               '--manifest',str(FIXTURES/'risky.json'),
                               '--baseline',str(FIXTURES/'isolated.json'),'--sarif'],
                              text=True,capture_output=True,timeout=20)
        self.assertEqual(result.returncode,2,result.stderr)
        self.assertEqual(json.loads(result.stdout)['version'],'2.1.0')
        self.assertNotIn('22222222222222222222222222222222',result.stdout)
