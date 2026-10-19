# Swap refund linkability and viewing-scope audit

Zerynex provides **offline privacy-configuration diagnostics** for Zcash wallets, bridges, swap coordinators, marketplaces and related infrastructure. A cross-chain application that publishes a shielded refund address on another public ledger can increase the long-term linkability of wallet activity if several flows share a viewing scope. In October 2026, the Zakura team proposed separating viewing-key scope per swap and privacy-preserving refund discovery for NEAR Intents flows. This is **a proposal and a threat-modeling motivation**, not Zerynex wallet support or a deployed quantum-safe cryptographic guarantee.

**Zerynex does not generate new viewing keys, derive receiver addresses, implement PIR, inspect secrets, or protect users from quantum computers.** This audit checks *application-declared metadata* for structural risks and prompts engineers to implement and independently verify the necessary wallet-level isolation.

## Install the offline auditor

The independently tested [Python wheel](releases.md) ships `zerynex-refund-audit` alongside `zerynex-project`. Install the verified local wheel from an actual release artifact or source checkout; Zerynex does not publish the wheel on PyPI yet. No Zcash node, CLI wallet, online RPC service, API token or private key is required to run this static metadata check.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install ./packages/python
.venv/bin/zerynex-refund-audit \
  --manifest tests/fixtures/swap-refund/isolated.json --json
```

The repo contains two **synthetic public test vectors**: `tests/fixtures/swap-refund/isolated.json` (declared per-flow isolation) and `tests/fixtures/swap-refund/risky.json` (reused address/scope, direct lookup and unsupported custody assertion). Supply only application-owned, non-sensitive metadata.

## Metadata contract, version 1

```json
{
  "schema_version": 1,
  "flows": [
    {
      "flow_ref": "11111111111111111111111111111111",
      "refund_address_ref": "22222222222222222222222222222222",
      "viewing_scope_ref": "33333333333333333333333333333333",
      "published_publicly": true,
      "lookup_mode": "private_claimed",
      "spending_key_custody": "wallet_claimed"
    }
  ]
}
```

The three `_ref` fields are **opaque, application-generated 128-bit identifiers**, written as exactly 32 lowercase hexadecimal characters. Real integrations should use random non-secret test identifiers to represent logical equivalence classes, not actual Zcash addresses, viewing keys, hashed real addresses, spending keys, account IDs, wallet backups, refund memos, or transaction history. A reference reused across two flows declares that the flows reuse the same resource. The auditor cannot establish whether that declaration is true.

`published_publicly` indicates that a refund address is exposed to another public chain or equivalent public surface. `lookup_mode` must be `private_claimed`, `direct` or `unknown`; *private_claimed is only a claim* and cannot attest PIR cryptographic properties. `spending_key_custody` must be `wallet_claimed`, `external` or `unknown`; it similarly cannot verify actual wallet custody.

The parser rejects duplicate flow records, unknown/duplicate JSON fields, raw receiver strings, non-boolean disclosure flags, unsupported values, manifest files exceeding 64 KiB, symlinks and non-regular files. No broad directory scans occur.

## Findings and exit codes

| Rule | What to review |
| --- | --- |
| `SWAP-REFUND-ADDRESS-REUSE` | Multiple declared flows reuse the same refund address reference |
| `SWAP-VIEWING-SCOPE-REUSE` | Multiple declared flows share the same viewing-key scope reference |
| `SWAP-PUBLIC-REFUND-UNSCOPED` | A public refund identifier belongs to a viewing scope also used by another flow |
| `SWAP-REFUND-LOOKUP-DISCLOSURE` | Direct/unknown wallet refund lookup could expose relationships to a server |
| `SWAP-SPENDING-KEY-CUSTODY-UNVERIFIED` | Declared signing-key custody is external or unknown |

Exit `0` means **no *declared* issues in these five checks**. Exit `2` means findings; exit `1` means malformed/unsupported manifest. The sanitized output contains only the five fixed rule IDs, flow counts, and limitations. It contains no references or original manifest values. Nothing is uploaded or persisted by Zerynex. This static tool cannot distinguish an honest declaration from a fraudulent one and does not perform a live wallet security audit.

## Compare integration revisions without exposing flow references

Use the optional **`--baseline`** with an earlier manifest and **`--manifest`** with the candidate configuration. Both inputs must be explicit, locally accessible JSON files containing only non-secret declared identifiers.

```bash
# New exposures: exits 2; returns counts and fixed rule IDs only
zerynex-refund-audit \
  --baseline tests/fixtures/swap-refund/isolated.json \
  --manifest tests/fixtures/swap-refund/risky.json --json

