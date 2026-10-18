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


def compare_synthetic_fixtures(
    client: ZerynexClient,
    root: Path,
    baseline_name: str,
    candidate_name: str,
    profile: str = "external_signer",
    deny_transparent: bool = True,
    deny_sapling: bool = False,
) -> dict[str, object]:
    """Compare only two explicitly approved synthetic PCZT fixture basenames."""
    if profile not in ("external_signer", "restricted_handoff"):
        raise ZerynexError("Unsupported privacy profile.")
    if type(deny_transparent) is not bool or type(deny_sapling) is not bool:
        raise ZerynexError("Privacy policy flags must be booleans.")
    baseline = allowed_fixture(root, baseline_name)
    candidate = allowed_fixture(root, candidate_name)
    report = client.compare_files(
        baseline,
        candidate,
        Policy(
            profile=profile,
            deny_transparent=deny_transparent,
            deny_sapling=deny_sapling,
        ),
    )
    return report.agent_summary()



# Fixed explanations are intentionally free from fixture bytes or agent-supplied
# instructions. The authoritative result still comes from the Rust analyzer.
RULE_GUIDANCE: dict[str, tuple[str, str]] = {
    "PCZT-DUMMY-KEY": (
        "An accessible intermediate dummy spending key was found.",
        "Review the signer/prover role boundary. Do not disclose the dummy spend key to an untrusted recipient.",
    ),
    "PCZT-GLOBAL-METADATA": (
        "A global proprietary metadata field is available at this handoff.",
        "Review the metadata's necessity and redact the field in a test workflow before external handoff.",
    ),
    "PCZT-UNREVIEWED-METADATA": (
        "A proprietary spend or output metadata field is available.",
        "Review role-specific metadata and use the upstream PCZT redactor where appropriate.",
    ),
    "PCZT-RESTRICTED-DISCLOSURE": (
        "A field blocked by the restricted handoff policy is present.",
        "Check whether the receiving role really needs this field. Restricted profiles may not suit every signer.",
    ),
    "PCZT-SAPLING-POLICY": (
        "Sapling components exist despite an application-level deny policy.",
        "Review the app-specific Sapling restriction; Sapling is not inherently forbidden by Zcash consensus.",
    ),
    "PCZT-TRANSPARENT-INPUTS": (
        "The PCZT includes transparent inputs under a shielded-only policy.",
        "Review transparent input selection and policy configuration before moving to signing.",
    ),
    "PCZT-TRANSPARENT-OUTPUTS": (
        "The PCZT includes transparent outputs under a shielded-only policy.",
        "Review output construction and destination pool selection; recheck with a synthetic fixture.",
    ),
}


def discover_synthetic_fixtures(root: Path) -> dict[str, object]:
    """List a bounded subset of approved, regular .bin files without reading bytes."""
    try:
        base = root.expanduser().resolve(strict=True)
        if not base.is_dir():
            raise OSError("invalid")
        names: list[str] = []
        inspected = 0
        # Avoid unbounded work on an unexpectedly large, untrusted directory.
        for path in base.iterdir():
            inspected += 1
            if inspected > 256:
                break
            if not SAFE_NAME.fullmatch(path.name) or path.is_symlink():
                continue
            if not path.is_file() or not 0 < path.stat().st_size <= 8 * 1024 * 1024:
                continue
            names.append(path.name)
        names.sort()
        return {
            "fixtures": names[:32],
            "truncated": len(names) > 32 or inspected > 256,
            "note": "Names from the explicitly approved synthetic-fixture root only; no bytes returned.",
        }
    except (OSError, ValueError):
        raise ZerynexError("Approved synthetic-fixture directory unavailable.") from None


def explain_policy_rule(rule_id: str) -> dict[str, str]:
    """Explain only enumerated rules. Never echo arbitrary agent prompt contents."""
    if not isinstance(rule_id, str) or rule_id not in RULE_GUIDANCE:
        raise ZerynexError("Unknown supported privacy rule.")
    from .rules import bundled_rule_catalog
    catalog = bundled_rule_catalog()
    definition = next((item for item in catalog['rules'] if item['id'] == rule_id), None)
    if definition is None:
        raise ZerynexError("Unknown supported privacy rule.")
    meaning, next_step = RULE_GUIDANCE[rule_id]
    return {
        "rule": rule_id,
        "severity": definition["severity"],
        "category": definition["category"],
        "rule_set_version": catalog["rule_set_version"],
        "meaning": meaning,
        "suggested_review": next_step,
        "limitation": "Policy guidance, not a complete security review or cryptographic verification.",
    }


