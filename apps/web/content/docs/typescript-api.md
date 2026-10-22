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
| `client.analyzeBase64(base64, policy?)` | Inspect canonical padded Zallet-style base64 PCZT locally, no RPC |
| `client.compareBase64Stages(before, after, policy?)` | Compare two local base64 PCZT stage snapshots with the Rust/WASM engine |
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
| `evaluateLightwalletdInfo(result, options?)` | Pure local readiness checks on a trusted GetLightdInfo response, with redacted output |
| `evaluateLightwalletdJson(raw, options?)` | Strict, duplicate-aware bounded JSON import of public GetLightdInfo metadata |
| `parsePolicyJson(json)` | Import a strict JSON policy, at most 4 KiB; rejects repeated keys, including Unicode-escaped aliases |
| `exportPolicyJson(policy?)` | Serialize a normalized policy |

The SDK rejects oversized/empty input, invalid engine output and malformed reports. Base64 transport methods also reject noncanonical encodings and never include PCZT strings in errors. The maximum PCZT size is **8 MiB**; an application may set a smaller `maxInputBytes`.

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

## Refund privacy metadata and per-flow regressions

The TypeScript SDK includes `auditRefundPrivacy(manifest)`,
`compareRefundPrivacy(baseline, current)` and `refundSarifReport(report)`.
These functions are **offline and do not require Rust/WASM initialization**.
They perform the same five declared-risk checks as the Python SDK against
shared repository test vectors, including a regression on a newly affected
flow when the rule was already seen in another flow.

```typescript
import { auditRefundPrivacy, compareRefundPrivacy, refundSarifReport } from '@zerynex/sdk'

// publicSafeManifest and previousPublicSafeManifest must contain only
// developer-generated opaque, non-secret logical references.
const checked = auditRefundPrivacy(publicSafeManifest)
const delta = compareRefundPrivacy(previousPublicSafeManifest, publicSafeManifest)
if (!delta.passed) {
  console.warn(delta.new_rule_ids, delta.new_risk_events)
}
const sarif = refundSarifReport(delta) // no source locations or flow identifiers
```

For actual source data, use a **trusted application's own declaration layer**;
never supply real refund addresses, viewing keys, hashes of addresses, wallet
accounts or transaction history. Input objects have an exact, versioned schema;
they reject unknown fields and invalid values. For raw JSON strings use `parseRefundPrivacyJson` or the `zerynex-refund-check`
Node CLI: these reject duplicate JSON member names, including escaped keys.
Plain `JSON.parse` silently discards earlier duplicates, and the object-based
SDK functions cannot recover them after parsing.

A successful result is only an internally consistent declaration, not evidence
of actual wallet isolation or post-quantum protection. See
[refund privacy audit](refund-privacy-audit.md).

### Strict JSON parsing and independent Node CLI

For developer-provided **raw JSON text**, use:

```typescript
import { auditRefundPrivacyJson, compareRefundPrivacyJson } from '@zerynex/sdk'
const report = auditRefundPrivacyJson(publicSafeJsonText)
const delta = compareRefundPrivacyJson(oldPublicSafeJsonText, publicSafeJsonText)
if (!delta.passed) throw new Error('New declared privacy exposure')
```

These reject duplicate JSON fields (including Unicode-escaped duplicate
names), malformed or oversized UTF-8 input, unknown schema fields, and
non-secret reference format violations. The underlying object-based APIs
remain available for *already validated* in-memory declarations. Standard
`JSON.parse` alone is insufficient for untrusted raw manifests.

The npm tarball also ships a **fully offline Node.js CLI**:

```bash
./node_modules/.bin/zerynex-refund-check \
  --baseline tests/refund/approved.json \
  --manifest tests/refund/candidate.json --json
```

You must provide two actual, public-safe metadata files (not wallet data).
Exit `0` means no newly declared risk occurrences; `2` means new risks, and
`1` means invalid input. See [refund privacy audit](refund-privacy-audit.md)
for the SARIF option and complete trust boundaries.
