#!/usr/bin/env python3
"""Offline policy check for locally supplied, release-labelled Zallet PCZT fixtures.

The manifest's producer attribution is an assertion by its author. This tool
cannot authenticate that a PCZT was produced by Zallet.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

MAX_MANIFEST = 16 * 1024
MAX_BASE64 = ((8 * 1024 * 1024 + 2) // 3) * 4
NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\.b64\Z")
RULE = re.compile(r"[A-Z][A-Z0-9-]{0,79}\Z")
FIELD = re.compile(r"[a-z][a-z0-9_.-]{0,95}\Z")
DIGEST = re.compile(r"[0-9a-f]{64}\Z")
PINNED_RELEASE = "v0.1.0-beta.3"
PINNED_COMMIT = "987382f67e622915228686e9f956c6a9c9a7514c"


class FixtureError(Exception):
    """Never include fixture content or filesystem paths in this error."""


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise FixtureError("Ambiguous manifest JSON.")
        result[key] = value
    return result


def read_regular(path: Path, limit: int) -> bytes:
    try:
        flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
        fd = os.open(path, flags)
        with os.fdopen(fd, "rb") as handle:
            info = os.fstat(handle.fileno())
            if not stat.S_ISREG(info.st_mode) or not 0 < info.st_size <= limit:
                raise FixtureError("Invalid local fixture size or type.")
            value = handle.read(limit + 1)
        if not 0 < len(value) <= limit:
            raise FixtureError("Invalid local fixture size or type.")
        return value
    except (OSError, ValueError):
        raise FixtureError("Cannot read a regular local fixture.") from None


def validate_manifest(value: object) -> list[dict]:
    if not isinstance(value, dict) or set(value) != {"version", "producer", "cases"} or type(value["version"]) is not int or value["version"] != 1:
        raise FixtureError("Invalid fixture manifest.")
    producer = value["producer"]
    if (not isinstance(producer, dict) or set(producer) != {"release", "commit", "origin"}
            or producer != {"release": PINNED_RELEASE, "commit": PINNED_COMMIT,
                            "origin": "locally-supplied-zallet-output"}):
        raise FixtureError("Unsupported or unpinned producer assertion.")
    cases = value["cases"]
    if not isinstance(cases, list) or not 1 <= len(cases) <= 16:
        raise FixtureError("Invalid fixture case count.")
    names = set()
    for case in cases:
        if not isinstance(case, dict) or set(case) != {"file", "sha256", "deny_transparent", "expect"}:
            raise FixtureError("Invalid fixture case.")
        name = case["file"]
        expect = case["expect"]
        if (not isinstance(name, str) or not NAME.fullmatch(name) or name in names
                or not isinstance(case["sha256"], str) or not DIGEST.fullmatch(case["sha256"])
                or type(case["deny_transparent"]) is not bool
                or not isinstance(expect, list) or len(expect) > 32):
            raise FixtureError("Invalid fixture case.")
        names.add(name)
        seen = set()
        for item in expect:
            if (not isinstance(item, dict) or set(item) != {"rule", "field"}
                    or not isinstance(item["rule"], str) or not RULE.fullmatch(item["rule"])
                    or not isinstance(item["field"], str) or not FIELD.fullmatch(item["field"])):
                raise FixtureError("Invalid finding expectation.")
            pair = (item["rule"], item["field"])
            if pair in seen:
                raise FixtureError("Repeated finding expectation.")
            seen.add(pair)
    return cases


def run(manifest_path: Path, cli: Path) -> dict:
    try:
        manifest = json.loads(read_regular(manifest_path, MAX_MANIFEST), object_pairs_hook=unique_pairs)
    except (ValueError, UnicodeError, RecursionError):
        raise FixtureError("Invalid fixture manifest JSON.") from None
    cases = validate_manifest(manifest)
    results = []
    for case in cases:
        encoded = read_regular(manifest_path.parent / case["file"], MAX_BASE64)
        if hashlib.sha256(encoded).hexdigest() != case["sha256"]:
            raise FixtureError("Fixture digest mismatch.")
        try:
            decoded = base64.b64decode(encoded, validate=True)
            if not decoded or len(decoded) > 8 * 1024 * 1024 or base64.b64encode(decoded) != encoded:
                raise FixtureError("Invalid canonical base64 fixture.")
        except (ValueError, base64.binascii.Error):
            raise FixtureError("Invalid canonical base64 fixture.") from None
        args = [str(cli), "-", "--input-format", "base64", "--json"]
        if case["deny_transparent"]:
            args.append("--deny-transparent")
        try:
            completed = subprocess.run(args, input=encoded, capture_output=True, timeout=30, check=False)
        except (OSError, subprocess.TimeoutExpired):
            raise FixtureError("Local analyzer unavailable or timed out.") from None
        if completed.returncode not in (0, 2) or len(completed.stdout) > 1024 * 1024:
            raise FixtureError("Local analyzer rejected a fixture.")
        try:
            report = json.loads(completed.stdout, object_pairs_hook=unique_pairs)
            findings = report["findings"]
            actual = sorted((item["rule"], item["field"]) for item in findings)
            if (not isinstance(findings, list) or len(findings) > 32
                    or type(report["deny_transparent"]) is not bool
                    or report["deny_transparent"] != case["deny_transparent"]
                    or (completed.returncode == 0) != (len(actual) == 0)
                    or any(not RULE.fullmatch(rule) or not FIELD.fullmatch(field)
                           for rule, field in actual)):
                raise FixtureError("Invalid analyzer report.")
        except (ValueError, KeyError, TypeError, AttributeError):
            raise FixtureError("Invalid analyzer report.") from None
        expected = sorted((item["rule"], item["field"]) for item in case["expect"])
        results.append({"case": len(results) + 1, "matched": actual == expected,
                        "finding_count": len(actual), "rules": sorted(set(rule for rule, _ in actual))})
    return {"evidence": "locally-supplied-fixture; producer origin asserted, not authenticated",
            "release_assertion": PINNED_RELEASE, "case_count": len(results),
            "passed": all(item["matched"] for item in results), "cases": results,
            "limitation": "No wallet RPC, signing, proving, broadcast, or live Zallet interoperability verified."}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--cli", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = run(args.manifest, args.cli)
    except FixtureError:
        print("Zerynex: invalid local PCZT fixture or analyzer result.", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