def evaluate_synthetic_smoke_suite(client: ZerynexClient, root: Path) -> dict[str, object]:
    """Prove that scan + compare tool paths work with an approved bundled suite.

    Expected failures are *successful test detections*. Never return file
    contents, external absolute paths or CLI error details.
    """
    tests: list[dict[str, object]] = []

    for name, expected_rules in (
        ("clean-v6.bin", ()),
        ("transparent-v6.bin", ("PCZT-TRANSPARENT-OUTPUTS",)),
        ("flagged-v6.bin", ("PCZT-GLOBAL-METADATA",)),
    ):
        try:
            result = scan_fixture(client, root, name)
            found = sorted({finding["rule"] for finding in result["findings"]})
            matched = found == sorted(expected_rules) and result["passed"] == (not expected_rules)
        except (ZerynexError, OSError):
            found = []
            matched = False
        tests.append({
            "scenario": name.removesuffix(".bin"),
            "matched_expectation": matched,
            "detected_rules": found,
        })

    try:
        changes = compare_synthetic_fixtures(
            client, root, "clean-v6.bin", "flagged-v6.bin"
        )
        added = sorted({finding["rule"] for finding in changes["added_findings"]})
        matched = (
            added == ["PCZT-GLOBAL-METADATA"] and
            changes["no_new_findings"] is False and
            changes["passed"] is False
        )
    except (ZerynexError, OSError):
        added = []
        matched = False
    tests.append({
        "scenario": "clean-to-flagged",
        "matched_expectation": matched,
        "detected_rules": added,
    })
    matched_count = sum(case["matched_expectation"] is True for case in tests)
    return {
        "passed": matched_count == len(tests),
        "matched": matched_count,
        "total": len(tests),
        "tests": tests,
        "limitation": "Only approved synthetic PCZT fixtures. Checks policy invariants, not proofs or consensus.",
    }


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
    def compare_synthetic_pczt_stages(
        baseline_name: str,
        candidate_name: str,
        profile: str = "external_signer",
        deny_transparent: bool = True,
        deny_sapling: bool = False,
    ) -> dict:
        """Compare two approved synthetic PCZT fixtures locally. Returns sanitized changes, never raw data or cryptographic guarantees."""
        try:
            return compare_synthetic_fixtures(
                client,
                root,
                baseline_name,
                candidate_name,
                profile,
                deny_transparent,
                deny_sapling,
            )
        except ZerynexError:
            return {"error": "Fixture was rejected or the local stage comparison failed."}

    @server.tool()
    def list_synthetic_fixtures() -> dict:
        """Discover permitted synthetic .bin fixture basenames; never read or return their contents."""
        try:
            return discover_synthetic_fixtures(root)
        except ZerynexError:
            return {"error": "Cannot inspect the approved fixture directory."}

    @server.tool()
    def explain_zerynex_rule(rule_id: str) -> dict:
        """Get reviewed plain-language interpretation and suggested developer follow-up for a known Zerynex rule."""
        try:
            return explain_policy_rule(rule_id)
        except ZerynexError:
            return {"error": "Unknown supported Zerynex policy rule."}

    @server.tool()
    def run_synthetic_smoke_suite() -> dict:
        """Run four local Rust-backed fixture checks and report which expected findings matched. Test failures stay failures."""
        return evaluate_synthetic_smoke_suite(client, root)

    @server.tool()
    def zerynex_core_capabilities() -> dict:
        """Discover validated local Rust CLI operations and limits; no transaction file access."""
        from .agent_workflows import core_capabilities
        try:
            return core_capabilities(client)
        except ZerynexError:
            return {"error": "Local Rust CLI capabilities are unavailable."}

    @server.tool()
    def check_synthetic_zallet_rpc_contract(scenario: str = "baseline") -> dict:
        """Check a bundled synthetic Zallet PCZT method schema. Scenarios: baseline, missing_method, new_required_parameter. Never connects to an RPC server."""
        from .agent_workflows import synthetic_zallet_rpc_contract
        try:
            return synthetic_zallet_rpc_contract(scenario)
        except ZerynexError:
            return {"error": "Synthetic RPC regression scenario was rejected."}

    @server.tool()
    def run_zerynex_developer_preflight() -> dict:
        """Verify local CLI capabilities, four Rust synthetic PCZT checks and bundled synthetic RPC contract. No wallet access."""
        from .agent_workflows import developer_preflight
        try:
            return developer_preflight(client, root)
        except ZerynexError:
            return {"error": "Local developer preflight failed or is misconfigured."}

    @server.tool()
    def zerynex_rule_catalog() -> dict:
        """Discover the reviewed versioned Rust rule registry. Static metadata only; no wallet, keys or PCZT bytes."""
        try:
            from .rules import bundled_rule_catalog
            source = client.rule_catalog()
            reviewed = bundled_rule_catalog()
            if source != reviewed:
                return {"error": "Local Rust rule catalog differs from packaged SDK; update the trusted versions."}
            return source
        except ZerynexError:
            return {"error": "Local Rust rule catalog is unavailable or unsupported."}

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
            "restrictions": "Synthetic fixtures only. Read-only. Supports comparing two stages. Does not access arbitrary paths or sign transactions.",
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
