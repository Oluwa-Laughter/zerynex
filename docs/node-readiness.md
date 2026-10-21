# Zcash node readiness API

A Zcash product should verify that its node is on the **intended network and sufficiently synchronized** before relying on its chain state. Zerynex provides a reusable, **read-only local RPC probe** and a pure TypeScript/JavaScript normalizer for `getblockchaininfo`. This works for infrastructure behind shielded payment apps, wallets, indexers, private markets, and cross-chain integrations.

The protocol inputs come from the documented `getblockchaininfo` method in [Zcash RPC](https://zcash.github.io/rpc/getblockchaininfo.html) and [Zebra's RPC implementation](https://zebra.zfnd.org/internal/src/zebra_rpc/methods.rs.html). Implementations can vary: Zerynex understands `initial_block_download_complete` or the inverse `initialblockdownload` field, and **does not guess readiness when a required field is absent**.

## Try without installing anything

Use the [browser node-readiness workbench](/tools/node) to inspect a **public** `getblockchaininfo` response or load a synthetic example. This view does no network connection and keeps the input in the current browser tab; no raw RPC material is uploaded. It does not accept RPC credentials, and is not a way to connect a wallet.

## Python: live loopback node (opt-in)

Install a built `zerynex-python` wheel or the source package (see [Python SDK](python-api.md)); this tool does **not** require a Rust PCZT binary.

```bash
# Read-only RPC to a local node. Set port/network to YOUR node configuration.
zerynex-node-check --host 127.0.0.1 --port 8232 \
  --expect-network test --max-header-lag 2
```

For nodes using basic authentication via an RPC cookie, supply the path to an **owner-private** cookie file (permission mode `0600` or `0400`). Zerynex reads it locally and never includes it in CLI arguments, output, or errors:

```bash
zerynex-node-check --host 127.0.0.1 --port 8232 \
  --expect-network main --cookie-file /path/to/private/.cookie
```

The endpoint is restricted to numeric loopback addresses (`127.0.0.1`, `::1`) or `localhost`, which is normalized to `127.0.0.1`. It calls exactly **one allowlisted method, `getblockchaininfo`**, using a bounded HTTP response (64 KiB) and a finite timeout (maximum 3 seconds). No arbitrary RPC method, remote URL, host scanning, RPC shell, wallet RPC, transaction lookup, or broadcast is exposed. For remote infrastructure, run the probe alongside that node via a trusted local agent or SSH tunnel; do not expose the node publicly for this check.

**Exit codes** are `0` for checks passed, `2` for a well-formed report whose node is not yet ready (or is on the wrong network), and `1` for rejected settings, failed authentication, RPC failures, or invalid response format. Never treat exit `1` as ready. This is **not** a node consensus audit.

## Python: use inside an application

```python
from zerynex_py import inspect_node_local

status = inspect_node_local(
    port=8232,
    expected_network="test",  # explicitly choose main, test, or regtest
    max_header_lag=2,
)
if not status.ready:
    raise RuntimeError("Zcash chain state is not sufficiently ready")

print(status.height, status.network)  # public chain state only
```

Use `evaluate_blockchain_info(result, expected_network="test")` when your application already has a response from its own trusted node client. This **pure** function performs no network calls. Never forward credential-bearing RPC envelopes to client-side applications; pass only the public `result` fields or the sanitized `status.as_dict()`.

## TypeScript/browser: normalize a trusted result

The `@zerynex/sdk` tarball exports `evaluateZcashNodeStatus()` without WASM initialization or network requests:

```typescript
import { evaluateZcashNodeStatus } from '@zerynex/sdk'

// Read-only result from your OWN trusted backend / node adapter.
const response = await yourBackend.getBlockchainInfo()
const status = evaluateZcashNodeStatus(response, {
  expectedNetwork: 'test',
  maxHeaderLag: 2,
})
if (!status.ready) {
  // Block sensitive workflows or show a sync/network warning.
  console.log(status.checks)
}
```

`yourBackend` is an application-owned integration—not a function provided by Zerynex. Never put node RPC credentials in browser code. Because the function is pure, it can run in React, Next.js, Node.js, or a mobile JavaScript runtime using an existing trusted RPC connection.

### Zebra field compatibility note

The [Zcash `getblockchaininfo` reference](https://zcash.github.io/rpc/getblockchaininfo.html) documents `initial_block_download_complete`, `headers`, and `verificationprogress`. However, the [Zebra zcashd API migration guide](https://zebra.zfnd.org/user/zcashd-api-migration-guide.html) currently lists `getblockchaininfo` as **partially implemented** and specifically says `initial_block_download_complete` is absent, with some values placeholders. On a Zebra version lacking both supported initial-sync flags, this adapter returns `INITIAL_SYNC: unknown` and **`ready: false`**, even when height and header-lag checks appear healthy. This is intentional fail-closed behavior—not a false claim that the Zebra node is broken.

If you operate Zebra, combine this with its [documented local `/healthy` and `/ready` Z3 probes](z3-local.md) and your own version-pinned node integration. These are distinct signals; neither alone proves a node is suitable for wallet signing or settlement.

## Output and fail-closed semantics

Both SDKs produce a sanitized object with `schema_version`, `network`, `expected_network`, `height`, `headers`, `header_lag`, `initial_sync_complete`, `verification_progress`, `ready`, and five checks: `NETWORK_MATCH`, `CHAIN_HEIGHT`, `HEADER_LAG`, `INITIAL_SYNC`, `VERIFICATION_PROGRESS`. Each check is `pass`, `fail`, or `unknown`; *every check must pass* before `ready` is true. Default progress threshold: `0.999` (99.9%); default maximum header lag: `2`.

No block hashes, transaction data, wallet balances, user addresses, viewing keys, server metadata, full RPC bodies or credentials are returned. Tests cover malformed, missing and malicious values as well as live mock HTTP, cookie safety, CLI exit codes and source-package consistency.

**Trust boundary:** This checks the RPC-reported state of one node, not the truth of the network. A compromised node can lie. Wallet readiness, Zallet JSON-RPC support, custody authorization, shielded-payment completion, finality, proof validity and privacy guarantees require separate verification.

Read [Zcash application recipes](zcash-app-recipes.md) to combine node readiness with PCZT policy and transaction-stage regression checks.

## lightwalletd: offline gRPC metadata readiness (TypeScript, preview)

Zerynex also exports `evaluateLightwalletdInfo` for developers with an
existing trusted `CompactTxStreamer/GetLightdInfo` response. It accepts
the standard protobuf JSON names (`chainName`, `blockHeight`,
`estimatedHeight`, `saplingActivationHeight`, `consensusBranchId`).
The gRPC `uint64` fields may be decimal strings, as emitted by `grpcurl`.

```typescript
import { evaluateLightwalletdInfo } from '@zerynex/sdk'

// Your backend owns the trusted gRPC connection, TLS, and authentication.
// Never put private wallet material or server credentials in a browser.
const status = evaluateLightwalletdInfo(yourBackend.getLightdInfoResult, {
  expectedNetwork: 'test',
  maxHeightLag: 2,
})
if (!status.ready) console.warn(status.checks)
```

This is a **pure, offline** normalizer: no gRPC calls, endpoints, credentials,
transaction data or network access. It produces five checks for network,
height, Sapling activation, estimated-height lag and presence of a
well-formed consensus branch identifier. Missing fields are **unknown** and
cannot yield a ready state. Reported height numbers and check codes may be
returned; server version, vendor, donation address, source metadata and
other raw input fields are never echoed.

The value `ready: true` only indicates that one **untrusted, self-reported**
metadata snapshot matches the supplied policy. A compromised backend could
lie; a working `GetLightdInfo` does not prove consensus correctness,
complete shielded syncing, transaction settlement or wallet privacy.
This feature is **preview** until actual version-pinned lightwalletd/Zebra
gRPC integration tests exist.

Protocol references:
[lightwallet-protocol service.proto](https://github.com/zcash/lightwallet-protocol/blob/main/walletrpc/service.proto)
and [lightwalletd health check](https://github.com/zcash/lightwalletd#health-check).
