"""Verify a REAL local MCP stdio connection and Rust-backed synthetic suite.

A standalone diagnostic; never reads or prints transaction contents. No
HTTP service, provider account or AI model is involved.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil
import sys


async def check(server: Path, cli: Path, fixtures: Path) -> dict[str, object]:
    try:
        from mcp import Client
        from mcp.client.stdio import StdioServerParameters
    except ImportError:
        raise RuntimeError("Install the optional MCP Python SDK before running the doctor.") from None

    params = StdioServerParameters(
        command=str(server),
        args=[],
        env={
            "ZERYNEX_CLI": str(cli),
            "ZERYNEX_AGENT_ALLOWED_ROOT": str(fixtures),
        },
    )
    async with Client(params, raise_exceptions=True, read_timeout_seconds=35) as agent:
        tools = await agent.list_tools()
        names = sorted(tool.name for tool in tools.tools)
        needed = {
            "analyze_synthetic_pczt",
            "compare_synthetic_pczt_stages",
            "list_synthetic_fixtures",
            "explain_zerynex_rule",
            "run_synthetic_smoke_suite",
            "zerynex_policy_schema",
            "zerynex_core_capabilities",
            "zerynex_rule_catalog",
            "check_synthetic_zallet_rpc_contract",
            "run_zerynex_developer_preflight",
        }
        if not needed.issubset(names):
            raise RuntimeError("Local server does not expose all expected MCP capabilities.")
        registry = await agent.call_tool("zerynex_rule_catalog", {})
        rule_data = registry.structured_content
        if not isinstance(rule_data, dict):
            from mcp.types import TextContent
            blocks = [item for item in registry.content if isinstance(item, TextContent)]
            rule_data = json.loads(blocks[0].text) if len(blocks) == 1 else None
        if not isinstance(rule_data, dict) or rule_data.get("rule_set_version") != "1.0.0" or len(rule_data.get("rules", [])) != 8:
            raise RuntimeError("Installed Rust rule registry and bundled SDK are incompatible.")
        suite = await agent.call_tool("run_synthetic_smoke_suite", {})
        result = suite.structured_content
        # Some supported protocol versions return text blocks instead.
        if not isinstance(result, dict):
            from mcp.types import TextContent
            blocks = [item for item in suite.content if isinstance(item, TextContent)]
            if len(blocks) != 1:
                raise RuntimeError("Invalid structured response from the MCP tool.")
            result = json.loads(blocks[0].text)
        if not isinstance(result, dict):
            raise RuntimeError("Invalid synthetic suite response.")
        ok = result.get("passed") is True and result.get("total") == 4 and result.get("matched") == 4
        readiness = await agent.call_tool("run_zerynex_developer_preflight", {})
        preflight = readiness.structured_content
        if not isinstance(preflight, dict):
            from mcp.types import TextContent
            blocks = [item for item in readiness.content if isinstance(item, TextContent)]
            preflight = json.loads(blocks[0].text) if len(blocks) == 1 else None
        if not isinstance(preflight, dict):
            raise RuntimeError("Invalid developer preflight response.")
        regression = await agent.call_tool("check_synthetic_zallet_rpc_contract", {"scenario": "new_required_parameter"})
        drift = regression.structured_content
        if not isinstance(drift, dict):
            from mcp.types import TextContent
            blocks = [item for item in regression.content if isinstance(item, TextContent)]
            drift = json.loads(blocks[0].text) if len(blocks) == 1 else None
        if not isinstance(drift, dict):
            raise RuntimeError("Invalid regression response.")
        ready = preflight.get("passed") is True and preflight.get("synthetic_only") is True
        negative = (drift.get("contract_passed") is False and drift.get("matched_expectation") is True
                    and drift.get("finding_count") == 1)
        return {
            "connected": True,
            "tool_count": len(names),
            "tools": names,
            "suite_passed": ok,
            "suite_matched": result.get("matched", 0),
            "suite_total": result.get("total", 4),
            "preflight_passed": ready,
            "rpc_regression_detected": negative,
            "note": "MCP stdio subprocess and real Rust CLI. Synthetic inputs only.",
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Check a local Zerynex MCP server against synthetic fixtures.")
    parser.add_argument("--cli", default=os.environ.get("ZERYNEX_CLI", ""), help="Absolute path to the trusted Rust CLI")
    parser.add_argument("--fixtures", default=os.environ.get("ZERYNEX_AGENT_ALLOWED_ROOT", ""), help="Absolute synthetic-only fixture directory")
    parser.add_argument("--server", default=shutil.which("zerynex-mcp") or "", help="Absolute path to local zerynex-mcp executable")
    parser.add_argument("--json", action="store_true", help="Print a sanitized JSON outcome")
    args = parser.parse_args()
    # Avoid including user paths in errors, logs, and diagnostic output.
    if not args.cli or not args.fixtures or not args.server:
        parser.error("Provide --cli, --fixtures and --server for an explicit local setup.")
    try:
        cli, fixtures, server = (Path(path).expanduser().resolve(strict=True)
                                 for path in (args.cli, args.fixtures, args.server))
        if not cli.is_file() or not server.is_file() or not fixtures.is_dir():
            raise RuntimeError("Invalid configured local paths.")
        report = asyncio.run(check(server, cli, fixtures))
    except Exception:  # MCP transport can raise ExceptionGroup; always redact errors.
        print("Zerynex MCP connection or synthetic suite failed. Check local setup.", file=sys.stderr)
        raise SystemExit(1) from None
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print("MCP stdio: connected")
        print("Discovered tools:", report["tool_count"])
        print("Synthetic Rust checks:", str(report["suite_matched"]) + "/" + str(report["suite_total"]))
        print("Developer preflight:", "PASS" if report["preflight_passed"] else "FAIL")
        print("Synthetic RPC drift detected:", "YES" if report["rpc_regression_detected"] else "NO")
        print("Result:", "PASS" if report["suite_passed"] and report["preflight_passed"] and report["rpc_regression_detected"] else "FAIL")
    raise SystemExit(0 if report["suite_passed"] and report["preflight_passed"] and report["rpc_regression_detected"] else 2)


if __name__ == "__main__":
    main()
