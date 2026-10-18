"""Read-only Zcash node readiness for application developers.

Only getblockchaininfo on an explicit numeric loopback endpoint; never remote
hosts, payment RPCs, wallet methods, transaction content or agent access.
Cookie authentication is sourced from an operator-owned local file, never argv.
"""
from __future__ import annotations

import argparse
import base64
from dataclasses import asdict, dataclass
from http.client import HTTPConnection, HTTPException
import json
import math
import os
from pathlib import Path
import stat
from typing import Any

from .client import ZerynexError
from .z3 import _safe_loopback_host

MAX_RESPONSE = 64 * 1024
MAX_COOKIE = 4096
REQUEST_ID = 'zerynex-readiness-v1'


@dataclass(frozen=True)
class NodeReadiness:
    schema_version: int
    network: str | None
    expected_network: str
    height: int | None
    headers: int | None
    header_lag: int | None
    initial_sync_complete: bool | None
    verification_progress: float | None
    ready: bool
    checks: tuple[dict[str, str], ...]
    limitation: str = ('Local JSON-RPC chain-state observation only; not wallet readiness, '
                       'spend authority, Zallet compatibility, consensus audit, or privacy proof.')

    def as_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data['checks'] = list(self.checks)
        return data


def _int(value: Any) -> int | None:
    return value if type(value) is int and 0 <= value <= 2**32 - 1 else None


def evaluate_blockchain_info(
    result: object, *, expected_network: str = 'test', max_header_lag: int = 2,
    min_verification_progress: float = 0.999,
) -> NodeReadiness:
    """Evaluate untrusted RPC output using an explicit, conservative policy.

    No original response fields are returned; especially no hashes, addresses,
    value pools, error messages, or opaque server-provided strings.
    """
    if expected_network not in ('main', 'test', 'regtest'):
        raise ZerynexError('Expected Zcash network must be main, test, or regtest.')
    if type(max_header_lag) is not int or not 0 <= max_header_lag <= 1000:
        raise ZerynexError('Invalid maximum header lag.')
    if (type(min_verification_progress) not in (int, float) or
            not math.isfinite(min_verification_progress) or
            not 0 < min_verification_progress <= 1):
        raise ZerynexError('Invalid verification progress threshold.')
    if not isinstance(result, dict):
        raise ZerynexError('Node returned an invalid blockchain information object.')

    network = result.get('chain')
    network = network if type(network) is str and network in ('main', 'test', 'regtest') else None
    height = _int(result.get('blocks'))
    headers = _int(result.get('headers'))
    header_lag = max(0, headers - height) if height is not None and headers is not None else None
    # zcashd names this boolean initial_block_download_complete; some node
    # variants expose initialblockdownload instead. Unknown fails closed.
    ibd_complete = result.get('initial_block_download_complete')
    if type(ibd_complete) is not bool:
        ibd = result.get('initialblockdownload')
        ibd_complete = not ibd if type(ibd) is bool else None
    progress = result.get('verificationprogress')
    progress = float(progress) if type(progress) in (int, float) and math.isfinite(progress) and 0 <= progress <= 1 else None
    checks = (
        {'code': 'NETWORK_MATCH', 'status': 'pass' if network == expected_network else 'fail' if network else 'unknown'},
        {'code': 'CHAIN_HEIGHT', 'status': 'pass' if height is not None and headers is not None and headers >= height else 'fail' if height is not None and headers is not None else 'unknown'},
        {'code': 'HEADER_LAG', 'status': 'pass' if header_lag is not None and header_lag <= max_header_lag else 'fail' if header_lag is not None else 'unknown'},
        {'code': 'INITIAL_SYNC', 'status': 'pass' if ibd_complete is True else 'fail' if ibd_complete is False else 'unknown'},
        {'code': 'VERIFICATION_PROGRESS', 'status': 'pass' if progress is not None and progress >= min_verification_progress else 'fail' if progress is not None else 'unknown'},
    )
    return NodeReadiness(
        schema_version=1, network=network, expected_network=expected_network,
        height=height, headers=headers, header_lag=header_lag,
        initial_sync_complete=ibd_complete, verification_progress=progress,
        ready=all(check['status'] == 'pass' for check in checks), checks=checks,
    )


