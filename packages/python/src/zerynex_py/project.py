"""Offline, non-destructive Zcash project bootstrap and real Rust integration verification.

Only ships reviewed, nonspendable public test vectors. Never reads or copies
real wallet PCZTs, keys, node credentials, or unapproved workspace files.
"""
from __future__ import annotations

import argparse
from importlib import resources
import hashlib
import json
import os
from pathlib import Path
import sys

from .client import Policy, ZerynexClient, ZerynexError

SCHEMA = 1
MAX_POLICY_BYTES = 4096
PREFIX = Path('.zerynex')
POLICY = PREFIX / 'policy.json'
CLEAN = PREFIX / 'fixtures' / 'clean-v6.bin'
TRANSPARENT = PREFIX / 'fixtures' / 'transparent-v6.bin'
MANIFEST = PREFIX / 'project.json'
WORKFLOW = Path('.github/workflows/zerynex-privacy.yml')
# A reviewed, immutable and publicly available release-base revision.
ACTION_SHA = '8dcbbba5584d1f168ec688ca42cd8f185ea904d1'
POLICY_BYTES = (json.dumps({'profile': 'external_signer', 'deny_transparent': True,
                            'deny_sapling': False}, indent=2) + '\n').encode()
WORKFLOW_BYTES = ('''# Synthetic, nonspendable PCZT only. Do not add wallet transactions or keys.
name: Zcash privacy regression
on: [push, pull_request]
permissions:
  contents: read
jobs:
  privacy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Review and update this pinned immutable commit deliberately.
      - uses: Oluwa-Laughter/zerynex@''' + ACTION_SHA + '''
        id: privacy
        with:
          pczt-path: .zerynex/fixtures/clean-v6.bin
          policy-path: .zerynex/policy.json
          fail-on-findings: 'true'
''').encode()

class ProjectError(Exception):
    """Safe operator-facing message without exposing private project paths."""


def _root(path: str) -> Path:
    candidate = Path(path).expanduser().absolute()
    if candidate.is_symlink():
        raise ProjectError('Project root cannot be a symlink.')
    try:
        root = candidate.resolve(strict=True)
        if not root.is_dir():
            raise ProjectError('Project root must be an existing directory.')
    except (OSError, ValueError):
        raise ProjectError('Project root is unavailable.') from None
    return root


def _guard(root: Path, relative: Path, *, must_exist: bool) -> Path:
    target = root / relative
    for ancestor in (root, *[root.joinpath(*relative.parts[:i]) for i in range(1, len(relative.parts))]):
        if ancestor.is_symlink() or (ancestor.exists() and not ancestor.is_dir()):
            raise ProjectError('Project contains an unsafe destination directory.')
    if target.is_symlink() or (target.exists() and not target.is_file()):
        raise ProjectError('Generated project file location is unsafe.')
    if must_exist and not target.is_file():
        raise ProjectError('Project integration has not been initialized.')
    if not must_exist and (target.exists() or target.is_symlink()):
        raise ProjectError('Initialization would overwrite an existing file; no files were changed.')
    return target


def _assets(*, ci: bool) -> dict[Path, bytes]:
    fixture_root = resources.files('zerynex_py').joinpath('fixtures')
    clean = fixture_root.joinpath('clean-v6.bin').read_bytes()
    flagged = fixture_root.joinpath('transparent-v6.bin').read_bytes()
    if not (0 < len(clean) <= 8192 and 0 < len(flagged) <= 8192 and clean != flagged):
        raise ProjectError('Bundled synthetic fixtures are unavailable.')
    manifest = {'schema_version': SCHEMA, 'synthetic_only': True,
                'fixture_sha256': {'clean-v6.bin': hashlib.sha256(clean).hexdigest(),
                                   'transparent-v6.bin': hashlib.sha256(flagged).hexdigest()},
                'policy_sha256': hashlib.sha256(POLICY_BYTES).hexdigest(),
                'expected': {'clean_findings': 0, 'transparent_rule': 'PCZT-TRANSPARENT-OUTPUTS'}}
    bundle = {POLICY: POLICY_BYTES, CLEAN: clean, TRANSPARENT: flagged,
              MANIFEST: (json.dumps(manifest, indent=2) + '\n').encode()}
    if ci:
        bundle[WORKFLOW] = WORKFLOW_BYTES
    return bundle


