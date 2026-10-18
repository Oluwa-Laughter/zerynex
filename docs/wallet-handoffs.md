# Wallet handoffs and explicit payment approval

Zerynex ships a provider-neutral **ZIP-321 handoff coordinator** for Zcash application teams. Use it to connect a **trusted, separately integrated wallet** to merchant checkout, wallets, private markets, and relayer-facing UIs. The coordinator does **not** discover, connect to, unlock, sign with, pay from, or identify a wallet on its own.

Unlike transaction assembly, a payment-request URI is only a proposed set of recipients and amounts. [ZIP-321](https://zips.z.cash/zip-0321) is an active standard; wallet support for multi-recipient requests and memos differs across implementations. Do not infer that a particular wallet supports these features without verifying its implementation.

## User-initiated browser integration

Install the released/downloaded `@zerynex/sdk` tarball; the SDK includes its compiled Rust/WASM address and payment parser. The host must independently verify its wallet's ZIP-321 capabilities.

```ts
import {
  createBrowserWalletHandoff,
  createZip321UriProvider,
} from '@zerynex/sdk/browser'

const provider = createZip321UriProvider({
  network: 'test',
  // This callback MUST be invoked from an application's explicit user flow.
  // Choose the correct verified wallet integration for your environment.
  openUri: uri => { window.location.assign(uri) },
  max_payments: 1, // do not claim unsupported multi-recipient behavior
  supports_memos: false,
})

const handoff = createBrowserWalletHandoff(provider, {
  wasm: trustedWasmBytes, // or a trusted app-served WASM asset URL
})

// Prefer preparing before the approval button click; no wallet call yet.
const prepared = await handoff.prepare(invoiceUri, {
  expected_network: 'test',
  expected_total_zat: 125_000_000, // integer zatoshis; exactly 1.25 ZEC
  max_payments: 1,
  allow_transparent: false, // default: shielded-only
  allow_memos: false,
})

// The host MUST show the complete original recipient(s), amount(s), network
// and relevant fees in trusted wallet UI; this summary intentionally omits
// the address and memo content.
const result = await handoff.handoff(prepared, async redactedSummary => {
  return await confirmActualWalletPaymentDetails(invoiceUri, redactedSummary)
})
// result.status === 'presented' only means an attempt to open the wallet URI.
// It does not mean the wallet accepted, signed, or sent a transaction.
```

This is an integration pattern, not a recommendation to navigate a browser automatically. Browser restrictions and wallet support vary. The `openUri` hook belongs to the host application; Zerynex deliberately does not supply a built-in wallet registry or call `window.location` by itself.

## Build your own wallet provider

Implement `WalletPaymentProvider` and return versioned capabilities:

```ts
import {
  createWalletHandoffCoordinator,
  type WalletPaymentProvider,
} from '@zerynex/sdk'

const provider: WalletPaymentProvider = {
  async getCapabilities() {
    return {
      schema_version: 1,
      provider_id: 'verified-wallet-adapter',
      networks: ['test'],
      accepts_zip321: true,
      max_payments: 1,
      supports_memos: false,
      supports_multi_payment: false,
    }
  },
  async presentZip321Request(uri, network) {
    // Only display/pass URI to your independently verified wallet adapter.
    // Reject if network is unsupported. Do not sign or broadcast here.
    await trustedHostWalletOpen(uri, network)
    return { status: 'presented' }
  },
}

// Supply the trusted real Rust/WASM inspector from the browser SDK.
const handoff = createWalletHandoffCoordinator(
  provider,
  (uri, network) => inspectZip321Uri(uri, network, { wasm: trustedWasmBytes }),
)
```

The coordinator first validates the declared provider capabilities and invokes the canonical inspector supplied by the application. It then checks policy for network match, exact total zatoshis, positive integral per-recipient amounts, recipient count, memo support, and transparent-only recipients. The default is **one recipient, no transparent destinations, no memo**. A rejected request never reaches the wallet.

The return value of `prepare` is a redacted **in-memory one-use ticket**. The URI is stored in a private `WeakMap`, never serialized into the ticket. Calling `handoff` consumes the ticket **before** asynchronous capability rechecks and host consent. `cancel(ticket)` permanently revokes it. No retries are automatic.

After explicit application-controlled approval, `presentZip321Request` receives the original URI. This means the **trusted provider necessarily sees the URI**: do not choose a third-party provider that uploads requests or logs addresses. For hosted applications, treat the original URI as sensitive data. A provider's self-declared capabilities cannot prove it is trustworthy.

## Failure and status model

`WalletHandoffError.code` is a fixed redacted category: `INPUT_INVALID`, `PROVIDER_UNAVAILABLE`, `CAPABILITY_INVALID`, `POLICY_REJECTED`, `TICKET_INVALID`, `CONSENT_FAILED`, `PROVIDER_FAILED`, or `RESULT_INVALID`. Exceptions deliberately avoid echoing original request data or provider exceptions.

Result `{status:'presented'}` means **the URI was passed to the adapter** only. Result `{status:'cancelled'}` means the user declined or the adapter returned cancellation. These are not on-chain states. Unsupported provider results (e.g. `confirmed`, `paid`, or an unverified `txid`) are rejected rather than mislabeled as settlement.

Neither the coordinator nor the OS URI adapter can technically prove human activation, wallet authenticity, transaction signing, network broadcasting, privacy protection, or finality. A host application must enforce user-gesture and confirmation semantics in its own UI; a boolean callback is not cryptographic proof of consent. Network mismatch and malformed responses fail closed.

## Trust boundary for agent workflows

A read-only agent may inspect capability metadata, synthetically test integration behavior, or reason over **redacted** summaries. An agent must not call `handoff` on the user's behalf, synthesize a consent callback, initiate OS wallet navigation, obtain private URI contents without authorization, or infer payment success from a `presented` result. No signing keys, wallet sessions, or RPC credentials are managed by this module.

## Scope and compatibility

This module currently targets **ZEC-only ZIP-321** and leaves ZIP-227 custom assets unsupported. Real Zcash wallet compatibility, signed transaction receipts, network confirmation and account identity are **not implemented**. The integration is tested with synthetic providers and the packaged canonical parser; it has not been validated against live Zcash wallets.

Related guides: [ZIP-321 payment requests](payment-requests.md), [TypeScript SDK](typescript-api.md), [Zcash app recipes](zcash-app-recipes.md), [Privacy model](privacy-model.md), and [Agent integrations](agents.md).
