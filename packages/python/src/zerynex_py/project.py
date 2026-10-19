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
import stat
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



# Local source policy: opt-in per PCZT. Never discover, enumerate, or upload
# user-controlled transaction files. The trusted developer controls this tree.
def _project_file(root: Path, raw: str) -> Path:
    if not isinstance(raw, str) or not raw or "\x00" in raw:
        raise ProjectError('Explicit PCZT path is required.')
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate
    lexical = Path(os.path.abspath(candidate))
    try:
        relative = lexical.relative_to(root)
    except ValueError:
        raise ProjectError('PCZT must reside inside the selected project.') from None
    if not relative.parts:
        raise ProjectError('Select a PCZT file, not a directory.')
    # Reject symlink traversal, even if it eventually resolves back inside
    # the project. The file itself must be regular and bounded.
    for i in range(1, len(relative.parts) + 1):
        segment = root.joinpath(*relative.parts[:i])
        if segment.is_symlink():
            raise ProjectError('PCZT symlinks are not permitted.')
    try:
        fd = os.open(lexical, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) |
                     getattr(os, 'O_NONBLOCK', 0))
        try:
            meta = os.fstat(fd)
            if not stat.S_ISREG(meta.st_mode) or not 0 < meta.st_size <= 8 * 1024 * 1024:
                raise ProjectError('PCZT must be a regular file of at most 8 MiB.')
        finally:
            os.close(fd)
    except (OSError, ValueError):
        raise ProjectError('Selected PCZT file is unavailable.') from None
    return lexical


def _policy_from_project(root: Path) -> Policy:
    policy_path = _guard(root, POLICY, must_exist=True)
    try:
        fd = os.open(policy_path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) |
                     getattr(os, 'O_NONBLOCK', 0))
        try:
            metadata = os.fstat(fd)
            if not stat.S_ISREG(metadata.st_mode) or not 0 < metadata.st_size <= MAX_POLICY_BYTES:
                raise ProjectError('Project policy must be a bounded regular file.')
            with os.fdopen(fd, 'rb', closefd=False) as stream:
                raw = stream.read(MAX_POLICY_BYTES + 1)
        finally:
            os.close(fd)
        def unique(entries: list[tuple[str, object]]) -> dict[str, object]:
            parsed: dict[str, object] = {}
            for key, value in entries:
                if key in parsed:
                    raise ValueError('duplicate')
                parsed[key] = value
            return parsed
        data = json.loads(raw, object_pairs_hook=unique,
                          parse_constant=lambda _: (_ for _ in ()).throw(ValueError('constant')))
        if (not isinstance(data, dict) or set(data) != {'profile', 'deny_transparent', 'deny_sapling'}
                or data['profile'] not in ('external_signer', 'restricted_handoff')
                or type(data['deny_transparent']) is not bool
                or type(data['deny_sapling']) is not bool):
            raise ValueError('policy')
        return Policy(profile=data['profile'], deny_transparent=data['deny_transparent'],
                      deny_sapling=data['deny_sapling'])
    except (OSError, ValueError, TypeError, UnicodeError, ZerynexError):
        raise ProjectError('Project policy is invalid or cannot be read.') from None


def _safe_summary(rule_ids: list[str]) -> list[str]:
    # Field paths, arbitrary report explanations and RPC metadata must never
    # escape into terminal output or agent logs. Output only known rule IDs.
    from .rules import bundled_rule_catalog
    catalog = bundled_rule_catalog()
    known = {entry['id'] for entry in catalog['rules']}
    if any(rule not in known for rule in rule_ids):
        raise ProjectError('Rust engine returned an unsupported policy rule.')
    return sorted(set(rule_ids))


def check_project(root: Path, cli: str | None, pczt: str) -> dict[str, object]:
    """Run one explicitly supplied PCZT through the real local Rust engine."""
    _guard(root, MANIFEST, must_exist=True)
    policy = _policy_from_project(root)
    candidate = _project_file(root, pczt)
    report = ZerynexClient(cli=cli).analyze_file(candidate, policy)
    return {'schema_version': SCHEMA, 'passed': report.passed,
            'input': 'explicit_local_file', 'engine': 'local_rust_cli',
            'finding_count': len(report.findings),
            'rule_ids': _safe_summary([item.rule for item in report.findings]),
            'limitation': 'Structural policy findings only; not a signature, proof, anonymity or payment verification. No raw PCZT fields are returned.'}


def compare_project(root: Path, cli: str | None, before: str, after: str) -> dict[str, object]:
    """Check explicit stage regression; does not assume equivalent transactions."""
    _guard(root, MANIFEST, must_exist=True)
    policy = _policy_from_project(root)
    baseline = _project_file(root, before)
    candidate = _project_file(root, after)
    if baseline == candidate:
        raise ProjectError('Before and after PCZT files must be distinct.')
    result = ZerynexClient(cli=cli).compare_files(baseline, candidate, policy)
    return {'schema_version': SCHEMA, 'passed': result.passed,
            'input': 'two_explicit_local_files',
            'engine': 'local_rust_cli', 'no_new_findings': result.no_new_findings,
            'before_findings_count': result.before_findings_count,
            'after_findings_count': result.after_findings_count,
            'added_rule_ids': _safe_summary([rule for rule, _ in result.added_findings]),
            'resolved_rule_ids': _safe_summary([rule for rule, _ in result.resolved_findings]),
            'limitation': 'Only selected policy regressions; not equivalent payments, proof validity or safe signing. No raw PCZT fields are returned.'}


def main() -> None:
    parser = argparse.ArgumentParser(description='Initialize and verify offline Zerynex integration in another project.')
    actions = parser.add_subparsers(dest='action', required=True)
    for name in ('init', 'verify', 'check', 'compare'):
        sub = actions.add_parser(name)
        sub.add_argument('--project', required=True, help='Existing developer project directory')
        sub.add_argument('--json', action='store_true', help='Sanitized machine-readable summary')
        if name == 'init':
            sub.add_argument('--ci', action='store_true', help='Scaffold pinned synthetic-only GitHub Action')
        else:
            sub.add_argument('--cli', default=os.environ.get('ZERYNEX_CLI'),
                             help='Locally installed trusted Rust CLI path')
        if name == 'check':
            sub.add_argument('--pczt', required=True, help='Explicit PCZT path inside this project')
        elif name == 'compare':
            sub.add_argument('--before', required=True, help='Explicit earlier PCZT file')
            sub.add_argument('--after', required=True, help='Explicit later PCZT file')
    args = parser.parse_args()
    try:
        root = _root(args.project)
        if args.action == 'init':
            result = initialize(root, ci=args.ci)
        elif args.action == 'verify':
            result = verify(root, args.cli)
        elif args.action == 'check':
            result = check_project(root, args.cli, args.pczt)
        else:
            result = compare_project(root, args.cli, args.before, args.after)
    except (ProjectError, ZerynexError, OSError, ValueError):
        # Never echo CLI output, selected PCZT bytes or private workspace paths.
        print('Zerynex project setup or local verification was rejected.', file=sys.stderr)
        raise SystemExit(1) from None
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print('Zerynex project', args.action, 'PASS' if result.get('passed', result.get('initialized')) else 'FAIL')
        if args.action == 'init':
            print('Synthetic-only integration created. Use verify with your trusted Rust CLI.')
        elif args.action == 'verify':
            print('Local Rust CLI, synthetic fixture integrity and expected rule behavior checked.')
        else:
            print('Explicit local PCZT policy report: no sensitive transaction content included.')
    raise SystemExit(0 if result.get('passed', result.get('initialized')) else 2)

if __name__ == '__main__':
    main()
