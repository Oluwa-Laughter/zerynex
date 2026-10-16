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
