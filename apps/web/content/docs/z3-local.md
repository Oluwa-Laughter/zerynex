# Z3 node health checks (early access)

Zerynex provides a read-only, loopback-only health checker for the
Zcash Foundation's Z3 stack: https://github.com/ZcashFoundation/z3

Z3 includes Zebra (consensus node), Zallet (wallet) and optional Zaino
(indexer). Zerynex does not replace these services, run a node for users,
hold credentials, or provide a wallet.

## Documented health endpoints

The checker sends only:
- GET /healthy — Zebra liveness and minimum peer connectivity.
- GET /ready — Zebra readiness near the network tip.

No Zallet RPC call, wallet authorization, authentication cookie, remote host,
arbitrary URL or custom endpoint is permitted.

## Install and check your own node

    cargo build --locked --release
    python -m venv .venv
    .venv/bin/python -m pip install ./packages/python

Start your Z3 services following upstream documentation. Determine the
Z3_ZEBRA_HOST_HEALTH_PORT variable (often 8080) in your own configuration.

    .venv/bin/zerynex-z3-check --host 127.0.0.1 --port 8080

Exit status 0 = both health endpoints returned HTTP 200; 2 = at least
one endpoint was not confirmed ready; 1 = invalid local probe options.
A 200 from /healthy does NOT mean /ready passed.

This is a local diagnostic, NOT consensus validation. It does not check
Zallet wallet functionality or Zaino gRPC and cannot be treated as proof
that an external node is reliable. Local services could spoof these endpoints.

## Security

Do not expose a wallet RPC address, viewing key or authentication cookie
to an agent, public URL or website. Use a loopback-bound Zebra health port.
The health checker never returns the HTTP body to the caller.
