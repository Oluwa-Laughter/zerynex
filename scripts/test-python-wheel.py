#!/usr/bin/env python3
"""Install the pure Python SDK wheel from a clean consumer virtualenv.

The wheel intentionally delegates to the separately installed, trusted
Rust CLI. Optional MCP dependencies are only needed by MCP users.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import venv

ROOT = Path(__file__).resolve().parents[1]


def check_wheel(folder: Path, cli: Path) -> None:
    wheels = list(folder.glob("zerynex_python-*.whl"))
    if len(wheels) != 1:
        raise AssertionError("Expected exactly one built Python wheel.")
    with tempfile.TemporaryDirectory(prefix="zerynex-python-consumer-") as directory:
        venv_dir = Path(directory) / "venv"
        venv.EnvBuilder(with_pip=True).create(venv_dir)
        python = venv_dir / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
        subprocess.run([str(python), "-m", "pip", "install", "--no-index", "--no-deps",
                        str(wheels[0].resolve())], check=True, capture_output=True, timeout=60)
        code = (
            "import sys;from pathlib import Path;"
            "from zerynex_py import ZerynexClient,Policy;"
            "client=ZerynexClient(cli=Path(sys.argv[1]));"
            "report=client.analyze_file(Path(sys.argv[2]),Policy(deny_transparent=True));"
            "assert not report.passed;"
            "assert any(f.rule=='PCZT-TRANSPARENT-OUTPUTS' for f in report.findings);"
            "print('PACKED PYTHON CONSUMER PASS: real Rust CLI and source-free wheel')"
        )
        completed = subprocess.run([str(python), "-c", code,
            str(cli.resolve()), str((ROOT / "apps/web/public/examples/transparent-v6.bin").resolve())],
            capture_output=True, text=True, timeout=25, check=True)
        print(completed.stdout.strip())
        checker = venv_dir / ("Scripts/zerynex-rpc-check.exe" if sys.platform == "win32" else "bin/zerynex-rpc-check")
        if not checker.is_file():
            raise AssertionError("RPC checker CLI was not installed from the wheel")
        offline = subprocess.run([
            str(checker),
            "--schema", str((ROOT / "tests/fixtures/rpc/zallet-pczt-lifecycle-synthetic-openrpc.json").resolve()),
            "--contract", str((ROOT / "tests/fixtures/rpc/zallet-pczt-lifecycle-contract.json").resolve()),
            "--deny-new-required", "--json",
        ], capture_output=True, text=True, timeout=25, check=True)
        report = json.loads(offline.stdout)
        if report.get("passed") is not True or report.get("checked_methods") != 7 or report.get("deny_new_required") is not True:
            raise AssertionError("Installed RPC CLI returned an unexpected capability contract")
        print("PACKED RPC CONSUMER PASS: installed wheel CLI validates seven synthetic methods")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("wheels", type=Path)
    parser.add_argument("--cli", type=Path, default=ROOT / "target/debug/zerynex")
    args = parser.parse_args()
    check_wheel(args.wheels, args.cli)