def initialize(root: Path, *, ci: bool = False) -> dict[str, object]:
    """Preflight all paths, then write with O_EXCL. Never overwrite project data."""
    bundle = _assets(ci=ci)
    targets = {relative: _guard(root, relative, must_exist=False) for relative in bundle}
    created: list[Path] = []
    try:
        for relative, target in targets.items():
            target.parent.mkdir(parents=True, exist_ok=True)
            # POSIX O_NOFOLLOW hardens the already validated target path.
            flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, 'O_NOFOLLOW', 0)
            fd = os.open(target, flags, 0o644)
            created.append(target)
            with os.fdopen(fd, 'wb') as handle:
                handle.write(bundle[relative])
    except (OSError, ValueError):
        for target in reversed(created):
            try:
                target.unlink()
            except OSError:
                pass
        raise ProjectError('Could not safely initialize the project. New files were rolled back.') from None
    return {'schema_version': SCHEMA, 'initialized': True, 'synthetic_only': True,
            'ci_configured': ci, 'created_files': [x.as_posix() for x in bundle],
            'limitation': 'No real PCZT files, node connections, wallet access, or signing.'}


def verify(root: Path, cli: str | None) -> dict[str, object]:
    """Verify ONLY bundled synthetic fixture hashes using the real local Rust CLI."""
    for file in (MANIFEST, POLICY, CLEAN, TRANSPARENT):
        _guard(root, file, must_exist=True)
    expected = _assets(ci=False)
    # Do not read arbitrarily long or replaced files; bundled fixture hashes must match.
    for relative, known in expected.items():
        target = root / relative
        if target.stat().st_size != len(known):
            raise ProjectError('Project synthetic fixture or policy has been changed.')
        with target.open('rb') as handle:
            if handle.read(len(known) + 1) != known:
                raise ProjectError('Project synthetic fixture or policy has been changed.')
    client = ZerynexClient(cli=cli)
    capabilities = client.capabilities()
    if 'analyze_pczt' not in capabilities.operations or 'binary' not in capabilities.input_formats:
        raise ProjectError('The Rust CLI does not support PCZT analysis.')
    policy = Policy(deny_transparent=True)
    clean = client.analyze_file(root / CLEAN, policy)
    transparent = client.analyze_file(root / TRANSPARENT, policy)
    clean_ok = clean.passed and not clean.findings
    transparent_ok = (not transparent.passed and
                      any(f.rule == 'PCZT-TRANSPARENT-OUTPUTS' for f in transparent.findings))
    passed = clean_ok and transparent_ok
    return {'schema_version': SCHEMA, 'passed': passed, 'synthetic_only': True,
            'engine': 'local_rust_cli', 'checks': {
                'capabilities': True, 'fixture_integrity': True,
                'clean_fixture': clean_ok, 'transparent_detection': transparent_ok,
            }, 'limitation': 'Only known nonspendable vectors. Does not certify integration with a real wallet, node or transaction.'}


def main() -> None:
    parser = argparse.ArgumentParser(description='Initialize and verify offline Zerynex integration in another project.')
    actions = parser.add_subparsers(dest='action', required=True)
    for name in ('init', 'verify'):
        sub = actions.add_parser(name)
        sub.add_argument('--project', required=True, help='Existing developer project directory')
        sub.add_argument('--json', action='store_true', help='Sanitized machine-readable summary')
        if name == 'init':
            sub.add_argument('--ci', action='store_true', help='Scaffold pinned synthetic-only GitHub Action')
        else:
            sub.add_argument('--cli', default=os.environ.get('ZERYNEX_CLI'),
                             help='Locally installed trusted Rust CLI path')
    args = parser.parse_args()
    try:
        root = _root(args.project)
        result = initialize(root, ci=args.ci) if args.action == 'init' else verify(root, args.cli)
    except (ProjectError, ZerynexError, OSError, ValueError) as exc:
        # Never echo CLI output, selected PCZT bytes or private workspace paths.
        print('Zerynex project setup or local verification was rejected.', file=sys.stderr)
        raise SystemExit(1) from None
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print('Zerynex project', args.action, 'PASS' if result.get('passed', result.get('initialized')) else 'FAIL')
        if args.action == 'init':
            print('Synthetic-only integration created. Use verify with your trusted Rust CLI.')
        else:
            print('Local Rust CLI, synthetic fixture integrity and expected rule behavior checked.')
    raise SystemExit(0 if result.get('passed', result.get('initialized')) else 2)

if __name__ == '__main__':
    main()
