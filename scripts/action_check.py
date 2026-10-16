#!/usr/bin/env python3
"""Local, dependency-free GitHub Action policy runner.

Only sanitized rule identifiers and field paths reach GitHub outputs or logs.
The PCZT itself never leaves the runner through this program.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


def safe_file(workspace: Path, name: str, max_bytes: int) -> Path:
    if not isinstance(name, str) or not name or name.strip() != name or name == "-":
        raise ValueError("Specify a fixture in the checked-out repository.")
    if "\x00" in name:
        raise ValueError("Invalid input path.")
    candidate = Path(name)
    if not candidate.is_absolute():
        candidate = workspace / candidate
    try:
        resolved = candidate.resolve(strict=True)
    except (OSError, RuntimeError):
        raise ValueError("Cannot find input.") from None
    if (not resolved.is_relative_to(workspace) or not resolved.is_file()
            or candidate.is_symlink()):
        raise ValueError("Inputs must be regular files in the checked-out repository.")
    if not 0 < resolved.stat().st_size <= max_bytes:
        raise ValueError("Input is empty or exceeds the size limit.")
    return resolved


def bool_env(env: dict[str, str], name: str, default: str) -> bool:
    value = env.get(name, default).lower()
    if value not in ("true", "false"):
        raise ValueError("Expected true or false.")
    return value == "true"


def check(env: dict[str, str]) -> tuple[int, dict[str, object]]:
    workspace = Path(env["GITHUB_WORKSPACE"]).resolve(strict=True)
    pczt = safe_file(workspace, env["ZERYNEX_PCZT_PATH"], 12 * 1024 * 1024)
    input_format = env.get("ZERYNEX_INPUT_FORMAT", "binary")
    if input_format not in ("binary", "base64"):
        raise ValueError("Input format must be binary or base64.")
    baseline_arg = env.get("ZERYNEX_BASELINE_PATH", "")
    baseline = safe_file(workspace, baseline_arg, 12 * 1024 * 1024) if baseline_arg else None
    policy_arg = env.get("ZERYNEX_POLICY_PATH", "")
    policy = safe_file(workspace, policy_arg, 4096) if policy_arg else None
    deny_transparent = bool_env(env, "ZERYNEX_DENY_TRANSPARENT", "true")
    deny_sapling = bool_env(env, "ZERYNEX_DENY_SAPLING", "false")
    fail_on_findings = bool_env(env, "ZERYNEX_FAIL_ON_FINDINGS", "true")
    binary = Path(env["ZERYNEX_ACTION_BIN"]).resolve(strict=True)
    if not binary.is_file():
        raise ValueError("Compiled Rust binary unavailable.")

    command = [str(binary), str(baseline) if baseline else str(pczt),
               "--json", "--input-format", input_format]
    if baseline:
        command.extend(["--compare-with", str(pczt)])
    if policy:
        command.extend(["--policy-file", str(policy)])
    if deny_transparent:
        command.append("--deny-transparent")
    if deny_sapling:
        command.append("--deny-sapling")
    try:
        process = subprocess.run(command, stdin=subprocess.DEVNULL,
                                 capture_output=True, timeout=40)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError("Rust check failed or timed out.") from None
    if process.returncode not in (0, 2) or len(process.stdout) > 256 * 1024:
        raise ValueError("Rust PCZT check failed.")
    try:
        report = json.loads(process.stdout)
    except (TypeError, ValueError):
        raise ValueError("Invalid Rust report.") from None

    if not isinstance(report, dict):
        raise ValueError("Invalid report structure.")
    if baseline:
        added = report.get("added_findings")
        changes = report.get("component_deltas")
        if not isinstance(added, list) or not isinstance(changes, list):
            raise ValueError("Invalid stage comparison report.")
        if len(added) > 1000 or len(changes) > 6:
            raise ValueError("Too many findings.")
        findings = [
            {"rule": item.get("rule"), "field": item.get("field")}
            for item in added if isinstance(item, dict)
        ]
        findings += [
            {"rule": "PCZT-STRUCTURE-DRIFT", "field": item.get("component")}
            for item in changes if isinstance(item, dict)
        ]
        passed = report.get("passed")
        current_count = report.get("after_findings_count")
        if type(passed) is not bool or type(current_count) is not int or not 0 <= current_count <= 1000:
            raise ValueError("Invalid stage status.")
        if len(findings) != len(added) + len(changes):
            raise ValueError("Invalid stage findings.")
    else:
        findings = report.get("findings")
        if not isinstance(findings, list) or len(findings) > 1000:
            raise ValueError("Invalid findings structure.")
        passed = not findings
        current_count = len(findings)
    if any(
        not isinstance(item, dict)
        or not all(isinstance(item.get(key), str) and 0 < len(item[key]) <= 500
                   for key in ("rule", "field"))
        for item in findings
    ):
        raise ValueError("Invalid findings structure.")
    if passed != (process.returncode == 0):
        raise ValueError("Rust findings and exit code disagree.")
    sanitized = [{"rule": item["rule"], "field": item["field"]} for item in findings]
    return (2 if fail_on_findings and not passed else 0), {
        "passed": passed,
        "finding_count": current_count,
        "regression_count": len(sanitized) if baseline else 0,
        "findings": sanitized,
    }


def main() -> int:
    try:
        status, report = check(dict(os.environ))
    except (ValueError, KeyError, OSError):
        print("::error::Zerynex could not complete local PCZT policy analysis. Check input paths and options.")
        return 1
    count = report["finding_count"]
    regressions = report["regression_count"]
    passed = str(report["passed"]).lower()
    outputs = os.environ.get("GITHUB_OUTPUT")
    if outputs:
        with open(outputs, "a", encoding="utf-8") as output:
            output.write(f"finding_count={count}\nregression_count={regressions}\npassed={passed}\n")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write(f"### Zerynex PCZT policy check\n\nCurrent findings: {count}; regression observations: {regressions}; passed: {passed}\n\n")
            for item in report["findings"]:
                summary.write(f"- {item['rule']} at {item['field']}\n")
            summary.write("\nSelected disclosure checks only, not an anonymity proof.\n")
    print(f"Zerynex: {count} current finding(s); {regressions} stage regression observation(s). Passed: {passed}.")
    return status


if __name__ == "__main__":
    sys.exit(main())
