#!/usr/bin/env python3
"""Repository compatibility shim for the installable zerynex-rpc-check CLI."""
from pathlib import Path
import sys

# Keep source-checkout commands working without requiring a wheel install.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "packages/python/src"))
from zerynex_py.rpc_contract import (  # noqa: E402
    ContractInputError, MAX_CONTRACT, MAX_SCHEMA, SAFE_NAME,
    compare, main, parse_methods, read_json, reject_duplicate_keys,
    unwrap_openrpc_schema,
)

if __name__ == "__main__":
    raise SystemExit(main())
