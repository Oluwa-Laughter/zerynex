import base64
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages" / "python" / "src"))

from zerynex_py import Policy, Report, ZerynexClient, ZerynexError
from zerynex_py.mcp_server import allowed_fixture, scan_fixture

BIN = ROOT / "target" / "debug" / "zerynex"
FIXTURES = ROOT / "apps" / "web" / "public" / "examples"


class IntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not BIN.is_file():
            raise unittest.SkipTest("Build the real Rust binary with cargo build first.")
        cls.client = ZerynexClient(cli=BIN)

    def test_real_clean_fixture(self):
        report = self.client.analyze_file(FIXTURES / "clean-v6.bin", Policy(deny_transparent=True))
        self.assertTrue(report.passed)
        self.assertEqual(report.findings, ())

    def test_real_global_metadata(self):
        report = self.client.analyze_file(FIXTURES / "flagged-v6.bin")
        self.assertFalse(report.passed)
        self.assertEqual(report.findings[0].rule, "PCZT-GLOBAL-METADATA")
        self.assertNotIn("synthetic-only", str(report.agent_summary()))

    def test_real_transparent_policy_differs_from_baseline(self):
        fixture = FIXTURES / "transparent-v6.bin"
        self.assertTrue(self.client.analyze_file(fixture).passed)
        denied = self.client.analyze_file(fixture, Policy(deny_transparent=True))
        self.assertFalse(denied.passed)
        self.assertEqual(denied.findings[0].rule, "PCZT-TRANSPARENT-OUTPUTS")

    def test_zallet_style_base64_in_memory_matches_binary(self):
        data = (FIXTURES / "transparent-v6.bin").read_bytes()
        b64 = base64.b64encode(data).decode("ascii")
        result = self.client.analyze_base64(b64, Policy(deny_transparent=True))
        self.assertFalse(result.passed)
        self.assertEqual(result.findings[0].rule, "PCZT-TRANSPARENT-OUTPUTS")

    def test_zallet_bad_base64_never_echoes_contents(self):
        with self.assertRaises(ZerynexError) as error:
            self.client.analyze_base64("SYNTHETIC_PRIVATE_NEVER_ECHO!")
        self.assertNotIn("SYNTHETIC_PRIVATE_NEVER_ECHO", str(error.exception))

    def test_stage_comparison_detects_new_metadata_disclosure(self):
        report = self.client.compare_files(
            FIXTURES / "clean-v6.bin", FIXTURES / "flagged-v6.bin",
        )
        self.assertFalse(report.passed)
        self.assertEqual(report.added_findings[0][0], "PCZT-GLOBAL-METADATA")
        self.assertNotIn("synthetic-only", json.dumps(report.agent_summary()))

    def test_stage_comparison_rejects_topology_drift(self):
        report = self.client.compare_files(
            FIXTURES / "clean-v6.bin", FIXTURES / "transparent-v6.bin",
        )
        self.assertFalse(report.passed)
        self.assertEqual(report.component_deltas[0][0], "transparent.outputs")

    def test_real_invalid_binary_does_not_echo_private_contents(self):
        with tempfile.TemporaryDirectory() as tmp:
            secret = "example-private-wallet-secret"
            path = Path(tmp) / "invalid.bin"
            path.write_bytes(secret.encode())
            with self.assertRaises(ZerynexError) as err:
                self.client.analyze_file(path)
            self.assertNotIn(secret, str(err.exception))

    def test_agent_rejects_traversal_and_symlink(self):
        for name in ("../clean-v6.bin", "/tmp/clean-v6.bin", "foo/clean-v6.bin", "NOTA.bin"):
            with self.subTest(name=name), self.assertRaises(ZerynexError):
                allowed_fixture(FIXTURES, name)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "linked.bin").symlink_to(FIXTURES / "clean-v6.bin")
            with self.assertRaises(ZerynexError):
                allowed_fixture(root, "linked.bin")

    def test_agent_output_contains_findings_not_transaction_bytes(self):
        result = scan_fixture(self.client, FIXTURES, "flagged-v6.bin")
        self.assertEqual(result["finding_count"], 1)
        self.assertNotIn("synthetic-only", json.dumps(result))
        self.assertNotIn("pczt_bytes", result)
        self.assertFalse(result["passed"])

    def test_agent_defaults_deny_transparent(self):
        result = scan_fixture(self.client, FIXTURES, "transparent-v6.bin")
        self.assertFalse(result["passed"])
        self.assertEqual(result["findings"][0]["rule"], "PCZT-TRANSPARENT-OUTPUTS")


class ValidationTests(unittest.TestCase):
    def test_python_policy_is_strict(self):
        with self.assertRaises(ZerynexError):
            Policy(deny_transparent="true")
        with self.assertRaises(ZerynexError):
            Policy(profile="unrecognized")

    def test_timeout_and_cli_input(self):
        with self.assertRaises(ZerynexError):
            ZerynexClient(cli="/nonexistent/not-a-binary")
        with self.assertRaises(ZerynexError):
            ZerynexClient(cli=BIN, timeout=1000)

    def test_does_not_echo_stderr_or_spendable_contents(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "synthetic.bin"
            p.write_bytes(b"\x01\x02")
            fake = subprocess.CompletedProcess(
                args=[], returncode=1, stdout="", stderr="synthetic-SECRET-KEY"
            )
            with patch("zerynex_py.client.subprocess.run", return_value=fake):
                with self.assertRaises(ZerynexError) as ctx:
                    ZerynexClient(cli=BIN).analyze_file(p)
            self.assertNotIn("synthetic-SECRET-KEY", str(ctx.exception))

    def test_rejects_mismatched_exit_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "synthetic.bin"
            p.write_bytes(b"\x01\x02")
            fake = subprocess.CompletedProcess(
                args=[], returncode=2,
                stdout=json.dumps({
                    "profile": "external_signer", "deny_transparent": False,
                    "deny_sapling": False, "checked_pools": ["ironwood"],
                    "findings": [], "disclaimer": "Testing",
                }),
                stderr="",
            )
            with patch("zerynex_py.client.subprocess.run", return_value=fake):
                with self.assertRaises(ZerynexError):
                    ZerynexClient(cli=BIN).analyze_file(p)


if __name__ == "__main__":
    unittest.main()
