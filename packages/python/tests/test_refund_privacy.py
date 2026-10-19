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
