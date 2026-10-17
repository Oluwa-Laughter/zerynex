#!/usr/bin/env python3
"""Gate tag-based releases on matching Rust, npm and Python package versions."""
import json
from pathlib import Path
import sys
import tomllib

root = Path(__file__).resolve().parents[1]
rust = tomllib.loads((root / "Cargo.toml").read_text())["package"]["version"]
python = tomllib.loads((root / "packages/python/pyproject.toml").read_text())["project"]["version"]
npm = json.loads((root / "packages/sdk/package.json").read_text())["version"]
if len({rust, python, npm}) != 1:
    raise SystemExit("Release aborted: Rust, Python and npm versions disagree.")
if len(sys.argv) == 2 and sys.argv[1] and sys.argv[1] != "v" + rust:
    raise SystemExit("Release aborted: git tag disagrees with project versions.")
print("Release versions agree:", rust)
