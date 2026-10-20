#!/usr/bin/env python3
"""Install the pure Python SDK wheel from a clean consumer virtualenv.

The wheel intentionally delegates to the separately installed, trusted
Rust CLI. Optional MCP dependencies are only needed by MCP users.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import venv

ROOT = Path(__file__).resolve().parents[1]


def check_wheel(folder: Path, cli: Path) -> None:
    wheels = list(folder.glob("zerynex_python-*.whl"))
    if len(wheels) != 1:
        raise AssertionError("Expected exactly one built Python wheel.")
    with tempfile.TemporaryDirectory(prefix="zerynex-python-consumer-") as directory:
        venv_dir = Path(directory) / "venv"
        venv.EnvBuilder(with_pip=True).create(venv_dir)
        python = venv_dir / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
        subprocess.run([str(python), "-m", "pip", "install", "--no-index", "--no-deps",
                        str(wheels[0].resolve())], check=True, capture_output=True, timeout=60)
        code = (
            "import sys;from pathlib import Path;"
            "from zerynex_py import ZerynexClient,Policy;"
            "client=ZerynexClient(cli=Path(sys.argv[1]));"
            "report=client.analyze_file(Path(sys.argv[2]),Policy(deny_transparent=True));"
            "assert not report.passed;"
            "assert any(f.rule=='PCZT-TRANSPARENT-OUTPUTS' for f in report.findings);"
            "print('PACKED PYTHON CONSUMER PASS: real Rust CLI and source-free wheel')"
        )
        completed = subprocess.run([str(python), "-c", code,
            str(cli.resolve()), str((ROOT / "apps/web/public/examples/transparent-v6.bin").resolve())],
            capture_output=True, text=True, timeout=25, check=True)
        print(completed.stdout.strip())
        metadata_code = (
            "import json,sys;from pathlib import Path;"
            "from zerynex_py import ZerynexClient,bundled_rule_catalog;"
            "r=ZerynexClient(cli=Path(sys.argv[1])).rule_catalog();"
            "assert r==bundled_rule_catalog();"
            "assert len(r['rules'])==8 and r['rule_set_version']=='1.0.0';"
            "print('PACKED RULE REGISTRY PASS: canonical Rust and installed Python metadata agree')"
        )
        metadata = subprocess.run([str(python), "-c", metadata_code, str(cli.resolve())],
                                  capture_output=True, text=True, check=True, timeout=25)
        print(metadata.stdout.strip())
        checker = venv_dir / ("Scripts/zerynex-rpc-check.exe" if sys.platform == "win32" else "bin/zerynex-rpc-check")
        if not checker.is_file():
            raise AssertionError("RPC checker CLI was not installed from the wheel")
        offline = subprocess.run([
            str(checker),
            "--schema", str((ROOT / "tests/fixtures/rpc/zallet-pczt-lifecycle-synthetic-openrpc.json").resolve()),
            "--contract", str((ROOT / "tests/fixtures/rpc/zallet-pczt-lifecycle-contract.json").resolve()),
            "--deny-new-required", "--json",
        ], capture_output=True, text=True, timeout=25, check=True)
        report = json.loads(offline.stdout)
        if report.get("passed") is not True or report.get("checked_methods") != 7 or report.get("deny_new_required") is not True:
            raise AssertionError("Installed RPC CLI returned an unexpected capability contract")
        print("PACKED RPC CONSUMER PASS: installed wheel CLI validates seven synthetic methods")
        # Real package consumer must expose the standalone local-only Zcash
        # infrastructure adapter, not just monorepo module imports.
        node_checker = venv_dir / ("Scripts/zerynex-node-check.exe" if sys.platform == "win32" else "bin/zerynex-node-check")
        if not node_checker.is_file():
            raise AssertionError("Local Zcash node probe is absent from installed wheel")
        node_help = subprocess.run([str(node_checker), "--help"],
                                   capture_output=True, text=True, timeout=10, check=True)
        if '--expect-network' not in node_help.stdout or '--cookie-file' not in node_help.stdout:
            raise AssertionError("Installed node probe lacks operator safety controls")
        vectors_code = (
            "import json,sys;from zerynex_py import evaluate_blockchain_info;"
            "f=json.load(open(sys.argv[1]));"
            "assert f['schema_version']==1;"
            "assert all(evaluate_blockchain_info(x['result'],expected_network=x['expected_network']).ready==x['ready'] for x in f['cases']);"
            "print('PACKED NODE READINESS PASS: installed wheel parses nine shared Zcash node vectors')"
        )
        vector_check = subprocess.run([str(python),'-c',vectors_code,
           str((ROOT/'tests/fixtures/node/chain-readiness.json').resolve())],
           capture_output=True,text=True,timeout=10,check=True)
        print(vector_check.stdout.strip())
        preflight = venv_dir / ("Scripts/zerynex-agent-preflight.exe" if sys.platform == "win32" else "bin/zerynex-agent-preflight")
        if not preflight.is_file():
            raise AssertionError("Developer preflight was not installed from the wheel")
        completed = subprocess.run([
            str(preflight), "--cli", str(cli.resolve()),
            "--fixtures", str((ROOT / "apps/web/public/examples").resolve()), "--json",
        ], capture_output=True, text=True, timeout=30, check=True)
        result = json.loads(completed.stdout)
        if (result.get("passed") is not True or result.get("synthetic_only") is not True or
                result.get("checks", {}).get("synthetic_pczt_suite", {}).get("matched") != 4 or
                result.get("checks", {}).get("synthetic_refund_privacy", {}).get("matched") != 6):
            raise AssertionError("Installed developer preflight did not validate Rust-backed synthetic fixtures")
        project_cli = venv_dir / ("Scripts/zerynex-project.exe" if sys.platform == "win32" else "bin/zerynex-project")
        if not project_cli.is_file():
            raise AssertionError("Project bootstrap missing from wheel")
        external = Path(directory) / "third-party-zcash-project"
        external.mkdir()
        created = subprocess.run([str(project_cli), "init", "--project", str(external), "--ci", "--json"], capture_output=True, text=True, timeout=20, check=True)
        assert json.loads(created.stdout)["ci_configured"] is True
        assert "Oluwa-Laughter/zerynex@8dcbbba" in (external / ".github/workflows/zerynex-privacy.yml").read_text()
        checked = subprocess.run([str(project_cli), "verify", "--project", str(external), "--cli", str(cli.resolve()), "--json"], capture_output=True, text=True, timeout=30, check=True)
        actual = json.loads(checked.stdout)
        assert actual["passed"] is True and actual["checks"]["transparent_detection"] is True
        print("PACKED PROJECT BOOTSTRAP PASS: separate app, bundled nonspendable fixtures, real Rust engine")
        # Exercise the new developer-supplied PCZT paths in a completely
        # unrelated app and confirm that no private paths are returned.
        from shutil import copyfile
        copyfile(external / '.zerynex/fixtures/clean-v6.bin', external / 'baseline.pczt')
        copyfile(external / '.zerynex/fixtures/transparent-v6.bin', external / 'candidate.pczt')
        base_args = ['--project', str(external), '--cli', str(cli.resolve()), '--json']
        observed = subprocess.run([str(project_cli), 'check', *base_args, '--pczt', 'candidate.pczt'],
                                  capture_output=True, text=True, timeout=20)
        assert observed.returncode == 2 and json.loads(observed.stdout)['rule_ids'] == ['PCZT-TRANSPARENT-OUTPUTS']
        assert str(external) not in observed.stdout + observed.stderr
        regression = subprocess.run([str(project_cli), 'compare', *base_args,
                                    '--before', 'baseline.pczt', '--after', 'candidate.pczt'],
                                    capture_output=True, text=True, timeout=25)
        assert regression.returncode == 2 and json.loads(regression.stdout)['added_rule_ids'] == ['PCZT-TRANSPARENT-OUTPUTS']
        assert str(external) not in regression.stdout + regression.stderr
        audit_cli = venv_dir / ("Scripts/zerynex-refund-audit.exe" if sys.platform == "win32" else "bin/zerynex-refund-audit")
        if not audit_cli.is_file():
            raise AssertionError("Refund privacy audit command missing from Python wheel")
        isolated = ROOT / "tests/fixtures/swap-refund/isolated.json"
        risky = ROOT / "tests/fixtures/swap-refund/risky.json"
        good = subprocess.run([str(audit_cli), "--manifest", str(isolated), "--json"], capture_output=True, text=True, timeout=15)
        flagged = subprocess.run([str(audit_cli), "--manifest", str(risky), "--json"], capture_output=True, text=True, timeout=15)
        if (good.returncode != 0 or flagged.returncode != 2 or
            json.loads(good.stdout)["passed"] is not True or
            "SWAP-VIEWING-SCOPE-REUSE" not in json.loads(flagged.stdout)["rule_ids"] or
            "11111111111111111111111111111111" in flagged.stdout):
            raise AssertionError("Packaged refund privacy audit failed safe and risky fixture expectations")
        print("PACKED REFUND PRIVACY AUDIT PASS: standalone wheel runs metadata-only checks")
        expanded = ROOT / "tests/fixtures/swap-refund/regression-expanded.json"
        newer = subprocess.run([str(audit_cli), "--baseline", str(risky),
                                "--manifest", str(expanded), "--json"],
                               capture_output=True, text=True, timeout=15)
        if newer.returncode != 2 or json.loads(newer.stdout).get("new_risk_events") != 1:
            raise AssertionError("Packaged refund auditor missed a new flow with an already-known rule")
        improvement = subprocess.run([str(audit_cli), "--baseline", str(risky),
                                      "--manifest", str(isolated), "--json"],
                                     capture_output=True, text=True, timeout=15)
        if improvement.returncode != 0 or json.loads(improvement.stdout).get("resolved_risk_events") != 8:
            raise AssertionError("Packaged refund auditor failed the resolution path")
        for output in (newer.stdout, improvement.stdout):
            if "11111111111111111111111111111111" in output:
                raise AssertionError("Raw opaque reference leaked in packaged refund regression")
        print("PACKED REFUND REGRESSION PASS: per-flow risk deltas, fixes and sanitized JSON")
        sarif = subprocess.run([str(audit_cli), "--baseline", str(risky),
                                "--manifest", str(expanded), "--sarif"],
                               capture_output=True, text=True, timeout=15)
        if sarif.returncode != 2:
            raise AssertionError("SARIF export did not preserve regression exit code")
        parsed_sarif = json.loads(sarif.stdout)
        if (parsed_sarif.get("version") != "2.1.0" or
                len(parsed_sarif["runs"][0]["results"]) != 1 or
                parsed_sarif["runs"][0]["results"][0]["ruleId"] != "SWAP-REFUND-LOOKUP-DISCLOSURE" or
                "11111111111111111111111111111111" in sarif.stdout):
            raise AssertionError("Installed SARIF export is malformed or includes opaque references")
        check_api = (
            "import json,sys;from zerynex_py import audit_manifest,compare_manifests,sarif_report;"
            "a=json.load(open(sys.argv[1]));b=json.load(open(sys.argv[2]));"
            "r=compare_manifests(a,b);"
            "assert r['new_risk_events']==8;"
            "assert sarif_report(r)['version']=='2.1.0';"
            "assert audit_manifest(a)['passed'] is True"
        )
        subprocess.run([str(python), "-c", check_api, str(isolated), str(risky)],
                       capture_output=True, text=True, timeout=15, check=True)
        print("PACKED REFUND SARIF & API PASS: no locations, installed Python API and CI-safe report")


        print('PACKED LOCAL PCZT PASS: explicit external-project file analysis and stage regression')

        # New MCP/refund workflow must remain bundled in a source-free wheel.
        probe = (
            "from zerynex_py.refund_workflows import "
            "synthetic_refund_audit,synthetic_refund_regression,synthetic_refund_smoke_suite;"
            "assert synthetic_refund_audit('isolated')['report']['passed'] is True;"
            "assert synthetic_refund_audit('risky')['report']['finding_count']==5;"
            "assert synthetic_refund_regression('risky','regression-expanded')['report']['new_risk_events']==1;"
            "assert synthetic_refund_smoke_suite()['matched']==6"
        )
        subprocess.run([str(python), "-c", probe], check=True, capture_output=True, text=True, timeout=15)
        print("PACKED SYNTHETIC REFUND AGENTS PASS: isolated bundle, scenarios and six preflight checks")
        print("PACKED AGENT PREFLIGHT PASS: installed wheel validates CLI, PCZT, RPC and refund privacy")
        # The public Python starter is executed by an unrelated installed
        # virtual environment; no monorepo PYTHONPATH or editable package.
        starter = ROOT / "examples/consumer-integration/python/check.py"
        examples = ROOT / "examples/consumer-integration/fixtures"
        env = dict(__import__("os").environ)
        env.pop("PYTHONPATH", None)
        def starter_run(before: str, after: str, *flags: str):
            return subprocess.run([str(python), str(starter),
                str(examples / (before + ".json")),
                str(examples / (after + ".json")), *flags],
                cwd=directory, env=env, capture_output=True, text=True, timeout=15)
        introduced = starter_run("isolated", "risky")
        if introduced.returncode != 2 or json.loads(introduced.stdout)["newRiskEvents"] != 8:
            raise AssertionError("Independent Python starter missed declared regressions")
        resolved = starter_run("risky", "isolated")
        if resolved.returncode != 0 or json.loads(resolved.stdout)["resolvedRiskEvents"] != 8:
            raise AssertionError("Independent Python starter did not classify resolved risks")
        sarif = starter_run("risky", "regression-expanded", "--sarif")
        if sarif.returncode != 2 or len(json.loads(sarif.stdout)["runs"][0]["results"]) != 1:
            raise AssertionError("Independent Python starter did not export sanitized SARIF")
        # Verify a malformed or missing manifest cannot disclose its path or contents.
        bad_manifest = Path(directory) / "invalid-private-ref.json"
        bad_manifest.write_text('{"schema_version":1,"schema_version":1,"private":"NEVER_LOG_CONSUMER_SECRET"}')
        for bad_path in (bad_manifest, Path(directory) / "missing-private-ref.json"):
            failed = subprocess.run([str(python), str(starter),
                str(examples / "isolated.json"), str(bad_path)], cwd=directory,
                env=env, capture_output=True, text=True, timeout=15)
            if failed.returncode != 1 or any(token in failed.stdout + failed.stderr for token in (
                    "NEVER_LOG_CONSUMER_SECRET", "invalid-private-ref", "missing-private-ref", "schema_version")):
                raise AssertionError("Independent Python starter failed to sanitize invalid input")
        for result in (introduced, resolved, sarif):
            if any(token in result.stdout + result.stderr for token in (
                    "11111111111111111111111111111111",
                    "22222222222222222222222222222222", "refund_address_ref")):
                raise AssertionError("Independent Python starter exposed flow references")
        print("PACKED PYTHON STARTER PASS: independent wheel, regressions and SARIF")




if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("wheels", type=Path)
    parser.add_argument("--cli", type=Path, default=ROOT / "target/debug/zerynex")
    args = parser.parse_args()
    check_wheel(args.wheels, args.cli)
