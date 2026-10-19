#!/usr/bin/env python3
"""Verify the exact reviewed registry artifacts downloaded from a GitHub Release.

A SHA-256 manifest is generated when the release assets are produced, not in
any publishing job. This verifier neither uploads files nor calls registries.
"""
from __future__ import annotations
import argparse
import hashlib
from pathlib import Path
import re

DIGEST_LINE = re.compile(r'^([0-9a-f]{64})  ([a-zA-Z0-9_.-]+)$')
VERSION = re.compile(r'^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$')

class DigestError(ValueError):
    pass


def validate(directory: Path, version: str, registry: str) -> list[str]:
    if not VERSION.fullmatch(version) or registry not in {'npm', 'pypi'}:
        raise DigestError('Invalid version or registry')
    names = ([f'zerynex-sdk-{version}.tgz'] if registry == 'npm' else
             [f'zerynex_python-{version}-py3-none-any.whl', f'zerynex_python-{version}.tar.gz'])
    expected = set(names)
    if not directory.is_dir() or directory.is_symlink():
        raise DigestError('Release artifact directory missing or unsafe')
    manifest = directory / 'SHA256SUMS-registry.txt'
    if not manifest.is_file() or manifest.is_symlink() or manifest.stat().st_size > 4096:
        raise DigestError('Reviewed registry checksums missing or oversized')
    entries: dict[str, str] = {}
    for line in manifest.read_text(encoding='utf-8').splitlines():
        match = DIGEST_LINE.fullmatch(line)
        if not match:
            raise DigestError('Malformed release checksum record')
        checksum, name = match.groups()
        if name in entries:
            raise DigestError('Duplicate release checksum record')
        entries[name] = checksum
    if not expected <= entries.keys():
        raise DigestError('Release checksum missing expected registry asset')
    for name in names:
        path = directory / name
        if path.is_symlink() or not path.is_file() or not path.stat().st_size:
            raise DigestError('Release artifact missing or unsafe')
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        if sha != entries[name]:
            raise DigestError('Downloaded package differs from reviewed release checksum')
    extra = {p.name for p in directory.iterdir()} - expected - {manifest.name}
    if extra:
        raise DigestError('Unexpected files mixed with registry release assets')
    return names


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dir', type=Path, required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--registry', choices=['npm', 'pypi'], required=True)
    args = parser.parse_args()
    try:
        validated = validate(args.dir, args.version, args.registry)
    except (OSError, UnicodeError, DigestError) as exc:
        raise SystemExit(f'Untrusted registry artifact: {exc}') from None
    print('Reviewed registry asset digests verified:', ', '.join(validated))

if __name__ == '__main__':
    main()
