#!/usr/bin/env python3
"""Offline, value-free OpenRPC method/parameter compatibility check."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

MAX_SCHEMA = 1024 * 1024
MAX_CONTRACT = 64 * 1024
SAFE_NAME = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_.-]{0,95}$")


class ContractInputError(Exception):
    """Sanitized error, never copies JSON source values or private paths."""


def reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    """Reject ambiguous JSON input with repeated keys at any depth."""
    decoded = {}
    for key, value in pairs:
        if key in decoded:
            raise ContractInputError("Duplicate JSON key.")
        decoded[key] = value
    return decoded


def unwrap_openrpc_schema(data: dict) -> dict:
    """Accept only a bare OpenRPC document or saved rpc.discover JSON-RPC reply."""
    if "jsonrpc" not in data:
        return data
    if (set(data) != {"jsonrpc", "id", "result"} or
            data["jsonrpc"] != "2.0" or
            (data["id"] is not None and type(data["id"]) not in (str, int)) or
            not isinstance(data["result"], dict)):
        raise ContractInputError("Invalid rpc.discover response.")
    schema = data["result"]
    if not isinstance(schema.get("openrpc"), str) or "jsonrpc" in schema:
        raise ContractInputError("Expected OpenRPC schema result.")
    return schema


def read_json(path: str, limit: int) -> dict:
    try:
        selected = Path(path)
        if selected.is_symlink() or not selected.is_file() or not 0 < selected.stat().st_size <= limit:
            raise ContractInputError
        # Read from the checked handle with an enforced byte limit: a file can
        # grow after stat(), and read_bytes() would otherwise read it in full.
        with selected.open('rb') as handle:
            if not handle.seekable():
                raise ContractInputError
            raw = handle.read(limit + 1)
        if len(raw) > limit:
            raise ContractInputError
        decoded = json.loads(raw, object_pairs_hook=reject_duplicate_keys)
        if not isinstance(decoded, dict):
            raise ContractInputError
        return decoded
    except (OSError, ValueError, UnicodeError, RecursionError, ContractInputError):
        raise ContractInputError("Invalid or oversized local OpenRPC input.") from None


def parse_methods(data: dict, *, contract: bool) -> dict[str, list[tuple[str, bool]]]:
    if contract and (type(data.get("version")) is not int or data["version"] != 1 or
                     set(data) != {"version", "methods"}):
        raise ContractInputError("Unsupported RPC contract version.")
    if not contract and not isinstance(data.get("openrpc"), str):
        raise ContractInputError("OpenRPC version is required.")
    items = data.get("methods")
    if not isinstance(items, list) or not items or len(items) > 512:
        raise ContractInputError("Invalid method list.")
    parsed = {}
    for entry in items:
        if not isinstance(entry, dict) or not isinstance(entry.get("name"), str):
            raise ContractInputError("Invalid method description.")
        name = entry["name"]
        if not SAFE_NAME.fullmatch(name) or name in parsed:
            raise ContractInputError("Invalid or repeated method name.")
        if contract and set(entry) != {"name", "params"}:
            raise ContractInputError("Unexpected contract field.")
        params = entry.get("params")
        if not isinstance(params, list) or len(params) > 100:
            raise ContractInputError("Invalid parameter list.")
        found = set()
        parsed_params = []
        for param in params:
            if not isinstance(param, dict):
                raise ContractInputError("Invalid parameter declaration.")
            pname = param.get("name")
            required = param.get("required", False)
            if (not isinstance(pname, str) or not SAFE_NAME.fullmatch(pname)
                    or pname in found or type(required) is not bool):
                raise ContractInputError("Invalid or duplicate parameter declaration.")
            if contract and set(param) != {"name", "required"}:
                raise ContractInputError("Unexpected parameter contract field.")
            found.add(pname)
            parsed_params.append((pname, required))
        parsed[name] = parsed_params
    return parsed


def compare(schema: dict, contract: dict) -> dict:
    actual = parse_methods(schema, contract=False)
    expected = parse_methods(contract, contract=True)
    findings = []
    for method, expected_params in expected.items():
        if method not in actual:
            findings.append({"rule": "RPC-METHOD-MISSING", "method": method})
            continue
        actual_params = actual[method]
        position = {name: index for index, (name, _) in enumerate(actual_params)}
        last = -1
        for name, required in expected_params:
            if name not in position:
                findings.append({"rule": "RPC-PARAMETER-MISSING", "method": method, "parameter": name})
                continue
            at = position[name]
            if at < last:
                findings.append({"rule": "RPC-PARAMETER-ORDER", "method": method, "parameter": name})
            last = max(last, at)
            if actual_params[at][1] != required:
                findings.append({"rule": "RPC-REQUIRED-FLAG-CHANGED", "method": method, "parameter": name})
    return {
        "passed": len(findings) == 0,
        "checked_methods": len(expected),
        "observed_methods": len(actual),
        "finding_count": len(findings),
        "findings": findings,
        "limitation": "Offline method and parameter structure only. No RPC execution, payload semantics, wallet safety or release compatibility verified.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline Zcash OpenRPC contract checker")
    parser.add_argument("--schema", required=True, help="Local OpenRPC JSON file")
    parser.add_argument("--contract", required=True, help="Expected method/parameter JSON file")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        schema = unwrap_openrpc_schema(read_json(args.schema, MAX_SCHEMA))
        report = compare(schema, read_json(args.contract, MAX_CONTRACT))
    except ContractInputError:
        print("Zerynex RPC: cannot evaluate input. Verify local schema and contract structure.", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print("Zerynex RPC: {} of {} contracted methods checked, {} finding(s).".format(
            report["checked_methods"], report["checked_methods"], report["finding_count"]))
        for item in report["findings"]:
            print("{}: {} {}".format(item["rule"], item["method"], item.get("parameter", "")))
    return 0 if report["passed"] else 2


if __name__ == "__main__":
    sys.exit(main())
