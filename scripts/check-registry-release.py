#!/usr/bin/env python3
"""Offline, fail-closed package-metadata and downloaded release checks.

Used before tagging or invoking an explicitly approved trusted publisher.
Does not connect to npm, PyPI, crates.io or publish any artifacts.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import tarfile
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'https://github.com/Oluwa-Laughter/zerynex'
VERSION = re.compile(r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$')
EXPECTED_EXPORTS = {'.', './browser', './wasm/zerynex_bg.wasm'}


class RegistryReleaseError(ValueError):
    pass


def metadata(root: Path = ROOT) -> str:
    npm = json.loads((root / 'packages/sdk/package.json').read_text())
    py = tomllib.loads((root / 'packages/python/pyproject.toml').read_text())['project']
    rust = tomllib.loads((root / 'Cargo.toml').read_text())['package']
    web = json.loads((root / 'apps/web/package.json').read_text())
    version = npm.get('version')
    if (not isinstance(version, str) or not VERSION.fullmatch(version) or
            rust.get('version') != version or py.get('version') != version or web.get('version') != version):
        raise RegistryReleaseError('Distributable package versions must all match')
    if npm.get('name') != '@zerynex/sdk' or py.get('name') != 'zerynex-python' or rust.get('name') != 'zerynex':
        raise RegistryReleaseError('Distribution identity changed; review package names')
    repo = npm.get('repository')
    if not isinstance(repo, dict) or repo.get('url') != REPOSITORY or repo.get('directory') != 'packages/sdk':
        raise RegistryReleaseError('npm repository metadata must match the actual public repository')
    if rust.get('repository') != REPOSITORY or py.get('urls', {}).get('Repository') != REPOSITORY:
        raise RegistryReleaseError('Python and Rust package repository metadata missing')
    if npm.get('publishConfig', {}).get('access') != 'public':
        raise RegistryReleaseError('npm scoped package visibility must be explicitly public')
    exports = npm.get('exports')
    if not isinstance(exports, dict) or set(exports) != EXPECTED_EXPORTS:
        raise RegistryReleaseError('Unexpected SDK exports; consumer import paths may break')
    if exports['.'] != {'types': './dist/index.d.ts', 'default': './dist/index.js'}:
        raise RegistryReleaseError('Invalid SDK root export map')
    if exports['./browser'] != {'types': './dist/browser.d.ts', 'default': './dist/browser.js'}:
        raise RegistryReleaseError('Invalid SDK browser export map')
    if exports['./wasm/zerynex_bg.wasm'] != './dist/wasm/zerynex_bg.wasm':
        raise RegistryReleaseError('Missing packaged WASM binary export')
    if npm.get('bin') != {'zerynex-refund-check': './bin/refund-check.mjs'}:
        raise RegistryReleaseError('Missing installed SDK CLI executable')
    if not (root / 'packages/sdk/bin/refund-check.mjs').is_file():
        raise RegistryReleaseError('Missing source SDK CLI executable')
    if not {'bin', 'dist', 'README.md', 'LICENSE'} <= set(npm.get('files', [])):
        raise RegistryReleaseError('npm package file whitelist is incomplete')
    if not {'zerynex-project', 'zerynex-refund-audit', 'zerynex-mcp', 'zerynex-agent-preflight',
            'zerynex-zallet-fixture-check'} <= set(py.get('scripts', {})):
        raise RegistryReleaseError('Python public command entry points missing')
    go_mod = (root / 'packages/go/go.mod').read_text()
    if not re.search(r'^module github\.com/Oluwa-Laughter/zerynex/packages/go$', go_mod, re.M):
        raise RegistryReleaseError('Go module identity is inconsistent with GitHub')
    return version


def npm_tarball(archive: Path, version: str) -> None:
    if archive.name != f'zerynex-sdk-{version}.tgz':
        raise RegistryReleaseError('Unexpected npm tarball filename or version')
    try:
        with tarfile.open(archive, 'r:gz') as tar:
            members = {entry.name: entry for entry in tar.getmembers()}
            for required in ('package/package.json', 'package/bin/refund-check.mjs',
                             'package/dist/index.js', 'package/dist/index.d.ts',
                             'package/dist/browser.js', 'package/dist/wasm/zerynex_bg.wasm'):
                if required not in members or not members[required].isfile():
                    raise RegistryReleaseError('Tarball lacks required consumer runtime or CLI')
            manifest = json.loads(tar.extractfile(members['package/package.json']).read())
            if manifest.get('name') != '@zerynex/sdk' or manifest.get('version') != version:
                raise RegistryReleaseError('npm tarball identity or version disagrees with release')
            if manifest.get('bin') != {'zerynex-refund-check': './bin/refund-check.mjs'}:
                raise RegistryReleaseError('npm tarball lacks installed binary mapping')
            if manifest.get('exports', {}).get('.', {}) != {'types': './dist/index.d.ts', 'default': './dist/index.js'}:
                raise RegistryReleaseError('Published npm entry point is invalid')
    except (OSError, tarfile.TarError, KeyError, ValueError, TypeError) as exc:
        if isinstance(exc, RegistryReleaseError):
            raise
        raise RegistryReleaseError('Unusable npm archive') from None


def python_wheel(archive: Path, version: str) -> None:
    if archive.name != f'zerynex_python-{version}-py3-none-any.whl':
        raise RegistryReleaseError('Unexpected wheel filename or version')
    try:
        with zipfile.ZipFile(archive) as wheel:
            names = set(wheel.namelist())
            prefix = f'zerynex_python-{version}.dist-info/'
            if prefix+'METADATA' not in names or prefix+'entry_points.txt' not in names:
                raise RegistryReleaseError('Incomplete Python wheel distribution metadata')
            metadata_text = wheel.read(prefix+'METADATA').decode('utf8')
            entry_points = wheel.read(prefix+'entry_points.txt').decode('utf8')
            if (f'Name: zerynex-python' not in metadata_text or
                    f'Version: {version}' not in metadata_text or
                    'zerynex-refund-audit' not in entry_points or 'zerynex-project' not in entry_points or
                    'zerynex-zallet-fixture-check = zerynex_py.zallet_fixture:main' not in entry_points or
                    'zerynex_py/zallet_fixture.py' not in names):
                raise RegistryReleaseError('Python wheel name/version/scripts disagree with release')
    except (OSError, zipfile.BadZipFile, KeyError, UnicodeError) as exc:
        if isinstance(exc, RegistryReleaseError):
            raise
        raise RegistryReleaseError('Invalid Python wheel') from None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag', help='Release tag expected to match package version')
    parser.add_argument('--artifact-dir', type=Path, help='Optional local directory of downloaded assets')
    parser.add_argument('--registry', choices=['npm', 'pypi'], help='Verify the intended registry artifact')
    args = parser.parse_args()
    try:
        version = metadata()
        if args.tag and args.tag != 'v'+version:
            raise RegistryReleaseError('Release tag does not match built versions')
        if args.artifact_dir:
            if not args.registry:
                raise RegistryReleaseError('Specify a registry when verifying artifacts')
            if args.registry == 'npm':
                npm_tarball(args.artifact_dir / f'zerynex-sdk-{version}.tgz', version)
            else:
                python_wheel(args.artifact_dir / f'zerynex_python-{version}-py3-none-any.whl', version)
        elif args.registry:
            raise RegistryReleaseError('Artifact directory required for registry verification')
        print('Registry release metadata verified:', version, args.registry or 'source-only')
    except (RegistryReleaseError, OSError, ValueError, KeyError) as exc:
        raise SystemExit(f'Registry release rejected: {exc}') from None


if __name__ == '__main__':
    main()
