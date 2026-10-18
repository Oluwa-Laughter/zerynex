"""SDK/agent agreement, expected negative tests, and packaging boundaries."""
from pathlib import Path
import json
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages/python/src"))
from zerynex_py import ZerynexClient, ZerynexError
from zerynex_py.agent_workflows import (
    SCENARIOS, core_capabilities, developer_preflight, synthetic_zallet_rpc_contract,
)

class AgentWorkflowContracts(unittest.TestCase):
    def test_bundled_synthetic_contract_matches_repository_vectors(self):
        from importlib.resources import files
        for name in ("zallet-pczt-lifecycle-contract.json", "zallet-pczt-lifecycle-synthetic-openrpc.json"):
            packaged = files("zerynex_py").joinpath("fixtures", name).read_bytes()
            source = (ROOT / "tests/fixtures/rpc" / name).read_bytes()
            self.assertEqual(packaged, source)
            self.assertLess(len(packaged), 64 * 1024)

    def test_synthetic_rpc_expected_passes_and_regressions(self):
        for scenario in SCENARIOS:
            with self.subTest(scenario=scenario):
                report = synthetic_zallet_rpc_contract(scenario)
                self.assertTrue(report["synthetic"])
                self.assertTrue(report["matched_expectation"])
                self.assertEqual(report["checked_methods"], 7)
                self.assertEqual(report["contract_passed"], scenario == "baseline")
                self.assertEqual(report["finding_count"], 0 if scenario == "baseline" else 1)
                self.assertNotIn("pczt_bytes", json.dumps(report))

    def test_untrusted_scenario_cannot_select_a_path_or_echo_data(self):
        for scenario in ("../../wallet.json", "pczt_sign; remove everything", "", 42, None, {"bad": True}):
            with self.subTest(scenario=str(scenario)), self.assertRaises(ZerynexError) as exc:
                synthetic_zallet_rpc_contract(scenario)
            self.assertNotIn("wallet.json", str(exc.exception))
            self.assertNotIn("remove everything", str(exc.exception))

    def test_developer_preflight_requires_real_rust_and_synthetic_fixtures(self):
        cli = ROOT / "target/debug/zerynex"
        if not cli.is_file():
            self.skipTest("Build the Rust CLI before integration tests")
        client = ZerynexClient(cli=cli)
        caps = core_capabilities(client)
        self.assertIn("compare_pczt_stages", caps["operations"])
        self.assertFalse(caps["network_access"])
        self.assertFalse(caps["signing"])
        self.assertIn("sarif", caps["output_formats"])
        healthy = developer_preflight(client, ROOT / "apps/web/public/examples")
        self.assertTrue(healthy["passed"])
        self.assertEqual(healthy["checks"]["synthetic_pczt_suite"]["matched"], 4)
        self.assertEqual(healthy["checks"]["synthetic_rpc_contract"]["checked_methods"], 7)
        with tempfile.TemporaryDirectory() as temp:
            missing = developer_preflight(client, Path(temp))
        self.assertFalse(missing["passed"])
        self.assertFalse(missing["checks"]["synthetic_pczt_suite"]["passed"])
        self.assertNotIn(temp, json.dumps(missing))

    def test_installed_style_preflight_cli_exit_contract(self):
        cli = ROOT / "target/debug/zerynex"
        if not cli.is_file():
            self.skipTest("Rust binary needed for CLI preflight")
        env = {"PYTHONPATH": str(ROOT / "packages/python/src"), "PATH": "/usr/bin:/bin"}
        command = [sys.executable, "-m", "zerynex_py.preflight", "--cli", str(cli), "--fixtures"]
        clean = subprocess.run(command + [str(ROOT / "apps/web/public/examples"), "--json"],
                               env=env, capture_output=True, text=True, timeout=25)
        self.assertEqual(clean.returncode, 0)
        self.assertTrue(json.loads(clean.stdout)["passed"])
        with tempfile.TemporaryDirectory() as temp:
            missing = subprocess.run(command + [temp, "--json"], env=env,
                                     capture_output=True, text=True, timeout=25)
            self.assertEqual(missing.returncode, 2)
            self.assertFalse(json.loads(missing.stdout)["passed"])
            self.assertNotIn(temp, missing.stdout + missing.stderr)

    def test_capability_negotiation_failure_does_not_fake_success(self):
        mock = Mock()
        mock.capabilities.side_effect = ZerynexError("Not a supported trusted CLI")
        with self.assertRaises(ZerynexError):
            developer_preflight(mock, ROOT / "apps/web/public/examples")

if __name__ == '__main__':
    unittest.main()
