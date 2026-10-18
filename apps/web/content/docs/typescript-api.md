# TypeScript and browser API

The `@zerynex/sdk` TypeScript package wraps the same Rust privacy engine compiled to WebAssembly. It analyzes `Uint8Array`, `ArrayBuffer` and browser `Blob`/`File` values **locally**. There is no hosted PCZT analysis endpoint.

## Installation status

The project builds and externally tests an npm tarball with compiled Rust/WASM; **npm registry publication is not yet complete**. Get a verified artifact from [Releases](releases.md) or develop against `packages/sdk` in the source repository. Do not assume `npm install @zerynex/sdk` is available from the public registry yet.

## Browser integration

```typescript
import { createBrowserZerynexClient } from '@zerynex/sdk/browser'

// Supply trusted WASM bytes from your app bundle, or let the bundler
// resolve the package's adjacent WASM asset.
const client = createBrowserZerynexClient()
await client.ready()

// Pair this with <input id="pczt-file" type="file" /> in your app.
const file = document.querySelector<HTMLInputElement>('#pczt-file')?.files?.[0]
if (!file) throw new Error('Select a local PCZT file')
const report = await client.analyzeBlob(file, {
  profile: 'external_signer',
  deny_transparent: true,
})

if (report.findings.length > 0) {
  console.log(report.findings.map(({ rule, field }) => ({ rule, field })))
}
```

Select a file from your application's own input. Ensure the bundler can serve the `.wasm` asset with an appropriate MIME type. The demonstration does not upload the file.

## Main exports

| API | Description |
| --- | --- |
| `createBrowserZerynexClient(options?)` | Initialize the packaged browser Rust/WASM engine |
| `createZerynexClient({ loadEngine, maxInputBytes? })` | Use a trusted, already initialized WASM engine |
| `client.ready()` | Await engine initialization |
| `client.analyzeBytes(input, policy?)` | Analyze local PCZT bytes |
| `client.analyzeBlob(input, policy?)` | Analyze a local `Blob` or `File` |
| `client.compareStages(before, after, policy?)` | Compare policy findings and component counts |
| `client.compareStageBlobs(before, after, policy?)` | Compare browser file stages |
| `normalizePolicy(policy?)` | Reject unsupported or mistyped settings |
| `RULE_CATALOG`, `getRule(id)` | Access bundled, typed rule metadata without initializing WASM |
| `createWalletHandoffCoordinator(provider, inspector)` | Wallet-neutral, fail-closed one-use ZIP-321 handoff policy and user-consent boundary |
| `createBrowserWalletHandoff(provider, options?)` | Canonical Rust/WASM inspector-backed provider handoff coordinator |
| `createZip321UriProvider({network, openUri, ...})` | Explicit OS ZIP-321 URI adapter; wallet launch does not prove transaction acceptance |
| `evaluateZcashTransaction(txResult, chainResult, policy)` | Check trusted RPC confirmations against network, identity and chain tip, returning a sanitized result |
| `createZcashTransactionObserver(policy)` | Compare consecutive local snapshots for possible reorganization warnings |
| `evaluateZcashNodeStatus(result, options?)` | Pure, read-only normalization of Zcash `getblockchaininfo` chain readiness |
| `parsePolicyJson(json)` | Import a strict JSON policy, at most 4 KiB |
| `exportPolicyJson(policy?)` | Serialize a normalized policy |

The SDK rejects oversized/empty input, invalid engine output and malformed reports. The maximum PCZT size is **8 MiB**; an application may set a smaller `maxInputBytes`.

## Typed error handling

```typescript
import { ZerynexSdkError } from '@zerynex/sdk'

try {
  await client.analyzeBlob(file, { deny_transparent: true })
} catch (error) {
  if (error instanceof ZerynexSdkError) {
    console.error(error.code) // fixed category, not transaction bytes
  }
}
```

Known SDK categories: `INPUT_INVALID`, `POLICY_INVALID`, `ENGINE_UNAVAILABLE`, `ANALYSIS_FAILED`, and `REPORT_INVALID`. A successful analysis response may contain *findings*: those are policy results, not exceptions. See [Reports](report-reference.md) and [Privacy model](privacy-model.md).

See [Zcash node readiness](node-readiness.md) for a backend integration pattern that does not expose RPC credentials in the browser.

See [Wallet provider handoffs](wallet-handoffs.md) for typed capabilities, policy matching and mandatory host-side user consent.

See [Transaction observations](transaction-observations.md) for the integration contract and confirmation/finality limitations.
