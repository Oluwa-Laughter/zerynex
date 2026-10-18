"""Consumer contract tests for the dependency-free composite action."""
import base64
import contextlib
import io
from unittest.mock import patch
import json
import shutil
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from action_check import check, main, safe_sarif_destination

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
            "ZERYNEX_HANDOFF_BIN": str(ROOT / "target/debug/zerynex-handoff"),
            "ZERYNEX_SCENARIO_MANIFEST": "",
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

    def test_offline_handoff_manifest_accepted(self):
        status, report = check(self.env(
            "", ZERYNEX_SCENARIO_MANIFEST="tests/fixtures/role-handoff/scenario.json"
        ))
        self.assertEqual(status, 0)
        self.assertTrue(report["passed"])
        self.assertEqual(report["scenario_count"], 4)
        self.assertEqual(report["scenario_matched"], 4)

    def test_offline_handoff_expectation_mismatch(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as tmp:
            path = Path(tmp)
            fixture_root = ROOT / "tests/fixtures/role-handoff"
            shutil.copyfile(fixture_root / "00-created.bin", path / "00-created.bin")
            shutil.copyfile(fixture_root / "01-updated.bin", path / "01-updated.bin")
            manifest = json.loads((fixture_root / "scenario.json").read_text())
            manifest["transitions"] = manifest["transitions"][:1]
            manifest["transitions"][0]["expect"]["passed"] = True
            (path / "scenario.json").write_text(json.dumps(manifest))
            status, report = check(self.env(
                "", ZERYNEX_SCENARIO_MANIFEST=str(path / "scenario.json"),
            ))
            self.assertEqual(status, 2)
            self.assertFalse(report["passed"])
            self.assertEqual(report["scenario_matched"], 0)
            self.assertEqual(report["findings"][0]["rule"], "PCZT-SCENARIO-MISMATCH")

    def test_role_scenarios_cannot_mix_private_pczt_inputs(self):
        with self.assertRaises(ValueError):
            check(self.env(
                "apps/web/public/examples/clean-v6.bin",
                ZERYNEX_SCENARIO_MANIFEST="tests/fixtures/role-handoff/scenario.json",
            ))

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

    def test_optional_sarif_export_redacts_paths_and_preserves_ci_failure(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            directory = Path(temp)
            destination = directory / "zerynex.sarif"
            relative = destination.relative_to(ROOT).as_posix()
            status, report = check(self.env(
                "apps/web/public/examples/transparent-v6.bin",
                ZERYNEX_SARIF_OUTPUT=relative,
            ))
            self.assertEqual(status, 2)
            self.assertFalse(report["passed"])
            self.assertEqual(report["sarif_path"], relative)
            result = json.loads(destination.read_text())
            self.assertEqual(result["version"], "2.1.0")
            self.assertEqual(result["runs"][0]["results"][0]["ruleId"], "PCZT-TRANSPARENT-OUTPUTS")
            self.assertNotIn("transparent-v6.bin", destination.read_text())
            self.assertNotIn(str(ROOT), destination.read_text())
            self.assertNotIn("physicalLocation", destination.read_text())
            self.assertNotIn("artifactLocation", destination.read_text())
            self.assertEqual(destination.stat().st_mode & 0o777, 0o600)
            # A second execution must not overwrite or follow the first artifact.
            with self.assertRaises(ValueError):
                check(self.env("apps/web/public/examples/clean-v6.bin", ZERYNEX_SARIF_OUTPUT=relative))

    def test_optional_sarif_stage_preserves_existing_and_structural_findings(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            dest = Path(temp) / "stages.sarif"
            status, report = check(self.env(
                "apps/web/public/examples/transparent-v6.bin",
                ZERYNEX_BASELINE_PATH="apps/web/public/examples/clean-v6.bin",
                ZERYNEX_SARIF_OUTPUT=dest.relative_to(ROOT).as_posix(),
            ))
            self.assertEqual(status, 2)
            self.assertFalse(report["passed"])
            results = json.loads(dest.read_text())["runs"][0]["results"]
            self.assertEqual({x["ruleId"] for x in results}, {
                "PCZT-TRANSPARENT-OUTPUTS", "PCZT-STRUCTURE-DRIFT",
            })

    def test_optional_sarif_clean_output_and_reporting_only(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            dest = Path(temp) / "report.sarif"
            relative = dest.relative_to(ROOT).as_posix()
            status, report = check(self.env(
                "apps/web/public/examples/clean-v6.bin", ZERYNEX_SARIF_OUTPUT=relative,
            ))
            self.assertEqual(status, 0)
            self.assertTrue(report["passed"])
            self.assertEqual(json.loads(dest.read_text())["runs"][0]["results"], [])
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            dest = Path(temp) / "report.sarif"
            status, report = check(self.env(
                "apps/web/public/examples/transparent-v6.bin",
                ZERYNEX_FAIL_ON_FINDINGS="false",
                ZERYNEX_SARIF_OUTPUT=dest.relative_to(ROOT).as_posix(),
            ))
            self.assertEqual(status, 0)
            self.assertFalse(report["passed"])
            self.assertFalse(json.loads(dest.read_text())["runs"][0]["properties"]["zerynexPassed"])

    def test_action_main_writes_safe_sarif_artifact_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            root = Path(temp)
            relative = (root / "result.sarif").relative_to(ROOT).as_posix()
            output = root / "github-output"
            summary = root / "github-summary"
            env = self.env(
                "apps/web/public/examples/transparent-v6.bin",
                ZERYNEX_SARIF_OUTPUT=relative,
                ZERYNEX_FAIL_ON_FINDINGS="false",
                GITHUB_OUTPUT=str(output),
                GITHUB_STEP_SUMMARY=str(summary),
            )
            with patch.dict(os.environ, env, clear=True), contextlib.redirect_stdout(io.StringIO()) as stdout:
                status = main()
            self.assertEqual(status, 0)
            self.assertIn("sarif_path=" + relative, output.read_text())
            self.assertIn("passed=false", output.read_text())
            self.assertIn("PCZT-TRANSPARENT-OUTPUTS", summary.read_text())
            self.assertNotIn("transparent-v6.bin", (root / "result.sarif").read_text())
            self.assertNotIn("/home/laughter", (root / "result.sarif").read_text())
            self.assertNotIn("synthetic-only", stdout.getvalue())

    def test_sarif_output_rejects_unsafe_paths(self):
        for name in ("../outside.sarif", "/tmp/private.sarif", "reports/../bad.sarif",
                     "report.json", "report.sarif\nmarker", "report.SARIF", "nested/missing.sarif"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                safe_sarif_destination(ROOT, name)
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            directory = Path(temp)
            outside = Path(tempfile.gettempdir())
            link = directory / "symlinked"
            link.symlink_to(outside, target_is_directory=True)
            with self.assertRaises(ValueError):
                safe_sarif_destination(ROOT, (link / "bad.sarif").relative_to(ROOT).as_posix())
            target = directory / "old.sarif"
            target.write_text('some existing private contents')
            with self.assertRaises(ValueError):
                safe_sarif_destination(ROOT, target.relative_to(ROOT).as_posix())
        with self.assertRaises(ValueError):
            check(self.env("", ZERYNEX_SCENARIO_MANIFEST="tests/fixtures/role-handoff/scenario.json",
                           ZERYNEX_SARIF_OUTPUT="zerynex.sarif"))

    def test_malformed_input_never_appears_in_error(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            test_path = Path(temp) / "synthetic.pczt"
            test_path.write_bytes(b"SYNTHETIC_TEST_SECRET_NOT_REAL")
            with self.assertRaises(ValueError) as ctx:
                check(self.env(str(test_path)))
            self.assertNotIn("SYNTHETIC_TEST_SECRET_NOT_REAL", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
