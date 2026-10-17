"""Installable, offline preflight spanning Rust, synthetic PCZT and RPC checks."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from .agent_workflows import developer_preflight
from .client import ZerynexClient, ZerynexError


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local Zerynex developer integration preflight.")
    parser.add_argument("--cli", default=os.environ.get("ZERYNEX_CLI", ""), help="Trusted local Rust CLI executable")
    parser.add_argument("--fixtures", default=os.environ.get("ZERYNEX_AGENT_ALLOWED_ROOT", ""), help="Explicit synthetic PCZT fixture directory")
    parser.add_argument("--json", action="store_true", help="Output sanitized machine-readable results")
    options = parser.parse_args()
    if not options.cli or not options.fixtures:
        parser.error("Provide --cli and --fixtures or their ZERYNEX environment values.")
    try:
        root = Path(options.fixtures).expanduser().resolve(strict=True)
        if not root.is_dir():
            raise ZerynexError("Fixture root unavailable.")
        client = ZerynexClient(cli=options.cli)
        report = developer_preflight(client, root)
    except (ZerynexError, OSError, ValueError):
        print("Zerynex preflight could not evaluate the local setup.", file=sys.stderr)
        raise SystemExit(1) from None
    if options.json:
        print(json.dumps(report, indent=2))
    else:
        print("Zerynex developer preflight:", "PASS" if report["passed"] else "FAIL")
        print("Synthetic PCZT suite:", report["checks"]["synthetic_pczt_suite"]["matched"], "/", report["checks"]["synthetic_pczt_suite"]["total"])
        print("Synthetic RPC contract:", "PASS" if report["checks"]["synthetic_rpc_contract"]["passed"] else "FAIL")
    raise SystemExit(0 if report["passed"] else 2)


if __name__ == "__main__":
    main()
