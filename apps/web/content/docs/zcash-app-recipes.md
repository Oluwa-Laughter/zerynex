# Zcash application integration recipes

Zerynex is a **developer integration toolkit**, not a single-purpose website or a replacement wallet. These patterns show how to use the tested, composable building blocks in real Zcash products. They map to Zecathon's **Shielded Payments, Private Markets, Cross-Chain, Core & Tooling, and Wildcard** categories, but work for projects outside hackathons too.

## Building blocks you can use now

| Interface | What it does | What it does **not** do |
| --- | --- | --- |
| `zerynex-node-check` / `inspect_node_local()` | Checks one explicitly local Zcash node's chain/network/sync state | Wallet signing, broadcasting, endpoint discovery, consensus verification |
| `evaluateZcashNodeStatus()` (TypeScript) | Converts trusted `getblockchaininfo` data to a typed, sanitized app readiness result | Connects to remote nodes or manages secrets |
| `zerynex --json` / Rust/WASM SDK | Evaluates structural PCZT disclosure policies | Constructs, authorizes or sends Zcash payments |
| `compareStages()` / `--compare-with` | Flags selected PCZT policy and component-count changes across local stages | Proves two transactions cryptographically equivalent |
| `zerynex --sarif` / GitHub Action | Exports structural privacy findings for review on synthetic fixtures | Full vulnerability scanning, real-wallet fixtures in public CI |
| `zerynex-rpc-check` | Checks method contracts against pinned Zallet-style RPC schemas | Live Zallet signing compatibility or wallet certification |
| MCP agent tools | Read-only synthetic fixture tests and capability discovery | Access to users' wallets, raw private PCZTs or arbitrary live RPC |

## Shielded Payments: guard checkout infrastructure

On your private backend, require a correct and sufficiently synchronized chain before polling for a deposit or generating a wallet handoff:

```python
from zerynex_py import inspect_node_local

node = inspect_node_local(expected_network="test", port=8232)
if not node.ready:
    raise RuntimeError("Checkout temporarily unavailable: node sync/network check failed")

# Next: call the REAL wallet/payment provider that your application controls.
# Zerynex does not construct invoices, confirm deposits or authorize spends.
```

The wallet or checkout application can additionally use [ZIP-321 request validation](payment-requests.md) to parse supported ZEC requests and exact zatoshi amounts before handing them to a trusted wallet. It remains responsible for selecting supported Unified Address receivers, constructing ZIP-321 payment requests, confirming deposits and handling chain reorganizations. Don't expose the customer's payment details or an RPC cookie to the browser.

## Private Markets: test policy boundaries before signing

If your wallet backend passes a PCZT from builder → prover → signer, run each intermediate PCZT through local Rust checks. Deny transparent components for a *shielded-only product policy*, not because Zcash prohibits them. The checked-in synthetic vectors exercise both clean and violating cases.

```bash
zerynex synthetic-before.pczt --compare-with synthetic-after.pczt \
  --deny-transparent --sarif > local-findings.sarif
```

Use synthetic fixtures in public CI; run checks on confidential actual PCZTs **only within your own trusted deployment**. This does not prove a market's privacy, commitment correctness, escrow rules, or solvency.

## Cross-Chain: prevent wrong-network assumptions

A bridge adapter or relayer can check the Zcash side's expected network and sync status before considering a cross-chain transfer ready for subsequent processing:

```typescript
import { evaluateZcashNodeStatus } from '@zerynex/sdk'
const status = evaluateZcashNodeStatus(zcashChainInfoFromYourTrustedBackend, {
  expectedNetwork: 'test',
  maxHeaderLag: 2,
})
if (!status.ready) throw new Error('Zcash leg not ready for relayer processing')
```

A Zebra node may omit the required initial-sync field; in that case `ready` remains false until an independently verified readiness policy is available. See [Node readiness](node-readiness.md#zebra-field-compatibility-note). This is a *precondition*, **not** cross-chain settlement or proof of finality. Bridging needs independent light-client, confirmation, proof and replay-protection design.

## Core & Tooling: reusable SDKs, CI and integrations

Use the Node.js-compatible normalizer and Python loopback probe in indexers, explorer backends, monitoring tools, developer dashboards, GitHub Actions runners and local integration tests. Pair it with Zerynex's CLI capability discovery and versioned privacy rule registry so your tooling can reject unsupported protocol versions.

For a runnable integration contract and security model, see [Node readiness](node-readiness.md), [TypeScript SDK](typescript-api.md), [Python SDK](python-api.md), [GitHub Action](github-action.md), and [Privacy rule registry](rule-registry.md).

## Wildcard: compose, don't trust blindly

Prototype merchant tooling, privacy monitors, AI-assisted development or wallet workflow automation by combining **offline structural checks**, **read-only node state**, and **application-owned signing/payment systems**. Keep MCP agents restricted to approved synthetic fixtures. A passed preflight or rule report must never become an unconditional wallet-signing instruction.

**Compatibility evidence:** Local parsing and normalization are tested against shared synthetic Zebra/zcashd response fixtures; a mock local HTTP node is used to exercise the transport and authentication. Production Zallet/Zebra nodes, live wallet handoff, private payments and bridge contracts have **not** been validated by this page.

### Wallet-provider integration boundary

Use the [wallet handoff coordinator](wallet-handoffs.md) to combine local ZIP-321 validation, exact-zatoshi and expected-network policies, declared trusted-provider capabilities, and an explicit host authorization callback. Handing a URI to a wallet is not confirmation of payment. Never grant autonomous agents access to the host authorization or provider-presentation methods.

## Read-only transaction confirmations for checkout and relayers

Use [Transaction observations](transaction-observations.md) to normalize an existing trusted backend’s `getrawtransaction(txid, 1)` and `getblockchaininfo` results. Your app chooses the expected network, expected transaction ID, and confirmation threshold. The SDK reports whether the node's own confirmation values are internally consistent and can flag possible reorganizations across observations. This **does not verify who received funds, wallet ownership, finality or cross-chain settlement**.
