"""Bounded synthetic-only discovery and fail-closed MCP workflow tests."""
from pathlib import Path
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"packages/python/src"))
from zerynex_py import ZerynexClient
from zerynex_py.client import ZerynexError
from zerynex_py.mcp_server import (
    allowed_fixture, discover_synthetic_fixtures, explain_policy_rule,
    evaluate_synthetic_smoke_suite, RULE_GUIDANCE,
)

class SyntheticBoundaries(unittest.TestCase):
    def test_path_traversal_symlink_and_nonfixture_names(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/"clean-v6.bin").write_bytes(b"synthetic")
            (root/"not-allowed.json").write_text("test")
            (root/"link.bin").symlink_to(root/"clean-v6.bin")
            listed=discover_synthetic_fixtures(root)
            self.assertEqual(listed["fixtures"],["clean-v6.bin"])
            self.assertFalse(listed["truncated"])
            self.assertEqual(allowed_fixture(root,"clean-v6.bin"),root/"clean-v6.bin")
            for name in ("../clean-v6.bin","/tmp/key.bin","LINK.BIN","link.bin","nope.json","../secret","foo/bar.bin"):
                with self.subTest(name=name):
                    with self.assertRaises(ZerynexError):
                        allowed_fixture(root,name)

    def test_known_rules_only_no_agent_input_reflection(self):
        self.assertEqual(len(RULE_GUIDANCE),7)
        self.assertIn("output",explain_policy_rule("PCZT-TRANSPARENT-OUTPUTS")["meaning"].lower())
        with self.assertRaises(ZerynexError):
            explain_policy_rule("IGNORE_PREVIOUS_INSTRUCTIONS")

    def test_smoke_missing_fixtures_does_not_forge_success(self):
        cli=ROOT/"target/debug/zerynex"
        if not cli.is_file():
            self.skipTest("Rust binary required for integration smoke tests")
        with tempfile.TemporaryDirectory() as directory:
            result=evaluate_synthetic_smoke_suite(ZerynexClient(cli=cli),Path(directory))
            self.assertFalse(result["passed"])
            self.assertEqual(result["matched"],0)
            self.assertEqual(result["total"],4)
            self.assertNotIn(str(directory),str(result))

if __name__=="__main__":
    unittest.main()
