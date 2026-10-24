"""Offline, synthetic evidence for the opt-in local producer-fixture runner."""
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/check_zallet_pczt_fixture.py"
CLI = ROOT / "target/debug/zerynex"


@unittest.skipUnless(CLI.is_file(), "Build target/debug/zerynex for fixture consumer tests")
class FixtureHarnessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.manifest = {
            "version": 1,
            "producer": {"release": "v0.1.0-beta.3",
                         "commit": "987382f67e622915228686e9f956c6a9c9a7514c",
                         "origin": "locally-supplied-zallet-output"},
            "cases": [],
        }
        for name, source, expected in (
            ("clean.b64", "clean-v6.bin", []),
            ("transparent.b64", "transparent-v6.bin",
             [{"rule": "PCZT-TRANSPARENT-OUTPUTS", "field": "transparent.outputs"}]),
        ):
            raw = (ROOT / "apps/web/public/examples" / source).read_bytes()
            encoded = base64.b64encode(raw)
            (self.folder / name).write_bytes(encoded)
            self.manifest["cases"].append({"file": name, "sha256": hashlib.sha256(encoded).hexdigest(),
                                           "deny_transparent": True, "expect": expected})

    def execute(self):
        (self.folder / "manifest.json").write_text(json.dumps(self.manifest))
        return subprocess.run([sys.executable, str(SCRIPT), "--manifest",
                               str(self.folder / "manifest.json"), "--cli", str(CLI)],
                              capture_output=True, text=True, timeout=40)

    def test_positive_and_negative_policy_cases_are_sanitized(self):
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertTrue(report["passed"])
        self.assertEqual([case["finding_count"] for case in report["cases"]], [0, 1])
        self.assertIn("not authenticated", report["evidence"])
        self.assertNotIn("transparent.b64", result.stdout)

    def test_expectation_mismatch_has_distinct_exit(self):
        self.manifest["cases"][1]["expect"] = []
        result = self.execute()
        self.assertEqual(result.returncode, 2)
        self.assertFalse(json.loads(result.stdout)["passed"])

    def test_rejects_ambiguous_manifest_and_path_escape(self):
        self.manifest["cases"][0]["file"] = "../private.b64"
        self.assertEqual(self.execute().returncode, 1)
        (self.folder / "manifest.json").write_text('{"version":1,"version":1}')
        result = subprocess.run([sys.executable, str(SCRIPT), "--manifest",
                                 str(self.folder / "manifest.json"), "--cli", str(CLI)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)

    def test_rejects_wrong_release_and_unicode_duplicate_keys(self):
        self.manifest["producer"]["commit"] = "0" * 40
        self.assertEqual(self.execute().returncode, 1)
        (self.folder / "manifest.json").write_text('{"version":1,"v\\u0065rsion":1}')
        result = subprocess.run([sys.executable, str(SCRIPT), "--manifest",
                                 str(self.folder / "manifest.json"), "--cli", str(CLI)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)

    def test_rejects_malformed_analyzer_report_without_echo(self):
        fake = self.folder / "fake-cli"
        fake.write_text("#!/usr/bin/env python3\nprint('{\"findings\":\"PRIVATE_MARKER\"}')\n")
        fake.chmod(0o700)
        (self.folder / "manifest.json").write_text(json.dumps(self.manifest))
        result = subprocess.run([sys.executable, str(SCRIPT), "--manifest",
                                 str(self.folder / "manifest.json"), "--cli", str(fake)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("PRIVATE_MARKER", result.stdout + result.stderr)

    def test_rejects_altered_noncanonical_and_symlink_fixtures_without_echo(self):
        target = self.folder / "clean.b64"
        target.write_bytes(target.read_bytes() + b"PRIVATE_MARKER")
        result = self.execute()
        self.assertEqual(result.returncode, 1)
        self.assertNotIn("PRIVATE_MARKER", result.stdout + result.stderr)
        payload = (self.folder / "transparent.b64").read_bytes()
        target.write_bytes(payload + b"\n")
        self.manifest["cases"][0]["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
        self.assertEqual(self.execute().returncode, 1)
        target.unlink()
        target.symlink_to(self.folder / "transparent.b64")
        self.assertEqual(self.execute().returncode, 1)


if __name__ == "__main__":
    unittest.main()
