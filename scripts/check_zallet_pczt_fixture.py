#!/usr/bin/env python3
"""Repository shim for the installable zerynex-zallet-fixture-check command."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "packages/python/src"))
from zerynex_py.zallet_fixture import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main())
