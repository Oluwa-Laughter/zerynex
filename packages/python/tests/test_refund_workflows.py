"""Synthetic-only refund privacy workflows shared by SDK, MCP and preflight."""
from importlib.resources import files
from pathlib import Path
from unittest.mock import patch
import json
import unittest

from zerynex_py.client import ZerynexError
from zerynex_py.refund_workflows import (
    SCENARIOS, _load_scenario, synthetic_refund_audit, synthetic_refund_regression,
    synthetic_refund_smoke_suite,
)

ROOT = Path(__file__).resolve().parents[3]


class RefundAgentWorkflows(unittest.TestCase):
    def test_packaged_json_matches_reviewed_source_bytes(self):
        for name in SCENARIOS:
            with self.subTest(name=name):
                a = files("zerynex_py").joinpath("fixtures", "refund-" + name + ".json").read_bytes()
                b = (ROOT / "tests/fixtures/swap-refund" / (name + ".json")).read_bytes()
                self.assertEqual(a, b)
                self.assertLess(len(a), 64 * 1024)

    def test_all_synthetic_agent_scenarios_have_expected_outcomes(self):
        isolated = synthetic_refund_audit("isolated")
        risky = synthetic_refund_audit("risky")
        expanded = synthetic_refund_audit("regression-expanded")
        self.assertTrue(isolated["report"]["passed"])
        self.assertEqual(risky["report"]["finding_count"], 5)
        self.assertEqual(expanded["report"]["finding_count"], 5)
        result = synthetic_refund_regression("risky", "regression-expanded")
        self.assertEqual(result["report"]["new_risk_events"], 1)
        self.assertEqual(result["report"]["new_rule_ids"], ["SWAP-REFUND-LOOKUP-DISCLOSURE"])
        self.assertEqual(result["synthetic"], True)
        self.assertNotIn("flow_ref", json.dumps(result))
        self.assertNotIn("22222222222222222222222222222222", json.dumps(result))
        suite = synthetic_refund_smoke_suite()
        self.assertEqual((suite["passed"], suite["matched"], suite["total"]), (True, 6, 6))

    def test_unapproved_inputs_never_select_paths_or_repeat_text(self):
        for name in ("../wallet.json", "/home/user/keys.json", "refund-isolated.json",
                     "", "risky/other", None, 3, False, {"text": "secret"}):
            with self.subTest(name=str(name)), self.assertRaises(ZerynexError) as exc:
                synthetic_refund_audit(name)
            self.assertNotIn("wallet.json", str(exc.exception))
            self.assertNotIn("keys.json", str(exc.exception))
        with self.assertRaises(ZerynexError):
            synthetic_refund_regression("isolated", "../../wallet.json")

    def test_bad_bundled_scenario_fails_preflight_without_echo(self):
        with patch("zerynex_py.refund_workflows.synthetic_refund_regression",
                   side_effect=ZerynexError("internal fixture path")):
            report = synthetic_refund_smoke_suite()
        self.assertFalse(report["passed"])
        self.assertEqual(report["matched"], 3)
        self.assertNotIn("internal fixture path", json.dumps(report))

    def test_unreadable_synthetic_manifest_fails_closed(self):
        with patch("zerynex_py.refund_workflows.files", side_effect=OSError("secrets")):
            with self.assertRaises(ZerynexError) as exc:
                _load_scenario("risky")
        self.assertNotIn("secrets", str(exc.exception))


if __name__ == "__main__":
    unittest.main()
