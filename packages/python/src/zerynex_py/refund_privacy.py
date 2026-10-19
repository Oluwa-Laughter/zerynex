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


def _evaluate_manifest(manifest: object) -> tuple[dict[str, object], set[tuple[str, str]]]:
    """Evaluate declarations while retaining opaque in-memory event identity."""
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
    # Opaque flow references are intentionally never returned in a report.
    events: set[tuple[str, str]] = set()
    for row in normalized:
        def flag(rule: str) -> None:
            findings.add(rule)
            events.add((row['flow_ref'], rule))

        if address_count[row['refund_address_ref']] > 1:
            flag('SWAP-REFUND-ADDRESS-REUSE')
        if scope_count[row['viewing_scope_ref']] > 1:
            flag('SWAP-VIEWING-SCOPE-REUSE')
        if row['published_publicly'] and scope_count[row['viewing_scope_ref']] > 1:
            flag('SWAP-PUBLIC-REFUND-UNSCOPED')
        if row['lookup_mode'] != 'private_claimed':
            flag('SWAP-REFUND-LOOKUP-DISCLOSURE')
        if row['spending_key_custody'] != 'wallet_claimed':
            flag('SWAP-SPENDING-KEY-CUSTODY-UNVERIFIED')
    return {
        'schema_version': 1, 'passed': not findings, 'flows_checked': len(normalized),
        'public_refund_flows': sum(bool(row['published_publicly']) for row in normalized),
        'finding_count': len(findings), 'rule_ids': sorted(findings),
        'status': 'declaration_review_only', 'limitation': LIMITATION,
    }, events


def audit_manifest(manifest: object) -> dict[str, object]:
    """Sanitized, single-manifest privacy-declaration review."""
    return _evaluate_manifest(manifest)[0]


def compare_manifests(baseline: object, current: object) -> dict[str, object]:
    """Diff per-flow risk events without ever exporting opaque references.

    A rule already present in the baseline can still be *new* on another
    flow. New flow IDs are treated as new integration declarations.
    """
    before, old_events = _evaluate_manifest(baseline)
    after, new_events = _evaluate_manifest(current)
    added = new_events - old_events
    resolved = old_events - new_events
    return {
        'schema_version': 1,
        'passed': not added,
        'status': 'declaration_regression_review_only',
        'baseline_flows_checked': before['flows_checked'],
        'current_flows_checked': after['flows_checked'],
        'baseline_risk_events': len(old_events),
        'current_risk_events': len(new_events),
        'new_risk_events': len(added),
        'resolved_risk_events': len(resolved),
        'new_rule_ids': sorted({rule for _, rule in added}),
        'resolved_rule_ids': sorted({rule for _, rule in resolved}),
        'limitation': (
            'Only application-declared logical flow identity and static risk changes. '
            'It cannot attest stable wallet identity, viewing-key isolation, private lookup, '
            'quantum resistance or transaction privacy. References are never returned.'
        ),
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



def sarif_report(report: dict[str, object]) -> dict[str, object]:
    """Portable SARIF 2.1.0 rules without source locations or sensitive refs."""
    expected = ('new_rule_ids' if report.get('status') == 'declaration_regression_review_only'
                else 'rule_ids')
    present = report.get(expected)
    if type(present) is not list or any(type(rule) is not str or rule not in RULES for rule in present):
        raise RefundAuditInputError('Invalid internal audit findings.')
    ordered = sorted(set(present))
    return {
        '$schema': 'https://json.schemastore.org/sarif-2.1.0.json',
        'version': '2.1.0',
        'runs': [{
            'tool': {'driver': {
                'name': 'Zerynex Refund Privacy Audit',
                'informationUri': 'https://zerynex.vercel.app/docs/refund-privacy-audit',
                'semanticVersion': '0.1.0',
                'rules': [
                    {'id': name,
                     'shortDescription': {'text': 'Review declared Zcash swap refund privacy exposure'},
                     'helpUri': 'https://zerynex.vercel.app/docs/refund-privacy-audit'}
                    for name in RULES
                ],
            }},
            'results': [
                {'ruleId': name, 'level': 'warning',
                 'message': {'text': 'Application-declared refund privacy risk requires review.'}}
                for name in ordered
            ],
            'properties': {
                'declarationOnly': True,
                'mode': 'regression' if expected == 'new_rule_ids' else 'full_audit',
                'warningCount': len(ordered),
                'noInputLocations': True,
            },
        }],
    }

def main() -> None:
    parser = argparse.ArgumentParser(description='Offline self-declared swap refund and viewing-key isolation audit.')
    parser.add_argument('--manifest', required=True, help='Current local public-safe metadata JSON, never addresses or keys')
    parser.add_argument('--baseline', help='Optional earlier metadata JSON: fail only on newly introduced per-flow risks')
    output = parser.add_mutually_exclusive_group()
    output.add_argument('--json', action='store_true', help='Sanitized machine-readable report')
    output.add_argument('--sarif', action='store_true', help='Location-free SARIF 2.1.0 warnings')
    args = parser.parse_args()
    try:
        if args.baseline:
            before = read_manifest(args.baseline)
            after = read_manifest(args.manifest)
            try:
                same = os.path.samefile(args.baseline, args.manifest)
            except OSError:
                raise RefundAuditInputError('Manifest files are unavailable.') from None
            if same:
                raise RefundAuditInputError('Baseline and current file must differ.')
            report = compare_manifests(before, after)
        else:
            report = audit_manifest(read_manifest(args.manifest))
    except RefundAuditInputError:
        print('Refund privacy metadata rejected; no input contents were printed.', file=sys.stderr)
        raise SystemExit(1) from None
    if args.json:
        print(json.dumps(report, indent=2))
    elif args.sarif:
        print(json.dumps(sarif_report(report), indent=2))
    else:
        if args.baseline:
            print('Refund privacy regression:', 'NO NEW DECLARED RISKS' if report['passed'] else 'NEW RISKS DETECTED')
            print('New events:', report['new_risk_events'], 'Rule IDs:', ', '.join(report['new_rule_ids']))
        else:
            print('Refund privacy metadata:', 'NO DECLARED RISKS' if report['passed'] else 'REVIEW REQUIRED')
            print('Flows:', report['flows_checked'], 'Rule IDs:', ', '.join(report['rule_ids']))
    raise SystemExit(0 if report['passed'] else 2)

if __name__ == '__main__':
    main()
