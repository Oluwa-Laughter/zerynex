#!/usr/bin/env python3
"""Third-party Zcash application example; only non-secret swap metadata."""
from __future__ import annotations

import argparse
import json
import sys

from zerynex_py.refund_privacy import (
    RefundAuditInputError,
    audit_manifest,
    compare_manifests,
    read_manifest,
    sarif_report,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline refund-privacy integration smoke test")
    parser.add_argument("baseline", help="Reviewed non-secret baseline metadata path")
    parser.add_argument("candidate", help="Reviewed non-secret candidate metadata path")
    parser.add_argument("--sarif", action="store_true", help="Output location-free SARIF")
    args = parser.parse_args()
    try:
        before = read_manifest(args.baseline)
        after = read_manifest(args.candidate)
        current = audit_manifest(after)
        delta = compare_manifests(before, after)
        report = sarif_report(delta) if args.sarif else {
            "passed": delta["passed"],
            "candidateRuleIds": current["rule_ids"],
            "newRuleIds": delta["new_rule_ids"],
            "newRiskEvents": delta["new_risk_events"],
            "resolvedRiskEvents": delta["resolved_risk_events"],
            "limitation": delta["limitation"],
        }
    except (RefundAuditInputError, OSError, ValueError):
        print("Invalid or unreadable refund privacy metadata; no input content was printed.", file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2))
    return 0 if delta["passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
