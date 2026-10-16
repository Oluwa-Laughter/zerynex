"""Privacy-conscious local Z3 Zebra liveness/readiness checks.

Uses ONLY the documented public health routes on an explicitly loopback-only
endpoint. No arbitrary hostnames, DNS resolution, wallet JSON-RPC, auth cookies,
transaction data, node credentials, or external network calls.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from http.client import HTTPConnection, HTTPException
import ipaddress
import json
from typing import Literal

from .client import ZerynexError

Status = Literal["healthy", "not_ready", "unavailable"]

@dataclass(frozen=True)
class ZebraHealthReport:
    endpoint: str
    liveness: Status
    readiness: Status
    summary: str
    source: str = "Z3 Zebra documented /healthy and /ready endpoints"
    caution: str = "This tests a local health endpoint only. It does not validate consensus, Zaino gRPC, or Zallet wallet functionality."

    def as_dict(self) -> dict[str, str]:
        return asdict(self)


def _safe_loopback_host(host: str) -> str:
    if host == "localhost":
        return "127.0.0.1"  # Avoid OS proxy and non-loopback DNS surprises.
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        raise ZerynexError("Only numeric loopback addresses or localhost are allowed.") from None
    if not addr.is_loopback:
        raise ZerynexError("Z3 diagnostics may connect to loopback only.")
    return addr.compressed


def _query(host: str, port: int, route: str, timeout: float) -> int | None:
    connection = HTTPConnection(host, port, timeout=timeout)
    try:
        connection.request("GET", route, headers={"Accept": "text/plain", "Connection": "close"})
        response = connection.getresponse()
        # A health response may contain implementation detail; discard the body
        # rather than putting it into logs or an agent response.
        response.read(4096)
        return response.status
    except (OSError, TimeoutError, HTTPException):
        return None
    finally:
        connection.close()


def check_zebra_local(
    *,
    host: str = "127.0.0.1",
    port: int = 8080,
    timeout: float = 1.5,
) -> ZebraHealthReport:
    """Check Z3/Zebra local liveness and readiness; never scan public hosts."""
    safe_host = _safe_loopback_host(host)
    if type(port) is not int or not 1 <= port <= 65535:
        raise ZerynexError("Invalid local Zebra health port.")
    if not isinstance(timeout, (float, int)) or not (0 < timeout <= 3):
        raise ZerynexError("Timeout must be greater than zero and at most three seconds.")
    live = _query(safe_host, port, "/healthy", float(timeout))
    ready = _query(safe_host, port, "/ready", float(timeout))

    liveness: Status = "healthy" if live == 200 else "not_ready" if live is not None else "unavailable"
    readiness: Status = "healthy" if ready == 200 else "not_ready" if ready is not None else "unavailable"
    if live == 200 and ready == 200:
        summary = "Zebra's local health and readiness endpoints both returned HTTP 200."
    elif live == 200:
        summary = "Zebra's local liveness endpoint responded, but readiness is not confirmed."
    else:
        summary = "Zebra liveness is not confirmed. Check the local Z3 services and port mapping."
    return ZebraHealthReport(
        endpoint=f"{safe_host}:{port}",
        liveness=liveness,
        readiness=readiness,
        summary=summary,
    )


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Zerynex: local-only Z3 Zebra health diagnostics")
    parser.add_argument("--host", default="127.0.0.1", help="localhost or numeric loopback only")
    parser.add_argument("--port", type=int, default=8080, help="Z3_ZEBRA_HOST_HEALTH_PORT")
    parser.add_argument("--timeout", type=float, default=1.5, help="Request timeout, at most three seconds")
    args = parser.parse_args()
    try:
        result = check_zebra_local(host=args.host, port=args.port, timeout=args.timeout)
    except ZerynexError:
        parser.exit(1, "Invalid or disallowed local health probe configuration.\n")
    print(json.dumps(result.as_dict(), indent=2))
    if result.liveness != "healthy" or result.readiness != "healthy":
        parser.exit(2)


if __name__ == "__main__":
    main()
