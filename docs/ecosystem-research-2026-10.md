# Zerynex research: Zcash developer infrastructure opportunities

Research date: 16 October 2026.

## Research standard

We want measurable improvements to developer tooling: reusable tests,
stronger privacy boundaries, useful compatibility diagnostics and easier
integration for wallets, SDKs, nodes, indexers and agents.

This research does not prove an idea has never been conceived. It identifies
documented problems and differentiates Zerynex from tools that already exist.

## Existing components: do not reimplement

- Zallet already has PCZT create/combine/inspect/prove/sign/extract functionality
  and has an open tracker for further privacy implication inspection:
  https://github.com/zcash/zallet/issues/349
  https://github.com/zcash/zallet/blob/main/CHANGELOG.md
- zcash-devtool is an existing transaction/wallet prototyping CLI:
  https://github.com/zcash/zcash-devtool
- Lightwalletd includes development/testing infrastructure (darksidewalletd):
  https://github.com/zcash/lightwalletd
- Zcash Indexer Observatory is an existing proposal for endpoint observability.
  An equivalent public uptime dashboard is not a distinct product:
  https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/343

## Prioritized evidence and opportunities

### 1. Node-free PCZT wallet regression tests — highest priority

The upstream issue documents that end-to-end PCZT testing is hard for
downstream crates without a wallet test harness, despite the available
create/combine/prove/sign/extract role pipeline:
https://github.com/zcash/librustzcash/issues/2623

Zerynex contribution: stage-to-stage policy findings and PCZT component
structure regression gates, usable through Rust, Python and GitHub Actions.
Implemented now with harmless local v6 fixtures. Full node-free wallet
harness and actual live Zallet RPC compatibility remain future work.

### 2. RPC compatibility and semantic drift — high priority

Zebra issue #11020 tracks numerous zcashd method compatibility differences,
and Zallet documents methods with changed semantics:
https://github.com/ZcashFoundation/zebra/issues/11020
https://github.com/zcash/zallet/blob/main/book/src/zcashd/json_rpc.md

Opportunity: a versioned contract-fixture test harness for app builders
migrating from old node/wallet RPCs to Zebra, Zallet and Zaino. First
verify upstream OpenRPC schemas and documented contracts. Not built yet.

### 3. Indexer/reorg behavior — high priority but larger scope

The upstream trackers mention chain reorg range correctness, mempool
refresh interruption and index stalls:
https://github.com/zcash/lightwalletd/issues/619
https://github.com/zcash/lightwalletd/issues/615
https://github.com/zingolabs/zaino/issues/1491

Opportunity: deterministic client-side regression scenarios with local
synthetic chains and failure injection. No user transaction collection.
No gRPC client, reorg engine or real chain test has been built yet.

### 4. Network privacy testability — medium-high priority

Librustzcash issue #2665 proposes a backend-agnostic transport privacy layer:
https://github.com/zcash/librustzcash/issues/2665

Opportunity: tests that detect wallet transport misconfiguration and
unsafe fallback under synthetic network errors, not a new Tor replacement.
Not built yet.

### 5. Shared SDK parity — medium priority

Librustzcash issue #2785 documents duplication across Android and Swift
FFI implementations:
https://github.com/zcash/librustzcash/issues/2785

Opportunity: cross-language fixture manifests and compatibility assertions
using upstream cryptography. Do not duplicate cryptographic implementations.
Not built yet.

### 6. More explicit privacy lifecycle review — related priority

Zallet issue #349 concerns privacy implications of PCZT execution.
Zallet already provides PCZT inspection; Zerynex should focus on
repeatable regression gates between stages, not just another inspector.
https://github.com/zcash/zallet/issues/349

## Delivery strategy

For every integration require:
1. A documented official API, protocol or upstream issue.
2. Evidence that the proposed tool is not merely a duplicate.
3. Deterministic positive and negative synthetic tests.
4. Safe, sanitized outputs that do not reveal confidential PCZT contents.
5. A reproducible user-facing workflow for another repository.
6. Honest limitations and support version documentation.

Order recommended:
- PCZT stage regression (implemented in this milestone).
- Actual Zallet-compatible synthetic handoff fixtures and node-free tests.
- RPC contract drift testing for wallet/node migrations.
- Indexer/reorg and transport-privacy tests once upstream interfaces
  and disposable test environments are pinned.

## Implemented: PCZT Stage Regression

The Rust API compare_stages_with_policy checks:
- added/resolved rule and field-path findings;
- changed counts of transparent inputs/outputs, Sapling spends/outputs,
  Orchard actions and Ironwood actions;
- current policy findings that must not be hidden by a baseline.

CLI:

    cargo run --locked -- \
      apps/web/public/examples/clean-v6.bin \
      --compare-with apps/web/public/examples/flagged-v6.bin --json

Python:

    result = client.compare_files("before.pczt", "after.pczt")

Reusable GitHub Action: set baseline-path and pczt-path to synthetic fixtures.

Important: field VALUE changes, recipient substitutions, wallet signing
authority, transaction equivalence and cryptographic proof correctness
are NOT checked by this feature. Do not claim it secures a complete wallet.

Source snapshots should be kept local. Never upload a real user PCZT to
public CI, a hosted AI service or an issue tracker.

## Originality caveat

Documentation of a missing upstream feature does not establish that every
similar external tool is absent. The approach is a promising differentiated
workflow, not a verified worldwide first. Confirm overlaps with maintainers
before marketing it as unique.
