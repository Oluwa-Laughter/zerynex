"""Fixed, bundled synthetic-only refund privacy MCP and preflight workflows.

No caller-controlled filesystem paths, arbitrary manifests, real wallet refs or
private PCZT data cross the agent trust boundary.
"""
from __future__ import annotations

from importlib.resources import files
import json

from .client import ZerynexError
from .refund_privacy import audit_manifest, compare_manifests, RefundAuditInputError

SCENARIOS = ("isolated", "risky", "regression-expanded")
FIXTURE_FILES = {
    "isolated": "refund-isolated.json",
    "risky": "refund-risky.json",
    "regression-expanded": "refund-regression-expanded.json",
}
LIMITATION = (
    "Bundled synthetic and self-declared metadata only. No wallet, refund, viewing "
    "keys, private information retrieval, quantum protection, or actual chain data."
)


def _load_scenario(scenario: str) -> dict[str, object]:
    if type(scenario) is not str or scenario not in FIXTURE_FILES:
        raise ZerynexError("Only reviewed synthetic refund scenarios are allowed.")
    try:
        raw = files("zerynex_py").joinpath("fixtures", FIXTURE_FILES[scenario]).read_bytes()
        if len(raw) > 64 * 1024 or not raw:
            raise ValueError("bad resource")
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError("duplicate")
                result[key] = value
            return result
        value = json.loads(raw, object_pairs_hook=unique)
        if type(value) is not dict:
            raise ValueError("bad data")
        return value
    except (OSError, UnicodeError, ValueError, TypeError):
        raise ZerynexError("Bundled synthetic refund scenario unavailable.") from None


def synthetic_refund_audit(scenario: str = "isolated") -> dict[str, object]:
    """Return only a sanitized report on one of three known test scenarios."""
    data = _load_scenario(scenario)
    try:
        report = audit_manifest(data)
    except RefundAuditInputError:
        raise ZerynexError("Bundled synthetic refund scenario failed validation.") from None
    return {
        "scenario": scenario,
        "synthetic": True,
        "report": report,
        "limitation": LIMITATION,
    }


def synthetic_refund_regression(
    baseline: str = "risky", candidate: str = "regression-expanded"
) -> dict[str, object]:
    """Diff pre-reviewed scenarios, never expose flow tokens or arbitrary JSON."""
    left, right = _load_scenario(baseline), _load_scenario(candidate)
    try:
        report = compare_manifests(left, right)
    except RefundAuditInputError:
        raise ZerynexError("Bundled synthetic refund comparison failed validation.") from None
    return {
        "baseline": baseline,
        "candidate": candidate,
        "synthetic": True,
        "report": report,
        "limitation": LIMITATION,
    }


def synthetic_refund_smoke_suite() -> dict[str, object]:
    """Verify the known pass/fail and per-flow risk-delta expectations."""
    expected = {
        "isolated": (True, 0),
        "risky": (False, 5),
        "regression-expanded": (False, 5),
    }
    outcomes: list[dict[str, object]] = []
    for scenario, (passed, finding_count) in expected.items():
        try:
            data = synthetic_refund_audit(scenario)["report"]
            matched = data["passed"] is passed and data["finding_count"] == finding_count
        except (ZerynexError, KeyError, TypeError):
            matched = False
        outcomes.append({"scenario": scenario, "matched_expectation": matched})
    for baseline, candidate, passed, new_events in (
        ("isolated", "risky", False, 8),
        ("risky", "regression-expanded", False, 1),
        ("risky", "isolated", True, 0),
    ):
        try:
            data = synthetic_refund_regression(baseline, candidate)["report"]
            matched = data["passed"] is passed and data["new_risk_events"] == new_events
        except (ZerynexError, KeyError, TypeError):
            matched = False
        outcomes.append({
            "scenario": baseline + "-to-" + candidate,
            "matched_expectation": matched,
        })
    count = sum(item["matched_expectation"] is True for item in outcomes)
    return {
        "synthetic": True,
        "passed": count == len(outcomes),
        "matched": count,
        "total": len(outcomes),
        "tests": outcomes,
        "limitation": LIMITATION,
    }
