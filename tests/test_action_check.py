"""Consumer contract tests for the dependency-free composite action."""
import base64
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from action_check import check

class ConsumerActionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.binary = ROOT / "target" / "debug" / "zerynex"
        if not cls.binary.is_file():
            raise unittest.SkipTest("Build the Rust CLI before testing consumer action.")

    def env(self, filename, **options):
        defaults = {
            "GITHUB_WORKSPACE": str(ROOT),
            "ZERYNEX_ACTION_BIN": str(self.binary),
            "ZERYNEX_PCZT_PATH": filename,
            "ZERYNEX_POLICY_PATH": "",
            "ZERYNEX_INPUT_FORMAT": "binary",
            "ZERYNEX_DENY_TRANSPARENT": "true",
            "ZERYNEX_DENY_SAPLING": "false",
            "ZERYNEX_FAIL_ON_FINDINGS": "true",
        }
        defaults.update(options)
        return defaults

    def test_clean_pczt_returns_zero_findings(self):
        status, report = check(self.env("apps/web/public/examples/clean-v6.bin"))
        self.assertEqual(status, 0)
        self.assertTrue(report["passed"])
        self.assertEqual(report["finding_count"], 0)

    def test_synthetic_violation_fails_policy_job(self):
        status, report = check(self.env("apps/web/public/examples/transparent-v6.bin"))
        self.assertEqual(status, 2)
        self.assertEqual(report["findings"][0]["rule"], "PCZT-TRANSPARENT-OUTPUTS")
        self.assertFalse(report["passed"])

    def test_reporting_only_mode_does_not_mask_result(self):
        status, report = check(self.env(
            "apps/web/public/examples/transparent-v6.bin",
            ZERYNEX_FAIL_ON_FINDINGS="false",
        ))
        self.assertEqual(status, 0)
        self.assertFalse(report["passed"])

    def test_policy_file_is_supported(self):
        status, report = check(self.env(
            "apps/web/public/examples/clean-v6.bin",
            ZERYNEX_POLICY_PATH="policies/shielded-only.json",
        ))
        self.assertEqual(status, 0)
        self.assertTrue(report["passed"])

    def test_base64_transport_from_wallet_fixture(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            fixture = Path(temp) / "synthetic.pczt.b64"
            source = (ROOT / "apps/web/public/examples/transparent-v6.bin").read_bytes()
            fixture.write_bytes(base64.b64encode(source))
            status, report = check(self.env(str(fixture), ZERYNEX_INPUT_FORMAT="base64"))
            self.assertEqual(status, 2)
            self.assertEqual(report["findings"][0]["rule"], "PCZT-TRANSPARENT-OUTPUTS")

    def test_stage_comparison_reports_new_disclosure(self):
        status, report = check(self.env(
            "apps/web/public/examples/flagged-v6.bin",
            ZERYNEX_BASELINE_PATH="apps/web/public/examples/clean-v6.bin",
        ))
        self.assertEqual(status, 2)
        self.assertFalse(report["passed"])
        self.assertEqual(report["regression_count"], 1)
        self.assertEqual(report["finding_count"], 1)

    def test_stage_comparison_rejects_changed_transaction_structure(self):
        status, report = check(self.env(
            "apps/web/public/examples/transparent-v6.bin",
            ZERYNEX_BASELINE_PATH="apps/web/public/examples/clean-v6.bin",
            ZERYNEX_DENY_TRANSPARENT="false",
        ))
        self.assertEqual(status, 2)
        self.assertEqual(report["regression_count"], 1)
        self.assertEqual(report["finding_count"], 0)
        self.assertEqual(report["findings"][0]["rule"], "PCZT-STRUCTURE-DRIFT")

    def test_denies_outside_workspace_and_symlinks(self):
        with self.assertRaises(ValueError):
            check(self.env("/etc/hosts"))
        with self.assertRaises(ValueError):
            check(self.env("../secret.pczt"))
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            inside = Path(temp) / "linked.pczt"
            inside.symlink_to(ROOT / "apps/web/public/examples/clean-v6.bin")
            with self.assertRaises(ValueError):
                check(self.env(str(inside)))

    def test_deny_invalid_boolean_and_format(self):
        with self.assertRaises(ValueError):
            check(self.env("apps/web/public/examples/clean-v6.bin",
                           ZERYNEX_DENY_TRANSPARENT="maybe"))
        with self.assertRaises(ValueError):
            check(self.env("apps/web/public/examples/clean-v6.bin",
                           ZERYNEX_INPUT_FORMAT="rpc-call"))

    def test_malformed_input_never_appears_in_error(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            test_path = Path(temp) / "synthetic.pczt"
            test_path.write_bytes(b"SYNTHETIC_TEST_SECRET_NOT_REAL")
            with self.assertRaises(ValueError) as ctx:
                check(self.env(str(test_path)))
            self.assertNotIn("SYNTHETIC_TEST_SECRET_NOT_REAL", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
