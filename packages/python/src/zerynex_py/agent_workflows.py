"""Read-only, fixture-only developer workflows shared by MCP and SDK clients.

No caller-provided paths, transaction bytes, RPC URLs or arbitrary instructions
cross into these RPC regression scenarios. All source schemas are bundled,
synthetic, and distributed inside the verified Python wheel.
"""
from __future__ import annotations

from copy import deepcopy
from importlib.resources import files
import json
from typing import TYPE_CHECKING

from .client import ZerynexError
from .rpc_contract import ContractInputError, compare, reject_duplicate_keys

if TYPE_CHECKING:
    from pathlib import Path
    from .client import ZerynexClient

SCENARIOS = ("baseline", "missing_method", "new_required_parameter")
_CONTRACT = "zallet-pczt-lifecycle-contract.json"
_SCHEMA = "zallet-pczt-lifecycle-synthetic-openrpc.json"


def _bundled_json(name: str) -> dict:
    # Names are fixed internal constants, never derived from MCP arguments.
    try:
        resource = files("zerynex_py").joinpath("fixtures", name)
        data = resource.read_bytes()
        if not 0 < len(data) <= 64 * 1024:
            raise ValueError("invalid fixture")
        value = json.loads(data, object_pairs_hook=reject_duplicate_keys)
        if not isinstance(value, dict):
            raise ValueError("invalid fixture")
        return value
    except (OSError, ValueError, UnicodeError, RecursionError, ContractInputError):
        raise ZerynexError("Bundled synthetic RPC fixtures are unavailable.") from None


def synthetic_zallet_rpc_contract(scenario: str = "baseline") -> dict[str, object]:
    """Run a deterministic additive-breakage exercise on bundled schemas."""
    if type(scenario) is not str or scenario not in SCENARIOS:
        raise ZerynexError("Unknown synthetic RPC regression scenario.")
    schema = deepcopy(_bundled_json(_SCHEMA))
    contract = _bundled_json(_CONTRACT)
    if scenario == "missing_method":
        schema["methods"] = [item for item in schema["methods"] if item["name"] != "pczt_sign"]
    elif scenario == "new_required_parameter":
        sign = next(item for item in schema["methods"] if item["name"] == "pczt_sign")
        sign["params"].append({"name": "synthetic_new_requirement", "required": True})
    try:
        report = compare(schema, contract, deny_new_required=True)
    except (ContractInputError, KeyError, TypeError, ValueError, StopIteration):
        raise ZerynexError("Bundled RPC contract validation failed.") from None
    expected = {
        "baseline": None,
        "missing_method": ("RPC-METHOD-MISSING", "pczt_sign"),
        "new_required_parameter": ("RPC-NEW-REQUIRED-PARAMETER", "pczt_sign"),
    }[scenario]
    findings = report["findings"]
    matched = (report["passed"] is True and not findings) if expected is None else (
        report["passed"] is False and len(findings) == 1 and
        (findings[0]["rule"], findings[0]["method"]) == expected
    )
    return {
        "scenario": scenario,
        "synthetic": True,
        "contract_passed": report["passed"],
        "matched_expectation": matched,
        "checked_methods": report["checked_methods"],
        "finding_count": report["finding_count"],
        "findings": findings,
        "limitation": "Bundled synthetic OpenRPC structures only; not real Zallet RPC compatibility, transaction safety or cryptographic verification.",
    }


def core_capabilities(client: ZerynexClient) -> dict[str, object]:
    """Validate feature negotiation against the trusted Rust binary."""
    capabilities = client.capabilities()
    return {
        "schema_version": 1,
        "cli_version": capabilities.version,
        "operations": list(capabilities.operations),
        "input_formats": list(capabilities.input_formats),
        "max_decoded_pczt_bytes": capabilities.max_decoded_pczt_bytes,
        "max_policy_file_bytes": capabilities.max_policy_file_bytes,
        "network_access": False,
        "signing": False,
        "limitation": "Local CLI feature discovery only; no wallet, prover or Zallet release compatibility implied.",
    }


def developer_preflight(client: ZerynexClient, root: Path) -> dict[str, object]:
    """One aggregated, fail-closed readiness report for local agent hosts.

    The PCZT suite continues to run via the actual Rust CLI, not a Python
    reimplementation; the RPC exercise is independent and fixture-only.
    """
    # Imported here to keep the workflow shared without a module import cycle.
    from .mcp_server import evaluate_synthetic_smoke_suite

    caps = core_capabilities(client)
    suite = evaluate_synthetic_smoke_suite(client, root)
    rpc = synthetic_zallet_rpc_contract("baseline")
    rust_ready = ("analyze_pczt" in caps["operations"] and
                  "compare_pczt_stages" in caps["operations"])
    passed = rust_ready and suite["passed"] is True and rpc["matched_expectation"] is True
    return {
        "passed": passed,
        "checks": {
            "rust_capabilities": {"passed": rust_ready, "version": caps["cli_version"]},
            "synthetic_pczt_suite": {"passed": suite["passed"], "matched": suite["matched"], "total": suite["total"]},
            "synthetic_rpc_contract": {"passed": rpc["matched_expectation"], "checked_methods": rpc["checked_methods"]},
        },
        "synthetic_only": True,
        "limitation": "Developer tooling smoke test only. No live wallet, private PCZT, signing, consensus or proof guarantees.",
    }
