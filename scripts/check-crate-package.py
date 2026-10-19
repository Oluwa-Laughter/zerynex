#!/usr/bin/env python3
"""Prevent accidentally publishing website/npm/Python content to crates.io."""
from pathlib import Path
import argparse
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {'Cargo.toml', 'Cargo.lock', 'LICENSE', 'README.md',
            'src/lib.rs', 'src/main.rs', 'rules/catalog.json',
            'apps/web/public/examples/clean-v6.bin',
            'apps/web/public/examples/flagged-v6.bin',
            'apps/web/public/examples/transparent-v6.bin'}


def validate(files: list[str]) -> None:
    names = set(files)
    if len(files) != len(names) or len(names) > 125 or not REQUIRED <= names:
        raise ValueError('Rust crate has missing, duplicate, or excessive package files')
    for name in names:
        if name.startswith(('packages/', '.github/', 'docs/', 'scripts/',
                            'agent/', 'apps/web/app/', 'apps/web/src/',
                            'apps/web/content/', 'apps/web/node_modules/',
                            'apps/web/public/wasm/')):
            raise ValueError('Rust crate is contaminated with unrelated monorepo source')
        if name.startswith('apps/web/') and name not in REQUIRED:
            raise ValueError('Unexpected website file in Rust package')
        if any(part in ('node_modules', 'target', '__pycache__', '.env', '.next')
               for part in Path(name).parts):
            raise ValueError('Build dependency or potentially private file in Rust crate')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allow-dirty', action='store_true', help='Only for local uncommitted development checks')
    args = parser.parse_args()
    try:
        command = ['cargo', 'package', '--list', '--locked']
        if args.allow_dirty:
            command.append('--allow-dirty')
        result = subprocess.run(command,
                                cwd=ROOT, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise ValueError('Cargo cannot calculate the reviewed crate file list')
        files = [line for line in result.stdout.splitlines() if line]
        validate(files)
        print('Rust crate package boundary verified:',len(files),'files')
    except (OSError, subprocess.TimeoutExpired, ValueError) as exc:
        raise SystemExit(f'Rust crate release rejected: {exc}') from None

if __name__ == '__main__':main()
