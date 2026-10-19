"""Real offline Zerynex project adoption, path safety and Rust-fixture tests."""
from pathlib import Path
from tempfile import TemporaryDirectory
import contextlib
import io
import json
import os
import subprocess
import sys
import unittest

from zerynex_py.project import (ProjectError, initialize, verify, _root, _assets,
                                MANIFEST, CLEAN, TRANSPARENT, POLICY, WORKFLOW)

ROOT=Path(__file__).resolve().parents[3]
CLI=ROOT/'target/debug/zerynex'

class ProjectTests(unittest.TestCase):
    def test_scaffold_is_synthetic_only_and_pins_git_action(self):
        with TemporaryDirectory() as d:
            root=Path(d)
            status=initialize(root,ci=True)
            self.assertTrue(status['initialized'])
            self.assertTrue(status['synthetic_only'])
            self.assertEqual(len(status['created_files']),5)
            self.assertIn('Oluwa-Laughter/zerynex@8dcbbba5584d1f168ec688ca42cd8f185ea904d1', (root/WORKFLOW).read_text())
            self.assertNotIn('secrets.',(root/WORKFLOW).read_text())
            self.assertEqual(json.loads((root/MANIFEST).read_text())['synthetic_only'],True)
            self.assertNotEqual((root/CLEAN).read_bytes(),(root/TRANSPARENT).read_bytes())
            self.assertTrue((root/POLICY).is_file())
            with self.assertRaises(ProjectError):
                initialize(root,ci=True)

    def test_preflight_conflicts_are_atomic(self):
        with TemporaryDirectory() as d:
            root=Path(d)
            (root/'.zerynex').mkdir()
            (root/'.zerynex/policy.json').write_text('Do not overwrite!')
            with self.assertRaises(ProjectError):initialize(root,ci=True)
            self.assertEqual((root/'.zerynex/policy.json').read_text(),'Do not overwrite!')
            self.assertFalse((root/CLEAN).exists())
            self.assertFalse((root/WORKFLOW).exists())

    def test_symlink_paths_cannot_escape_project(self):
        with TemporaryDirectory() as d, TemporaryDirectory() as outside:
            root=Path(d)
            (root/'.zerynex').symlink_to(outside,target_is_directory=True)
            with self.assertRaises(ProjectError):initialize(root,ci=False)
            self.assertEqual(list(Path(outside).iterdir()),[])
            (root/'.zerynex').unlink()
            (root/'.github').mkdir()
            (root/'.github/workflows').symlink_to(outside,target_is_directory=True)
            with self.assertRaises(ProjectError):initialize(root,ci=True)
            self.assertFalse((root/MANIFEST).exists())
            self.assertEqual(list(Path(outside).iterdir()),[])
            (root/'.github/workflows').unlink()
            (root/'subroot').symlink_to(outside,target_is_directory=True)
            with self.assertRaises(ProjectError):_root(str(root/'subroot'))

    def test_verify_requires_exact_reviewed_fixture_bytes(self):
        with TemporaryDirectory() as d:
            root=Path(d)
            initialize(root,ci=False)
            (root/CLEAN).write_bytes(b'replaced by untrusted fixture')
            with self.assertRaises(ProjectError):verify(root,str(CLI))
            (root/CLEAN).write_bytes(_assets(ci=False)[CLEAN])
            (root/POLICY).write_text('{"deny_transparent":false}')
            with self.assertRaises(ProjectError):verify(root,str(CLI))

    @unittest.skipUnless(CLI.is_file(), 'build trusted Rust CLI for full verification')
    def test_real_local_rust_cli_verifies_both_synthetic_results(self):
        with TemporaryDirectory() as d:
            root=Path(d)
            initialize(root,ci=True)
            result=verify(root,str(CLI))
            self.assertTrue(result['passed'])
            self.assertEqual(result['checks']['clean_fixture'],True)
            self.assertEqual(result['checks']['transparent_detection'],True)
            self.assertNotIn(str(root),json.dumps(result))
            self.assertNotIn('txid',json.dumps(result))

    @unittest.skipUnless(CLI.is_file(), 'build trusted Rust CLI for full verification')
    def test_commandline_init_verify_json_and_secretless_failures(self):
        with TemporaryDirectory() as d:
            root=Path(d)
            cmd=[sys.executable,'-m','zerynex_py.project']
            init=subprocess.run(cmd+['init','--project',str(root),'--ci','--json'],capture_output=True,text=True,timeout=20)
            self.assertEqual(init.returncode,0,init.stderr)
            self.assertTrue(json.loads(init.stdout)['ci_configured'])
            verify_cmd=cmd+['verify','--project',str(root),'--cli',str(CLI),'--json']
            check=subprocess.run(verify_cmd,capture_output=True,text=True,timeout=25)
            self.assertEqual(check.returncode,0,check.stderr)
            self.assertTrue(json.loads(check.stdout)['passed'])
            (root/TRANSPARENT).write_bytes(b'private-input-would-never-be-printed')
            bad=subprocess.run(verify_cmd,capture_output=True,text=True,timeout=25)
            self.assertEqual(bad.returncode,1)
            self.assertNotIn('private-input',bad.stdout+bad.stderr)
            self.assertNotIn(str(root),bad.stdout+bad.stderr)

if __name__=='__main__': unittest.main()

