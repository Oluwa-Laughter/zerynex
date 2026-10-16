# Zerynex

Zcash privacy-policy tooling for developers. A Rust-first, local-only PCZT handoff linter built as a new Core & Tooling project for Zecathon 2026.

## Why this exists

ZIP-374 warns that PCZT intermediary data can expose far more than final shielded transactions, including viewing information, output recipients and note randomness. Zerynex aims to enforce explicitly configured privacy requirements during transaction handoffs and in CI.

## What is currently implemented

- Parse binary PCZTs using the upstream Rust pczt implementation.
- Inspect Orchard and Ironwood action fields for dummy spending keys and unknown proprietary metadata.
- Optional restrictive handoff policy checks whether recipient, value, seed randomness or user-facing address fields remain in output structures.
- Emit sanitized text or JSON reports; no private field contents.
- Exit code 0: no findings; 1: file/parsing error; 2: policy violations.

## Running

    cargo run -- path/to/input.pczt --profile external-signer
    cargo run -- path/to/input.pczt --profile restricted-handoff --json
    cargo test

Never upload a genuine PCZT to an external debugging service. Real PCZT files can contain sensitive wallet data.

## Limitations

Early proof of concept, **not audited**. Passing the current checks does NOT imply full wallet privacy, consensus correctness, safe custody, or proof validation. Checks do not yet include transparent and Sapling bundles. Restrictive policy may block legitimate signer handoffs that require disclosed amounts and recipient details. No automated mutation or redaction is performed.

## Next milestones

- Synthetic binary fixtures and testable positive/negative handoffs.
- Complete Sapling, transparent and Ironwood field coverage.
- Explicit capability- and role-aware policy configuration.
- Real Zcash PCZT signing/extraction compatibility tests.
- Reliable privacy regression workflow for GitHub Actions.

## Sources

- ZIP-374: https://zips.z.cash/zip-0374
- librustzcash: https://github.com/zcash/librustzcash
- pczt crate: https://docs.rs/pczt/