def _cookie_authorization(cookie_file: Path | None) -> str | None:
    if cookie_file is None:
        return None
    try:
        path = Path(cookie_file)
        flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0)
        if path.is_symlink():
            raise OSError
        fd = os.open(path, flags)
        with os.fdopen(fd, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_size > MAX_COOKIE or
                    info.st_size == 0 or (info.st_mode & 0o077) != 0):
                raise OSError
            raw = stream.read(MAX_COOKIE + 1)
        if len(raw) > MAX_COOKIE or b':' not in raw or any(b < 33 or b > 126 for b in raw):
            raise OSError
        return 'Basic ' + base64.b64encode(raw).decode('ascii')
    except (OSError, TypeError, ValueError):
        raise ZerynexError('RPC cookie is invalid or not owner-private (0600 or 0400).') from None


def inspect_node_local(
    *, host: str = '127.0.0.1', port: int = 8232, timeout: float = 1.5,
    expected_network: str = 'test', max_header_lag: int = 2,
    cookie_file: Path | None = None,
) -> NodeReadiness:
    """Make precisely one loopback-only, read-only getblockchaininfo RPC call."""
    safe_host = _safe_loopback_host(host)
    if type(port) is not int or not 1 <= port <= 65535:
        raise ZerynexError('Invalid local RPC port.')
    if type(timeout) not in (int, float) or not math.isfinite(timeout) or not 0 < timeout <= 3:
        raise ZerynexError('RPC timeout must be between zero and three seconds.')
    # Validate policy before network use.
    evaluate_blockchain_info({}, expected_network=expected_network, max_header_lag=max_header_lag)
    auth = _cookie_authorization(cookie_file)
    headers = {'Content-Type':'application/json', 'Accept':'application/json', 'Connection':'close'}
    if auth:
        headers['Authorization'] = auth
    request = json.dumps({'jsonrpc': '1.0', 'id': REQUEST_ID,
                          'method': 'getblockchaininfo', 'params': []}, separators=(',', ':'))
    connection = HTTPConnection(safe_host, port, timeout=float(timeout))
    try:
        connection.request('POST', '/', body=request, headers=headers)
        response = connection.getresponse()
        if response.status != 200:
            raise ZerynexError('Local Zcash RPC is unavailable or rejected the request.')
        if (response.getheader('Content-Length') and
                int(response.getheader('Content-Length')) > MAX_RESPONSE):
            raise ZerynexError('Local Zcash RPC response exceeds the size limit.')
        body = response.read(MAX_RESPONSE + 1)
        if len(body) > MAX_RESPONSE:
            raise ZerynexError('Local Zcash RPC response exceeds the size limit.')
        parsed = json.loads(body)
        if (not isinstance(parsed, dict) or parsed.get('id') != REQUEST_ID or
                parsed.get('error') is not None or 'result' not in parsed):
            raise ZerynexError('Local Zcash RPC returned an invalid envelope.')
        return evaluate_blockchain_info(parsed['result'], expected_network=expected_network,
                                        max_header_lag=max_header_lag)
    except ZerynexError:
        raise
    except (OSError, TimeoutError, HTTPException, ValueError, TypeError, UnicodeError, OverflowError):
        raise ZerynexError('Local Zcash RPC request failed or returned invalid data.') from None
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description='Zerynex read-only local Zcash node compatibility probe')
    parser.add_argument('--host', default='127.0.0.1', help='Numeric loopback or localhost only')
    parser.add_argument('--port', type=int, default=8232)
    parser.add_argument('--timeout', type=float, default=1.5)
    parser.add_argument('--expect-network', default='test', choices=['main','test','regtest'])
    parser.add_argument('--max-header-lag', type=int, default=2)
    parser.add_argument('--cookie-file', type=Path, help='Local owner-private RPC cookie; never supply credentials on argv')
    args = parser.parse_args()
    try:
        report = inspect_node_local(host=args.host,port=args.port,timeout=args.timeout,
                                    expected_network=args.expect_network,
                                    max_header_lag=args.max_header_lag,cookie_file=args.cookie_file)
    except ZerynexError:
        parser.exit(1, 'Zerynex: local node probe failed or configuration rejected.\n')
    print(json.dumps(report.as_dict(),indent=2))
    if not report.ready:
        parser.exit(2)


if __name__ == '__main__':
    main()
