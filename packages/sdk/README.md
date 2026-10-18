# @zerynex/sdk

A typed SDK for the local Zerynex Zcash PCZT disclosure-policy analyzer.
It delegates to a trusted locally executed Rust/WebAssembly engine and does
not transmit PCZT contents, hold keys, sign transactions or broadcast payments.

## Install

When published, users will be able to install it with any standard package manager:

    npm install @zerynex/sdk
    yarn add @zerynex/sdk
    pnpm add @zerynex/sdk

The SDK is **not yet published on npm**, but we now build a
self-contained tarball containing the actual Rust/WebAssembly runtime.
A consuming application does not need to compile Rust or clone the
monorepo. Install a downloaded archive with your package manager:

    npm install ./zerynex-sdk-0.1.0.tgz

The new browser entry point initializes the engine shipped inside the archive:

~~~ts
import { createBrowserZerynexClient } from '@zerynex/sdk/browser'

// Provide trusted wasm bytes if your bundler needs explicit asset handling.
const client = createBrowserZerynexClient({ wasm: trustedWasmBytes })
const report = await client.analyzeBlob(file, { deny_transparent: true })
console.log(report.findings)
~~~

The asset export is `@zerynex/sdk/wasm/zerynex_bg.wasm`.
With compatible wasm-bindgen asset hosting, the factory can auto-load
the adjacent WASM binary. Verify this in your chosen browser bundler.
No transaction contents are uploaded by this library.

Our test packs the SDK, installs it into an unrelated offline npm
consumer and executes real Rust/WASM PCZT checks:

    npm run build
    cd ../..
    node scripts/test-sdk-packed.mjs

## API

    import { createZerynexClient } from '@zerynex/sdk'
    import init, { analyze_pczt_policy } from './wasm/zerynex.js'

    const client = createZerynexClient({
      loadEngine: async () => {
        await init({ module_or_path: '/wasm/zerynex_bg.wasm' })
        return { analyze_pczt_policy }
      },
    })

    const report = await client.analyzeBlob(file, {
      profile: 'external_signer',
      deny_transparent: true,
      deny_sapling: false,
    })

The web application must supply its own trusted WASM runtime. The Zerynex
Next.js Studio is a functioning reference implementation.

Use exportPolicyJson to create JSON policies compatible with the Rust CLI.
The SDK rejects misspelled/unsupported policy fields and uses generic error
messages to avoid exposing input data in logs.

## Security limits

This is an experimental privacy policy linter, not a guarantee of anonymity,
consensus validity, or signing safety. A malicious host or compromised browser
can access local files regardless of this SDK's own no-upload design.

## Development

    npm install
    npm run build
    npm test

The same scripts work with Yarn and pnpm.

## Importing JSON policies

The SDK exposes parsePolicyJson to validate imported policy files. It rejects
unknown keys and invalid types, mirroring the Rust policy format.
In the Studio, users can import a JSON policy locally without uploading it.

## Compare PCZT handoff stages in React/Next.js

The same trusted Rust WASM engine now exposes compare_pczt_stages,
and the local SDK provides compareStages and compareStageBlobs.

Example:
~~~ts
const client = createZerynexClient({
  loadEngine: async () => {
    const wasm = await import('./wasm/zerynex.js')
    await wasm.default({ module_or_path: '/wasm/zerynex_bg.wasm' })
    return {
      analyze_pczt_policy: wasm.analyze_pczt_policy,
      compare_pczt_stages: wasm.compare_pczt_stages,
    }
  },
})
const comparison = await client.compareStageBlobs(beforeFile, afterFile, {
  profile: 'external_signer',
  deny_transparent: true,
})
~~~

This is used by the interactive /tools/stages frontend. Both inputs
are analyzed locally without uploading their bytes. It only compares
selected disclosure fields and pool component counts, not cryptographic
transaction equivalence, signatures or ZK proofs.

## Versioned rule definitions

The bundled SDK exports `RULE_CATALOG`, `RuleId` and `getRule` without loading
WASM, reading a PCZT or making a network request:

```ts
import { RULE_CATALOG, getRule } from '@zerynex/sdk'
console.log(RULE_CATALOG.rule_set_version)
const finding = getRule('PCZT-TRANSPARENT-OUTPUTS')
console.log(finding?.severity, finding?.category)
```

The catalog is generated from `rules/catalog.json` and checked in CI. It
reports **selected structural observations**, not transaction correctness.

## Zcash node readiness (browser/Node.js)

Use `evaluateZcashNodeStatus(chainInfo, { expectedNetwork: 'test' })` on a
`getblockchaininfo` result supplied by your own trusted backend. This pure
function does not load WASM or connect to a Zcash node and never echoes
untrusted RPC metadata. Unknown/missing fields fail closed. For a real node,
use the loopback-only Python adapter on the backend; never ship node RPC
credentials in browser code. See `docs/node-readiness.md`.

## ZIP-321 Zcash payment request inspection

Use `inspectZip321Uri(uri, 'test', {wasm: trustedWasmBytes})` from
`@zerynex/sdk/browser`. Uses the bundled Rust parser with actual address
checksum/network validation. Returns only redacted structural metadata.
Does not sign, build or send transactions. See `docs/payment-requests.md`.

## Wallet-neutral ZIP-321 handoffs

Use `createWalletHandoffCoordinator` from `@zerynex/sdk` for a one-use, policy-checked wallet handoff. It separates local inspection, trusted-provider capability discovery, host-user consent, and wallet presentation. The `createBrowserWalletHandoff` helper uses the bundled canonical Rust/WASM parser.

The `createZip321UriProvider` adapter accepts a host-supplied `openUri` callback. It never auto-discovers wallets. A `presented` result only means an attempted wallet handoff—not signing, broadcasting or settlement. See [Wallet handoffs](../../docs/wallet-handoffs.md) for limitations and examples.

## Read-only Zcash transaction confirmation and reorg observations

Use `evaluateZcashTransaction(txResult, chainState, {expectedNetwork, expectedTxid, requiredConfirmations})` from `@zerynex/sdk` on trusted `getrawtransaction(txid,1)` and `getblockchaininfo` results. `createZcashTransactionObserver(policy).observe(...)` tracks possible reorganizations in memory without exposing transaction IDs, block hashes, wallet data or complete RPC responses. No network requests, signing, confirmation receipts or payment settlement is performed. See `docs/transaction-observations.md`.
