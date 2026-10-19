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

## What application engineers should implement independently

Review whether public refund addresses are reused and whether the underlying incoming viewing key is isolated **per exposed flow**, rather than relying only on visually different receiver strings. Consider how wallet restore and refund lookup may disclose address grouping; a `private_claimed` flag alone is not evidence that private information retrieval works. Keep spending authority within the actual end-user wallet unless the user explicitly authorizes a separate custody design.

The October 19, 2026 [Zakura / NEAR Intents reporting](https://www.coindesk.com/tech/2026/10/19/zcash-developers-plan-a-fix-to-keep-zec-swaps-private-from-future-quantum-computers) describes the proposed per-swap viewing-key mitigation. Zakura's [transparent-wallet PIR engineering write-up](https://zakura.com/engineering/transparent-pir-rotating-addresses/) covers a distinct but related private lookup problem. [ZIP 2005, Ironwood Quantum Recoverability](https://zips.z.cash/zip-2005) concerns recovery of Ironwood funds under a future recovery protocol; **quantum recoverability does not imply quantum-resistant shielded privacy or that Zerynex implements it**. Changes in protocol design should be followed through the canonical Zcash ZIPs and implementation sources, not inferred from a news headline.

See also [Zcash application integration recipes](zcash-app-recipes.md), [ZIP-321 payment inspection](payment-requests.md), [Wallet handoffs](wallet-handoffs.md) and [Privacy model](privacy-model.md).
