"""Local-only, read-only MCP adapter for *approved synthetic fixtures*.

No raw PCZT bytes, passwords, mnemonic phrases or viewing keys are returned to
the agent. No transaction creation, signing, network API, or generic host file
reader is exposed.
"""
from __future__ import annotations

import os
from pathlib import Path
import re

from .client import Policy, ZerynexClient, ZerynexError

SAFE_NAME = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,79}\.bin$", re.ASCII)


def allowed_fixture(root: Path, fixture_name: str) -> Path:
    """Permit a single simple .bin filename under an explicitly selected root."""
    if not isinstance(fixture_name, str) or not SAFE_NAME.fullmatch(fixture_name):
        raise ZerynexError("Only an approved synthetic fixture filename is allowed.")
    if not root.is_dir():
        raise ZerynexError("The configured synthetic fixture directory is unavailable.")
    base = root.expanduser().resolve(strict=True)
    candidate = base / fixture_name
    if candidate.is_symlink():
        raise ZerynexError("Symlink fixtures are not allowed.")
    try:
        checked = candidate.resolve(strict=True)
    except OSError:
        raise ZerynexError("The selected fixture is unavailable.") from None
    if not checked.is_relative_to(base) or not checked.is_file():
        raise ZerynexError("The selected fixture is outside the allowed directory.")
    return checked


def scan_fixture(
    client: ZerynexClient,
    root: Path,
    fixture_name: str,
    profile: str = "external_signer",
    deny_transparent: bool = True,
    deny_sapling: bool = False,
) -> dict[str, object]:
    """Pure handler used by MCP and unit tests; no LLM or network dependency."""
    if profile not in ("external_signer", "restricted_handoff"):
        raise ZerynexError("Unsupported privacy profile.")
    if type(deny_transparent) is not bool or type(deny_sapling) is not bool:
        raise ZerynexError("Privacy policy flags must be booleans.")
    safe = allowed_fixture(root, fixture_name)
    policy = Policy(
        profile=profile,
        deny_transparent=deny_transparent,
        deny_sapling=deny_sapling,
    )
    report = client.analyze_file(safe, policy)
    return report.agent_summary()


def create_server(client: ZerynexClient, root: Path):
    """Bind MCP tools only after the operator explicitly supplies a fixture root."""
    try:
        from mcp.server import MCPServer
    except ImportError:
        raise ZerynexError("Install the optional MCP dependency: pip install 'zerynex-python[mcp]'") from None

    server = MCPServer("Zerynex Local Privacy Checks")

    @server.tool()
    def analyze_synthetic_pczt(
        fixture_name: str,
        profile: str = "external_signer",
        deny_transparent: bool = True,
        deny_sapling: bool = False,
    ) -> dict:
        """Analyze an approved synthetic PCZT filename. Return only limited, sanitized Rust policy findings. No wallet access."""
        try:
            return scan_fixture(client, root, fixture_name, profile, deny_transparent, deny_sapling)
        except ZerynexError:
            return {"error": "Fixture was rejected or the local analysis failed. Review root and policy settings."}

    @server.tool()
    def zerynex_policy_schema() -> dict:
        """Describe supported Zcash disclosure checks without accessing private files."""
        return {
            "profiles": ["external_signer", "restricted_handoff"],
            "flags": {
                "deny_transparent": "Prohibit transparent inputs and outputs.",
                "deny_sapling": "Prohibit Sapling spends and outputs.",
            },
            "default_agent_policy": {
                "profile": "external_signer",
                "deny_transparent": True,
                "deny_sapling": False,
            },
            "restrictions": "Synthetic fixtures only. Read-only. Does not access arbitrary paths or sign transactions.",
            "limitations": "A pass is not a proof of privacy or Zcash consensus validity.",
        }

    return server


def main() -> None:
    root_text = os.environ.get("ZERYNEX_AGENT_ALLOWED_ROOT")
    if not root_text:
        # Keep stderr output generic; never expose environment variable values.
        raise SystemExit("Set ZERYNEX_AGENT_ALLOWED_ROOT to a dedicated synthetic-fixture directory.")
    try:
        root = Path(root_text).expanduser().resolve(strict=True)
        if not root.is_dir():
            raise ZerynexError("Fixture root is not a directory.")
        client = ZerynexClient()
        server = create_server(client, root)
    except (ZerynexError, OSError):
        raise SystemExit("Cannot start safe local Zerynex agent server.") from None
    # Official MCP SDK uses local stdio by default; no network listener.
    server.run()


if __name__ == "__main__":
    main()