class ExplicitProjectAnalysisTests(unittest.TestCase):
    def create_workspace(self, root: Path) -> None:
        from shutil import copyfile
        initialize(root, ci=True)
        copyfile(root / CLEAN, root / 'before.pczt')
        copyfile(root / TRANSPARENT, root / 'after.pczt')

    @unittest.skipUnless(CLI.is_file(), 'build trusted Rust CLI to evaluate explicit input')
    def test_real_local_pczt_analysis_and_regression(self):
        from zerynex_py.project import check_project, compare_project
        with TemporaryDirectory() as dirname:
            root=Path(dirname)
            self.create_workspace(root)
            baseline=check_project(root, str(CLI), 'before.pczt')
            flagged=check_project(root, str(CLI), 'after.pczt')
            delta=compare_project(root, str(CLI), 'before.pczt', 'after.pczt')
            self.assertTrue(baseline['passed'])
            self.assertEqual(baseline['finding_count'], 0)
            self.assertFalse(flagged['passed'])
            self.assertEqual(flagged['rule_ids'], ['PCZT-TRANSPARENT-OUTPUTS'])
            self.assertFalse(delta['passed'])
            self.assertEqual(delta['added_rule_ids'], ['PCZT-TRANSPARENT-OUTPUTS'])
            self.assertEqual(delta['before_findings_count'], 0)
            self.assertEqual(delta['after_findings_count'], 1)
            for item in (baseline, flagged, delta):
                text=json.dumps(item)
                self.assertNotIn(dirname,text)
                self.assertNotIn('after.pczt',text)
                self.assertNotIn('before.pczt',text)
                self.assertNotIn('txid',text)
                self.assertNotIn('memo_base64url',text)
                self.assertNotIn('synthetic_only',item)  # Explicit files are not certified to be synthetic

    def test_strict_local_file_boundaries(self):
        from zerynex_py.project import _project_file
        with TemporaryDirectory() as dirname, TemporaryDirectory() as outsider:
            root=Path(dirname)
            self.create_workspace(root)
            bad=Path(outsider)/'private.pczt'
            bad.write_bytes((root/CLEAN).read_bytes())
            (root/'link.pczt').symlink_to(bad)
            (root/'linked-dir').symlink_to(outsider,target_is_directory=True)
            (root/'fifo').write_text('')
            for value in (str(bad), '../private.pczt', 'link.pczt','linked-dir/private.pczt',
                          '.', '', 'not-present.pczt'):
                with self.subTest(value=value), self.assertRaises(ProjectError):
                    _project_file(root,value)
            self.assertEqual(_project_file(root,'before.pczt'),root/'before.pczt')

    def test_invalid_or_deceptive_project_policy_rejected(self):
        from zerynex_py.project import _policy_from_project
        with TemporaryDirectory() as dirname:
            root=Path(dirname)
            self.create_workspace(root)
            for body in (b'{"profile":"external_signer","deny_transparent":true,"deny_transparent":false,"deny_sapling":false}',
                         b'{"profile":"external_signer","deny_transparent":1,"deny_sapling":false}',
                         b'{"profile":"restricted_handoff","deny_transparent":true,"deny_sapling":false,"secret":1}',
                         b'not json', b'X'*5000):
                with self.subTest(body=body[:25]):
                    (root/POLICY).write_bytes(body)
                    with self.assertRaises(ProjectError):_policy_from_project(root)
            (root/POLICY).unlink()
            (root/POLICY).symlink_to(root/'before.pczt')
            with self.assertRaises(ProjectError): _policy_from_project(root)

    @unittest.skipUnless(CLI.is_file(), 'build trusted Rust CLI to evaluate explicit input')
    def test_commandline_local_file_status_codes_and_sanitization(self):
        with TemporaryDirectory() as dirname:
            root=Path(dirname)
            self.create_workspace(root)
            base=[sys.executable,'-m','zerynex_py.project']
            common=['--project',dirname,'--cli',str(CLI),'--json']
            run=lambda args: subprocess.run(base+args, text=True, capture_output=True, timeout=25)
            clean=run(['check',*common,'--pczt','before.pczt'])
            self.assertEqual(clean.returncode,0,clean.stderr)
            self.assertTrue(json.loads(clean.stdout)['passed'])
            flagged=run(['check',*common,'--pczt','after.pczt'])
            self.assertEqual(flagged.returncode,2,flagged.stderr)
            self.assertEqual(json.loads(flagged.stdout)['rule_ids'],['PCZT-TRANSPARENT-OUTPUTS'])
            compared=run(['compare',*common,'--before','before.pczt','--after','after.pczt'])
            self.assertEqual(compared.returncode,2,compared.stderr)
            self.assertFalse(json.loads(compared.stdout)['no_new_findings'])
            (root/'secret.pczt').write_bytes(b'PRIVATE_PCZT_BYTES_NEVER_LOG')
            rejected=run(['check',*common,'--pczt','secret.pczt'])
            self.assertEqual(rejected.returncode,1)
            self.assertNotIn('PRIVATE_PCZT',rejected.stdout+rejected.stderr)
            self.assertNotIn(dirname,rejected.stdout+rejected.stderr)

    def test_rejects_duplicate_paths_in_regression(self):
        from zerynex_py.project import compare_project
        with TemporaryDirectory() as dirname:
            root=Path(dirname)
            self.create_workspace(root)
            with self.assertRaises(ProjectError):
                compare_project(root,str(CLI),'before.pczt','./before.pczt')
