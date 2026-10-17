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

## Saved Zallet `rpc.discover` results (offline)

Zerynex now accepts either the **bare OpenRPC schema** or a locally saved
**JSON-RPC 2.0 `rpc.discover` response** as `--schema`. The latter must have
exactly `jsonrpc`, `id`, and `result` fields, with `result` containing
the OpenRPC document. RPC errors, duplicate JSON keys, invalid IDs and
unexpected fields are rejected without copying payload contents into error output.

Try the **synthetic** saved response, which is not evidence of compatibility
with a real Zallet build:

```bash
python3 scripts/check_rpc_contract.py \
  --schema tests/fixtures/rpc/zallet-synthetic-discover-response.json \
  --contract tests/fixtures/rpc/zallet-minimum-contract.json --json
```

For a real integration, obtain `rpc.discover` only from a locally controlled,
trusted wallet instance. Store the resulting schema in a protected path outside
public CI, record the exact Zallet binary version and source commit, and
compare against your reviewed contract. **Do not upload wallet configuration,
authentication cookies, real PCZTs, or sensitive RPC responses.** The checker
makes no network connection and does not verify runtime Zallet behavior.

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
