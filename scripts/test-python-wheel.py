#!/usr/bin/env python3
"""Install the pure Python SDK wheel from a clean consumer virtualenv.

The wheel intentionally delegates to the separately installed, trusted
Rust CLI. Optional MCP dependencies are only needed by MCP users.
"""
from __future__ import annotations

import argparse
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("wheels", type=Path)
    parser.add_argument("--cli", type=Path, default=ROOT / "target/debug/zerynex")
    args = parser.parse_args()
    check_wheel(args.wheels, args.cli)