# Added flow carrying an already-known lookup-disclosure rule: still exits 2
zerynex-refund-audit \
  --baseline tests/fixtures/swap-refund/risky.json \
  --manifest tests/fixtures/swap-refund/regression-expanded.json --json

# Resolved findings: exits 0 if no *new* declared risk was introduced
zerynex-refund-audit \
  --baseline tests/fixtures/swap-refund/risky.json \
  --manifest tests/fixtures/swap-refund/isolated.json --json
```

The comparator tracks risk occurrences **per declared `flow_ref` and rule**, then returns only aggregate counts and fixed rule IDs: `baseline_risk_events`, `current_risk_events`, `new_risk_events`, `resolved_risk_events`, `new_rule_ids`, and `resolved_rule_ids`. No references, addresses, wallet identities, or raw JSON entries appear in the result. **A new occurrence of an existing rule is still a regression.** Reordering flows is not a regression.

For comparisons to be meaningful, use stable, independently generated **non-secret logical flow references** across revisions. Do not hash actual addresses or viewing keys to obtain reference IDs. Changing all flow IDs between revisions may make existing risks appear new, and a dishonest metadata declaration can hide risks. The tool cannot establish true on-chain or wallet identity.

### CI integration for Zcash applications

This comparison can be used as a local development gate or in a reviewable CI job. Only commit synthetic or deliberately non-secret sample manifests; never export real Zcash addresses, viewing keys, wallet identifiers, or private transaction details to a GitHub runner.

```yaml
# Example workflow fragment. Provide the vetted Zerynex Python wheel to the
# runner from a pinned, reviewed source revision or trusted release asset.
- name: Compare public-safe refund metadata
  run: |
    zerynex-refund-audit \
      --baseline tests/refund/expected.json \
      --manifest tests/refund/candidate.json \
      --json
```

Exit codes in comparison mode: `0` means **no newly declared risk events**, even if earlier findings remain; `2` means one or more new risks; `1` means malformed/unsupported input. A “pass” is **not certification of post-quantum privacy**. If all existing declared risks must also fail, run the ordinary single-manifest audit on the candidate as a separate step. Both modes reject duplicate JSON keys and files that fail the input-safety checks.

### Export sanitizer-only SARIF for security tooling

Pass `--sarif` instead of `--json` to emit SARIF 2.1.0 with one result per unique **new** rule ID in comparison mode (or per active rule ID for a single audit):

```bash
zerynex-refund-audit \
  --baseline tests/fixtures/swap-refund/risky.json \
  --manifest tests/fixtures/swap-refund/regression-expanded.json \
  --sarif > refund-regression.sarif
```

**Note:** the shell redirects output even if the program exits with `2`; a CI runner configured to stop on errors will still fail the step, as intended. The SARIF intentionally has **no source locations, artifacts, flow references, addresses or manifests**, so it cannot annotate individual code lines. It identifies categories of risk only; follow up in a trusted application environment. `--json` and `--sarif` are mutually exclusive.

### Python SDK surface

The wheel also exports `audit_manifest()`, `compare_manifests()`, and `sarif_report()` for controlled in-process integration:

```python
from zerynex_py import audit_manifest, compare_manifests, sarif_report

# Use only strict parsed metadata created in your own trusted integration.
report = compare_manifests(old_metadata, new_metadata)
if not report['passed']:
    raise RuntimeError('Newly declared swap privacy risks need review')
