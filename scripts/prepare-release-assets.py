#!/usr/bin/env python3
"""Fail closed on invalid CI artifacts before attaching them to a GitHub release.

Input is the directory tree from download-artifact (merge-multiple=true).
The output is a flat directory of regular files, suitable for `gh release create`.
"""
from __future__ import annotations
import hashlib
from pathlib import Path
import shutil
import sys

ALLOWED = {'.tgz', '.whl', '.zip', '.gz', '.txt'}


def prepare(source: Path, destination: Path) -> list[str]:
    if not source.is_dir() or destination.exists():
        raise ValueError('Missing source artifacts or destination already exists')
    files = sorted(p for p in source.rglob('*') if p.is_file() or p.is_symlink())
    if not files:
        raise ValueError('No release files')
    names = set()
    checksums = {}
    payload = {}
    for path in files:
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(source.resolve()):
            raise ValueError('Unsafe release artifact')
        if path.name in names or (path.suffix not in ALLOWED):
            raise ValueError('Duplicate or unrecognized release artifact')
        if path.stat().st_size == 0:
            raise ValueError('Empty release artifact')
        names.add(path.name)
        if path.name.startswith('SHA256SUMS-'):
            checksums[path.name] = path.read_text()
        else:
            payload[path.name] = path
    # Every native archive must have exactly one matching platform checksum.
    covered = set()
    for manifest, contents in checksums.items():
        expected_archive = manifest.removeprefix('SHA256SUMS-').removesuffix('.txt')
        entries = [line for line in contents.splitlines() if line]
        if len(entries) != 1:
            raise ValueError('Each platform checksum must contain exactly one archive')
        parts = entries[0].split('  ', 1)
        if len(parts) != 2 or parts[1] not in payload:
            raise ValueError('Unmatched release checksum')
        filename = parts[1]
        if not filename.startswith('zerynex-v') or not filename.endswith(('.zip', '.tar.gz')):
            raise ValueError('Checksum must reference a native Zerynex archive')
        if not filename.removesuffix('.zip').removesuffix('.tar.gz').endswith(expected_archive):
            raise ValueError('Checksum archive platform mismatch')
        if filename in covered:
            raise ValueError('Duplicate checksum for native archive')
        actual = hashlib.sha256(payload[filename].read_bytes()).hexdigest()
        if actual != parts[0]:
            raise ValueError('Release checksum mismatch')
        covered.add(filename)
    native = {name for name in payload if name.endswith(('.zip', '.tar.gz'))}
    if native != covered:
        raise ValueError('Native archive missing checksum')
    if not any(name.endswith('.tgz') for name in payload):
        raise ValueError('npm SDK archive missing')
    if not any(name.endswith('.whl') for name in payload):
        raise ValueError('Python wheel missing')
    destination.mkdir(parents=True)
    for path in files:
        shutil.copyfile(path, destination / path.name)
    return sorted(names)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: prepare-release-assets.py <download-dir> <flat-output-dir>')
    try:
        names = prepare(Path(sys.argv[1]), Path(sys.argv[2]))
    except ValueError as exc:
        raise SystemExit(f'Release assets rejected: {exc}') from None
    print('Validated release files:', ', '.join(names))
