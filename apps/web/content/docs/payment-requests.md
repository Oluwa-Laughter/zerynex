# ZIP-321 payment request tooling

Build Zcash checkout, wallet, split-payment, and merchant flows with **local ZIP-321 request validation**. Zerynex uses the canonical Rust PCZT codebase plus the published `zcash_address` address parser: recipient checksums and network identity are checked, not guessed from prefixes. This feature never creates a payment, accesses wallet keys, sends a transaction, or confirms settlement.

Reference: [ZIP-321: Payment Request URIs](https://zips.z.cash/zip-0321) (Active). Its standard supports multi-payment requests, eight-digit ZEC decimal amounts, unpadded base64url shielded memos, and required field negotiation. **Current implementation supports the ZEC subset; `req-asset` custom-asset requests fail closed until ZIP-227 asset semantics and receiver requirements are fully implemented.** Future extensions and omitted optional fields may not be interpreted. Full external-wallet interoperability is not yet verified.

## Browser / TypeScript SDK

The [local payment inspector](/tools/payment) is powered by the same Rust/WASM parser and returns **redacted structural summaries**. For a project that has installed the bundled `@zerynex/sdk` artifact:

```typescript
import { inspectZip321Uri } from '@zerynex/sdk/browser'

const report = await inspectZip321Uri(uriFromUser, 'test', {
  wasm: trustedWasmBytes, // or trusted bundled WASM asset URL
})
if (report.payments.length !== 1) throw new Error('Unexpected checkout recipient count')
if (report.total_zat !== 100_000_000) throw new Error('Unexpected ZEC amount')
```

The `inspectZip321Uri` report contains only the network, recipient count, receiver-type classification, amounts in integer zatoshis, and flags showing whether labels, messages, and memos are present. It **does not** return payment addresses or memo contents. The full URI stays in your application memory, so review destinations using the wallet's own trusted payment-request handling before prompting a signature. For a production wallet integration, do not treat this diagnostic report as permission to pay.

## Rust library: strict parsing and canonical encoding

```rust
use zerynex::payments::{parse_zip321, format_zip321, PaymentNetwork};
let request = parse_zip321(trusted_or_untrusted_uri, PaymentNetwork::Test)?;
// Trusted in-process code may inspect request.payments for wallet UI confirmation.
let canonical_uri = format_zip321(&request)?;
let redacted = request.summary();
```

Unlike diagnostic summaries, the Rust `PaymentRequest` model includes decoded addresses, memo base64url, labels, and messages for local wallet applications. **Do not log or upload this structure.** Build wallet-facing request flows only after separate destination review, app policy, supported receiver selection, sufficient funds, and explicit end-user consent.

The Rust parser rejects invalid Zcash address checksums and networks, Sprout addresses, transparent memo usage, duplicate indexed parameters, missing indexed addresses, invalid integer/decimal ZEC precision, unknown required `req-` fields, invalid base64url memos, oversized requests, and unsupported custom assets. Amounts are parsed as **integer zatoshis** to avoid floating-point payment errors. Current bounds: 16 KiB input, 32 recipients, 128 query parameters, 512 memo bytes, 256 bytes per decoded text field.

## Native CLI: safe stdin-only inspection

```bash
printf '%s' 'zcash:tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU?amount=1' \
  | zerynex-payreq --network test
```

The inspector takes the URI only via **standard input**, not command-line arguments, and prints a redacted JSON summary. It doesn't echo memo values, labels, messages or recipient addresses in either success or error output. Exit `0` means a supported request parsed, `1` means invalid input or an unsupported feature. Treat valid structure as **format acceptance only**, never proof of payment completion, receiver ownership or wallet compatibility.

## Integrate across Zecathon tracks

- **Shielded payments:** Parse a merchant's `zcash:` invoice request locally, verify network and exact amount, and hand the original URI to a separately trusted wallet for consent.
- **Private markets:** Inspect multi-recipient requests and distinguish optional memo presence, without returning memo text to dashboards or agent tooling.
- **Cross-chain:** Verify the Zcash leg's recipient network and expected amount; this does not verify remote-chain deposits or finality.
- **Core & tooling:** Use the same Rust parser through WebAssembly and independently packaged CLI binaries with synthetic conformance tests.
- **Wildcard:** Combine request-format checks with [node readiness](node-readiness.md), [PCZT policy checks](policy-format.md), and agent-safe development preflight. Do not give an LLM wallet signing authority.

## Trust and compatibility limits

ZIP-321 parsing validates *encoding and current supported semantics*, not address ownership, which receiver a wallet can spend to, funds availability, memo encryption, consensus validity, proof generation, signing, confirmation depth, or privacy outcomes. Not every Zcash wallet supports full ZIP-321 multi-recipient requests. Show the entire destination and fee to the user in the wallet and require independent authorization. **Do not show, persist, broadcast, or paste sensitive payment details into public CI or agent contexts.**

See also [Wallet handoff provider integration](wallet-handoffs.md) for one-use checkout tickets and explicit host authorization. The coordinator cannot prove user activation, signing, or settlement.

See [Zcash application recipes](zcash-app-recipes.md), [TypeScript SDK](typescript-api.md), [Native releases](releases.md), and [Privacy & trust](privacy-model.md).