sarif = sarif_report(report)
```

Those functions do not perform network calls or read files. The CLI is preferred for strict duplicate-key, symlink and file-size checks of **untrusted JSON file inputs**.

## Optional synthetic MCP / agent workflow

The separately installed [local MCP server](agents.md) exposes the fixed
`audit_synthetic_refund_privacy` and
`compare_synthetic_refund_privacy` tools. They support only the bundled
`isolated`, `risky`, and `regression-expanded` scenarios; the server
never accepts wallet data, manifest paths, arbitrary JSON, viewing keys
or receiver addresses from an agent. The developer preflight checks
six expected refund scenarios without any network connection. Real,
application-declared metadata belongs in a **trusted local CLI process**,
not an agent prompt.

## What application engineers should implement independently

Review whether public refund addresses are reused and whether the underlying incoming viewing key is isolated **per exposed flow**, rather than relying only on visually different receiver strings. Consider how wallet restore and refund lookup may disclose address grouping; a `private_claimed` flag alone is not evidence that private information retrieval works. Keep spending authority within the actual end-user wallet unless the user explicitly authorizes a separate custody design.

The October 19, 2026 [Zakura / NEAR Intents reporting](https://www.coindesk.com/tech/2026/10/19/zcash-developers-plan-a-fix-to-keep-zec-swaps-private-from-future-quantum-computers) describes the proposed per-swap viewing-key mitigation. Zakura's [transparent-wallet PIR engineering write-up](https://zakura.com/engineering/transparent-pir-rotating-addresses/) covers a distinct but related private lookup problem. [ZIP 2005, Ironwood Quantum Recoverability](https://zips.z.cash/zip-2005) concerns recovery of Ironwood funds under a future recovery protocol; **quantum recoverability does not imply quantum-resistant shielded privacy or that Zerynex implements it**. Changes in protocol design should be followed through the canonical Zcash ZIPs and implementation sources, not inferred from a news headline.

See also [Zcash application integration recipes](zcash-app-recipes.md), [ZIP-321 payment inspection](payment-requests.md), [Wallet handoffs](wallet-handoffs.md) and [Privacy model](privacy-model.md).

## Browser and TypeScript SDK integration

Zerynex now exposes the **same declared-risk model** through the independent
`@zerynex/sdk` tarball with `auditRefundPrivacy`, `compareRefundPrivacy` and
`refundSarifReport`. See [TypeScript API](typescript-api.md) and the
[local refund workbench](/tools/refund). All evaluation happens inside the
browser tab or the developer's own Node.js process; the functions neither
connect to Zcash nor require Rust/WASM for this metadata-only check.

The browser workbench includes three **synthetic** samples: isolated flows,
shared viewing scope, and an additional declaration regression. It does not
upload, store, or discover wallet or transaction details. **Only enter
non-secret metadata**. Actual keys, addresses, hashed addresses or wallet
identifiers are inappropriate. JavaScript `JSON.parse` does not reject repeated object keys. The browser
workbench uses `parseRefundPrivacyJson`, which checks duplicate decoded keys,
and the standalone Node and Python CLIs also reject ambiguous raw JSON.
These checks cannot attest quantum-safe wallets or cryptographic isolation.

## Node.js / TypeScript CLI — strict local metadata files

The independently tested `@zerynex/sdk` **npm tarball** includes the
`zerynex-refund-check` executable (the tarball is verified in CI but is not
yet published to the public npm registry). Developers can install the tarball
locally and run a real CLI **without Python, wallets, networking, Rust/WASM,
or hosted Zerynex APIs**:

```bash
# From your trusted repository after installing the verified SDK tarball:
./node_modules/.bin/zerynex-refund-check \
  --manifest tests/fixtures/swap-refund/isolated.json --json

# Exit 2 means new per-flow risks were found (a suitable CI failure):
./node_modules/.bin/zerynex-refund-check \
  --baseline tests/fixtures/swap-refund/risky.json \
  --manifest tests/fixtures/swap-refund/regression-expanded.json \
  --sarif
```

Exit `0`: no currently declared rules (single mode) or no newly declared
risk occurrences (baseline mode). Exit `2`: findings or regressions. Exit `1`:
invalid arguments, malformed JSON, unsafe/unavailable file, or unsupported
manifest. Reports never include source filenames, flow identifiers or raw
metadata. The CLI reads only explicitly named files and rejects symlinked
paths (including ancestor directories), nonregular files, files over 64 KiB,
unknown fields, invalid opaque references, and **duplicate decoded JSON
keys—even escaped duplicates**. It doesn't scan your repository or write
outputs unless *you* explicitly redirect sanitized stdout.

### Strict browser/Node API for raw JSON strings

Use `parseRefundPrivacyJson(raw)`, `auditRefundPrivacyJson(raw)`, or
`compareRefundPrivacyJson(oldRaw, newRaw)` from `@zerynex/sdk` when the input
is a JSON string rather than a trusted in-memory object. These functions
reject duplicate JSON keys at every object level and enforce a 64 KiB UTF-8
limit before the five rule checks. The browser
[refund privacy workbench](/tools/refund) now uses this strict parser as well.
The ordinary `auditRefundPrivacy()` and `compareRefundPrivacy()` methods
still accept previously constructed objects, where duplicate source keys
cannot be recovered. **No such software can infer whether a non-secret,
application-declared viewing scope matches the wallet's actual key scope**;
real cryptographic isolation must be tested independently.
