# Offline Zcash RPC contract checks

Zerynex includes an **early, offline OpenRPC contract checker** for wallet
and infrastructure developers. It is not an RPC client, remote scanner,
live Zallet compatibility guarantee, or replacement for Zallet.

The official [Zallet RPC reference](https://zcash.github.io/zallet/rpc/index.html)
documents a machine-readable schema through the rpc.discover method.
Zallet is beta software, and its RPC interface can change.

## Check a local OpenRPC contract

    python3 scripts/check_rpc_contract.py --schema tests/fixtures/rpc/zallet-synthetic-openrpc.json --contract tests/fixtures/rpc/zallet-minimum-contract.json --json

Exit status: 0 contract satisfied, 2 missing/changed declarations,
1 input error. The sample OpenRPC description is **hand-authored synthetic
documentation**, not captured from a released Zallet binary.

## Usage

Contracts list method names and ordered parameters, with a required flag.
Additional methods are accepted. All evaluation is local: no RPC URL,
credentials, cookies, wallet keys or network calls are necessary.

The output contains only declared method/parameter names and their status.
It does not print RPC request/response values.

## Limitations

This tool does not test parameter types, runtime semantics, signing,
authorization, network configuration, proof validity, RPC connectivity or
consensus. Before claiming compatibility with a real Zallet release,
review and test its pinned upstream OpenRPC schema. Read the
[Zallet migration guide](https://github.com/zcash/zallet/blob/main/book/src/zcashd/json_rpc.md).
