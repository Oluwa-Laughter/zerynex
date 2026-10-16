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
    policy_arg = env.get("ZERYNEX_POLICY_PATH", "")
    policy = safe_file(workspace, policy_arg, 4096) if policy_arg else None
    deny_transparent = bool_env(env, "ZERYNEX_DENY_TRANSPARENT", "true")
    deny_sapling = bool_env(env, "ZERYNEX_DENY_SAPLING", "false")
    fail_on_findings = bool_env(env, "ZERYNEX_FAIL_ON_FINDINGS", "true")
    binary = Path(env["ZERYNEX_ACTION_BIN"]).resolve(strict=True)
    if not binary.is_file():
        raise ValueError("Compiled Rust binary unavailable.")

    command = [str(binary), str(pczt), "--json", "--input-format", input_format]
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
    if not isinstance(report, dict) or not isinstance(report.get("findings"), list):
        raise ValueError("Invalid report structure.")
    findings = report["findings"]
    if len(findings) > 1000 or any(
        not isinstance(item, dict)
        or not all(isinstance(item.get(key), str) and 0 < len(item[key]) <= 500
                   for key in ("rule", "field", "explanation"))
        for item in findings
    ):
        raise ValueError("Invalid findings structure.")
    if bool(findings) != (process.returncode == 2):
        raise ValueError("Unexpected Rust report status.")
    sanitized = [{"rule": item["rule"], "field": item["field"]} for item in findings]
    return (2 if fail_on_findings and findings else 0), {
        "passed": len(findings) == 0,
        "finding_count": len(findings),
        "findings": sanitized,
    }


def main() -> int:
    try:
        status, report = check(dict(os.environ))
    except (ValueError, KeyError, OSError):
        print("::error::Zerynex could not complete local PCZT policy analysis. Check input paths and options.")
        return 1
    count = report["finding_count"]
    passed = str(report["passed"]).lower()
    outputs = os.environ.get("GITHUB_OUTPUT")
    if outputs:
        with open(outputs, "a", encoding="utf-8") as output:
            output.write(f"finding_count={count}\npassed={passed}\n")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write(f"### Zerynex PCZT policy check\n\nFindings: {count}; passed: {passed}\n\n")
            for item in report["findings"]:
                summary.write(f"- {item['rule']} at {item['field']}\n")
            summary.write("\nSelected disclosure checks only, not an anonymity proof.\n")
    print(f"Zerynex: {count} sanitized policy finding(s). Passed: {passed}.")
    return status


if __name__ == "__main__":
    sys.exit(main())
