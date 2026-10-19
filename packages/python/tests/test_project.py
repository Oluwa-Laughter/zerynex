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
