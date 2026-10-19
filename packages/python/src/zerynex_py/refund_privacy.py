"""Offline, metadata-only refund linkability checks for Zcash swap integrations.

This intentionally does NOT process Zcash addresses, viewing keys, spend keys,
refund payments, PIR queries, or cryptographic secrets. References in the
input are developer-supplied random 128-bit opaque tokens, not hashes of keys.
Reports contain only fixed rule identifiers and aggregate counts.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import stat
import sys
from typing import Any

MAX_INPUT = 64 * 1024
MAX_ENTRIES = 100
TOKEN = re.compile(r'^[0-9a-f]{32}$')
RULES = (
    'SWAP-REFUND-ADDRESS-REUSE',
    'SWAP-VIEWING-SCOPE-REUSE',
    'SWAP-PUBLIC-REFUND-UNSCOPED',
    'SWAP-REFUND-LOOKUP-DISCLOSURE',
    'SWAP-SPENDING-KEY-CUSTODY-UNVERIFIED',
)
LIMITATION = ('Static, self-declared integration metadata only. No viewing-key cryptography, quantum-security, PIR, '
              'wallet behavior, chain activity, or safe recovery is verified. Do not provide addresses or keys.')

class RefundAuditInputError(ValueError):
    pass


def _record(obj: object, keys: set[str]) -> dict[str, object]:
    if type(obj) is not dict or set(obj) != keys:
        raise RefundAuditInputError('Invalid privacy exposure manifest shape.')
    return obj


def _token(value: object) -> str:
    if type(value) is not str or not TOKEN.fullmatch(value):
        raise RefundAuditInputError('Expected an opaque 128-bit random reference, not an address or key.')
    return value


def audit_manifest(manifest: object) -> dict[str, object]:
    """Evaluate static declaration, never assert that key isolation is proven."""
    root = _record(manifest, {'schema_version', 'flows'})
    if type(root['schema_version']) is not int or root['schema_version'] != 1:
        raise RefundAuditInputError('Unsupported refund audit schema.')
    flows = root['flows']
    if type(flows) is not list or not 1 <= len(flows) <= MAX_ENTRIES:
        raise RefundAuditInputError('Expected 1 to 100 application-declared swap flows.')
    normalized: list[dict[str, Any]] = []
    seen_flow: set[str] = set()
    keyset = {'flow_ref', 'refund_address_ref', 'viewing_scope_ref',
              'published_publicly', 'lookup_mode', 'spending_key_custody'}
    for item in flows:
        row = _record(item, keyset)
        refs = {k: _token(row[k]) for k in ('flow_ref', 'refund_address_ref', 'viewing_scope_ref')}
        if refs['flow_ref'] in seen_flow:
            raise RefundAuditInputError('Duplicate swap-flow record.')
        seen_flow.add(refs['flow_ref'])
        if type(row['published_publicly']) is not bool:
            raise RefundAuditInputError('Expected an explicit public-disclosure boolean.')
        if row['lookup_mode'] not in ('private_claimed', 'direct', 'unknown') or type(row['lookup_mode']) is not str:
            raise RefundAuditInputError('Invalid wallet refund-lookup declaration.')
        if row['spending_key_custody'] not in ('wallet_claimed', 'external', 'unknown') or type(row['spending_key_custody']) is not str:
            raise RefundAuditInputError('Invalid spending-key custody declaration.')
        normalized.append({**refs, 'published_publicly': row['published_publicly'],
                           'lookup_mode': row['lookup_mode'], 'spending_key_custody': row['spending_key_custody']})

    address_count: dict[str, int] = {}
    scope_count: dict[str, int] = {}
    for row in normalized:
        address_count[row['refund_address_ref']] = address_count.get(row['refund_address_ref'], 0) + 1
        scope_count[row['viewing_scope_ref']] = scope_count.get(row['viewing_scope_ref'], 0) + 1
    findings: set[str] = set()
    for row in normalized:
        if address_count[row['refund_address_ref']] > 1:
            findings.add('SWAP-REFUND-ADDRESS-REUSE')
        if scope_count[row['viewing_scope_ref']] > 1:
            findings.add('SWAP-VIEWING-SCOPE-REUSE')
        # A published refund identifier with a shared viewing scope can make
        # key recovery an amplified privacy exposure. This is only a model.
        if row['published_publicly'] and scope_count[row['viewing_scope_ref']] > 1:
            findings.add('SWAP-PUBLIC-REFUND-UNSCOPED')
        if row['lookup_mode'] != 'private_claimed':
            findings.add('SWAP-REFUND-LOOKUP-DISCLOSURE')
        if row['spending_key_custody'] != 'wallet_claimed':
            findings.add('SWAP-SPENDING-KEY-CUSTODY-UNVERIFIED')
    return {
        'schema_version': 1, 'passed': not findings, 'flows_checked': len(normalized),
        'public_refund_flows': sum(bool(row['published_publicly']) for row in normalized),
        'finding_count': len(findings), 'rule_ids': sorted(findings),
        'status': 'declaration_review_only', 'limitation': LIMITATION,
    }


def _unique_pairs(pairs: list[tuple[str, object]]) -> dict[str, object]:
    values: dict[str, object] = {}
    for key, value in pairs:
        if key in values:
            raise RefundAuditInputError('Duplicate JSON field.')
        values[key] = value
    return values


def read_manifest(path: str) -> dict[str, object]:
    target = Path(path)
    if target.is_symlink():
        raise RefundAuditInputError('Symlinks are not supported.')
    try:
        flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0)
        fd = os.open(target, flags)
        try:
            meta = os.fstat(fd)
            if not stat.S_ISREG(meta.st_mode) or meta.st_size <= 0 or meta.st_size > MAX_INPUT:
                raise RefundAuditInputError('Manifest is not a bounded regular file.')
            with os.fdopen(fd, 'rb', closefd=False) as stream:
                raw = stream.read(MAX_INPUT + 1)
            if len(raw) > MAX_INPUT:
                raise RefundAuditInputError('Manifest exceeds file limit.')
        finally:
            os.close(fd)
        parsed = json.loads(raw, object_pairs_hook=_unique_pairs,
                            parse_constant=lambda _: (_ for _ in ()).throw(RefundAuditInputError('Invalid numeric constant.')))
        if type(parsed) is not dict:
            raise RefundAuditInputError('Manifest must be a JSON object.')
        return parsed
    except (OSError, UnicodeError, ValueError, TypeError):
        raise RefundAuditInputError('Invalid local refund privacy manifest.') from None


def main() -> None:
    parser = argparse.ArgumentParser(description='Offline self-declared swap refund and viewing-key isolation audit.')
    parser.add_argument('--manifest', required=True, help='Local public-safe metadata JSON, never addresses or keys')
    parser.add_argument('--json', action='store_true', help='Sanitized machine-readable report')
    args = parser.parse_args()
    try:
        report = audit_manifest(read_manifest(args.manifest))
    except RefundAuditInputError:
        print('Refund privacy metadata rejected; no input contents were printed.', file=sys.stderr)
        raise SystemExit(1) from None
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print('Refund privacy metadata:', 'NO DECLARED RISKS' if report['passed'] else 'REVIEW REQUIRED')
        print('Flows:', report['flows_checked'], 'Rule IDs:', ', '.join(report['rule_ids']))
    raise SystemExit(0 if report['passed'] else 2)

if __name__ == '__main__':
    main()
