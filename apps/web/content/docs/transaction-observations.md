# Zcash transaction observations and confirmation policies

Use `@zerynex/sdk` to evaluate **read-only** `getrawtransaction(txid, 1)` responses against a trusted node's `getblockchaininfo` result. This SDK capability supports Zcash checkout backends, indexers, explorers, private markets, relayers, and status dashboards without giving the SDK wallet or RPC access.

It checks a reported transaction ID, expected network, observed chain height, inclusion block hash, transaction height, confirmation arithmetic, active-chain flags, and an **explicit** confirmation threshold. Reports deliberately exclude transaction IDs, block hashes, amounts, addresses, memos, scripts, and full RPC bodies.

## What it does and does not verify

This is **one node's claim about a transaction**. A passing confirmation target **does not** prove that a merchant was paid, the output belongs to a particular wallet, a shielded note was received, that the node is honest, that consensus is valid, or that the payment is irreversible. Your application remains responsible for inspecting the actual transaction and recipient, validating account ownership and chain consensus, choosing a confirmation policy, and accounting for reorganizations and expiries.

The [Zcash `getrawtransaction` reference](https://zcash.github.io/rpc/getrawtransaction.html) describes verbose result fields `txid`, `blockhash`, `height`, `confirmations`, and optionally `in_active_chain` for a block-specific lookup. The [Zcash `getblockchaininfo` reference](https://zcash.github.io/rpc/getblockchaininfo.html) reports current network and block height. Without `-txindex`, zcashd's historical `getrawtransaction` lookup may require a known block hash; failure to find the transaction is *not evidence that it does not exist*. Zallet's [JSON-RPC compatibility notes](https://github.com/zcash/zallet/blob/main/book/src/zcashd/json_rpc.md) also describe differences in the optional block-hash lookup parameter.

**No remote RPC endpoint is implemented by this function.** Supply result objects from your own trusted backend/node client. Avoid using public third-party RPC providers for private transaction data; never send wallet-scoped RPC responses to public dashboards or CI.

## SDK usage: independently fetched public results

```typescript
import { evaluateZcashTransaction } from '@zerynex/sdk'

// Implement these read-only calls in YOUR trusted backend.
// Never put node authentication credentials in the browser.
const rawTx = await trustedNode.getRawTransaction(expectedTxid, 1)
const chainState = await trustedNode.getBlockchainInfo()

const status = evaluateZcashTransaction(rawTx, chainState, {
  expectedNetwork: 'test',
  expectedTxid,           // 64-character transaction hash; not echoed
  requiredConfirmations: 6,
})

if (status.confirmation_target_met) {
  // The node reports >=6 *internally consistent* confirmations.
  // Continue independent recipient, wallet receipt, and settlement checks.
}
```

`getRawTransaction` and `getBlockchainInfo` in the example are **your application-owned adapter methods**, not SDK methods. Neither the SDK nor the browser workbench calls them on your behalf. Use the raw method result objects (not entire JSON-RPC envelopes). Never trust a client-provided RPC result as evidence of a payment.

## Detect possible reorganizations across observations

```typescript
import { createZcashTransactionObserver } from '@zerynex/sdk'

const observer = createZcashTransactionObserver({
  expectedNetwork: 'test',
  expectedTxid,
  requiredConfirmations: 6,
})
const first = observer.observe(rawTxAtHeight100, chainAtHeight100)
const second = observer.observe(rawTxAtHeight101, chainAtHeight101)

if (second.possible_reorg) {
  // Do not mark the payment as settled.
  // Re-query a trusted canonical source and verify transaction inclusion.
}
observer.reset() // discard in-memory history
```

The observer retains only its last reported block hash and counts **privately in memory** to compare snapshots. Its report includes no hashes or transaction IDs. Decreasing chain height/confirmations, a changed inclusion block hash, or disappearance from a previously confirmed chain can trigger `possible_reorg`. These are diagnostic hints, **not a proof that consensus reorganized**. Observations must belong to the same trusted transaction and node policy. The status can return `unavailable` for missing RPC data without claiming transaction absence.

## States and failure modes

| State | Meaning |
| --- | --- |
| `confirmation_target_met` | Node's inclusion height and confirmations match its reported tip, and meet the requested threshold |
| `confirming` | Consistent positive confirmations below the threshold |
| `unconfirmed` | The node reports zero confirmations without an inclusion block |
| `orphaned` | Explicit inactive-chain evidence and negative confirmations |
| `wrong_network` | Chain name disagrees with the expected network |
| `unavailable` | Transaction result is unavailable; not proof of absence |
| `inconsistent` | Mismatched ID, height, confirmations, or contradictory active-chain status |
| `unknown` | Required RPC data is missing or its type is invalid |

Malformed policies throw a fixed `TypeError`; response content is never reproduced in error text. `expectedNetwork`, `expectedTxid` (exact 64 hexadecimal characters), and `requiredConfirmations` (1–10,000) are **required**. Changing the policy requires creating a new observer. Returned objects include six checks: network match, transaction ID, chain height, confirmation consistency, active-chain state, and confirmation target.

## Try the workbench

The [Transaction Observation Workbench](/tools/transaction) provides **synthetic sample responses**, expected-network selection and read-only local evaluation. It never calls the node, uploads pasted data, or authorizes transactions. Re-evaluate an updated synthetic sample in the same tab to inspect possible reorganization warnings.

## Trust boundary for Zcash agents

AI/MCP agents may inspect synthetic cases and sanitized observation reports but **must not** infer payment completion or initiate signing, refund, checkout release, or bridge settlement from a threshold-met flag. Restrict real transaction lookups and wallet-sensitive data to trusted application infrastructure. No transaction finality or real Zebra/Zallet cross-version compatibility certification is claimed.

See [Node readiness](node-readiness.md), [ZIP-321 requests](payment-requests.md), [Wallet handoffs](wallet-handoffs.md) and [Zcash application recipes](zcash-app-recipes.md).
