"""Protocol-level test using the official MCP Python SDK's in-memory Client."""
import asyncio
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages" / "python" / "src"))

try:
    from mcp import Client
except ImportError:
    Client = None

from zerynex_py import ZerynexClient
from zerynex_py.mcp_server import create_server


@unittest.skipIf(Client is None, "Optional MCP SDK not installed")
class McpProtocolTests(unittest.TestCase):
    def test_registered_tools_and_safe_synthetic_scan(self):
        async def check():
            server = create_server(
                ZerynexClient(cli=ROOT / "target" / "debug" / "zerynex"),
                ROOT / "apps" / "web" / "public" / "examples",
            )
            async with Client(server, raise_exceptions=True) as client:
                response = await client.call_tool("zerynex_policy_schema", {})
                self.assertIn("deny_transparent", str(response))
                tools = await client.list_tools()
                discovered = {item.name for item in tools.tools}
                self.assertEqual(len(discovered), 10)
                self.assertIn("run_synthetic_smoke_suite", discovered)
                self.assertIn("list_synthetic_fixtures", discovered)
                listed = await client.call_tool("list_synthetic_fixtures", {})
                self.assertIn("transparent-v6.bin", str(listed))
                self.assertNotIn("scenario.json", str(listed))
                guidance = await client.call_tool("explain_zerynex_rule", {"rule_id": "PCZT-TRANSPARENT-OUTPUTS"})
                self.assertIn("output", str(guidance).lower())
                unknown = await client.call_tool("explain_zerynex_rule", {"rule_id": "../malicious_instruction"})
                self.assertIn("Unknown", str(unknown))
                self.assertNotIn("malicious_instruction", str(unknown))
                catalog = await client.call_tool("zerynex_rule_catalog", {})
                self.assertIn('"rule_set_version": "1.0.0"', str(catalog))
                self.assertIn("PCZT-STRUCTURE-DRIFT", str(catalog))
                caps = await client.call_tool("zerynex_core_capabilities", {})
                self.assertIn("compare_pczt_stages", str(caps))
                baseline = await client.call_tool("check_synthetic_zallet_rpc_contract", {})
                self.assertIn('"contract_passed": true', str(baseline))
                negative = await client.call_tool("check_synthetic_zallet_rpc_contract", {"scenario": "new_required_parameter"})
                self.assertIn("RPC-NEW-REQUIRED-PARAMETER", str(negative))
                self.assertIn('"matched_expectation": true', str(negative))
                denied_rpc = await client.call_tool("check_synthetic_zallet_rpc_contract", {"scenario": "../../wallet.json"})
                self.assertIn("rejected", str(denied_rpc))
                self.assertNotIn("wallet.json", str(denied_rpc))
                ready = await client.call_tool("run_zerynex_developer_preflight", {})
                self.assertIn('"passed": true', str(ready))
                self.assertIn('"synthetic_only": true', str(ready))
                suite = await client.call_tool("run_synthetic_smoke_suite", {})
                self.assertIn('"passed": true', str(suite))
                self.assertIn('"matched": 4', str(suite))
                result = await client.call_tool(
                    "analyze_synthetic_pczt",
                    {"fixture_name": "transparent-v6.bin"},
                )
                visible = str(result)
                self.assertIn("PCZT-TRANSPARENT-OUTPUTS", visible)
                self.assertNotIn("pczt_bytes", visible)
                self.assertNotIn("synthetic-only", visible)
                comparison = await client.call_tool(
                    "compare_synthetic_pczt_stages",
                    {"baseline_name": "clean-v6.bin", "candidate_name": "flagged-v6.bin"},
                )
                self.assertIn("PCZT-GLOBAL-METADATA", str(comparison))
                self.assertNotIn("synthetic-only", str(comparison))
                self.assertNotIn("pczt_bytes", str(comparison))
                rejected = await client.call_tool(
                    "compare_synthetic_pczt_stages",
                    {"baseline_name": "../clean-v6.bin", "candidate_name": "flagged-v6.bin"},
                )
                self.assertIn("rejected", str(rejected))
                denied = await client.call_tool(
                    "analyze_synthetic_pczt",
                    {"fixture_name": "../transparent-v6.bin"},
                )
                self.assertIn("rejected", str(denied))
        asyncio.run(check())


@unittest.skipIf(Client is None, "Optional MCP SDK not installed")
class McpStdioSubprocessTests(unittest.TestCase):
    def test_actual_standalone_mcp_process(self):
        import os
        from mcp.client.stdio import StdioServerParameters
        cli = ROOT / "target" / "debug" / "zerynex"
        if not cli.is_file():
            self.skipTest("Build the trusted Rust CLI before stdio integration tests.")
        async def check():
            params = StdioServerParameters(
                command=sys.executable,
                args=["-m", "zerynex_py.mcp_server"],
                env={
                    "PYTHONPATH": str(ROOT / "packages/python/src"),
                    "ZERYNEX_CLI": str(cli),
                    "ZERYNEX_AGENT_ALLOWED_ROOT": str(ROOT / "apps/web/public/examples"),
                },
            )
            async with Client(params, raise_exceptions=True, read_timeout_seconds=25) as client:
                tools = await client.list_tools()
                self.assertEqual(len(tools.tools), 10)
                ready = await client.call_tool("run_zerynex_developer_preflight", {})
                self.assertIn('"passed": true', str(ready))
                regression = await client.call_tool("check_synthetic_zallet_rpc_contract", {"scenario": "missing_method"})
                self.assertIn("RPC-METHOD-MISSING", str(regression))
                response = await client.call_tool("run_synthetic_smoke_suite", {})
                self.assertIn('"passed": true', str(response))
                bad = await client.call_tool("analyze_synthetic_pczt", {"fixture_name":"../../secret.bin"})
                self.assertIn("rejected", str(bad))
                discovery = await client.call_tool("list_synthetic_fixtures", {})
                self.assertIn("clean-v6.bin", str(discovery))
        asyncio.run(check())
