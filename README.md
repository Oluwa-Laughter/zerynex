# Zerynex

**Privacy is a property. Not a promise.**

A Rust-first privacy-policy toolkit for Zcash Partially Created Zcash Transactions (PCZTs). Created for Zecathon 2026's **Core & Tooling** track.

**Problem:** ZIP-374 intermediary PCZT files may carry sensitive metadata that never appears in a final shielded transaction. Zerynex helps developers establish explicit policies at those handoff boundaries.

## Architecture

- **Rust library** (`src/lib.rs`): real PCZT parsing via the Zcash `pczt` crate, policy checks on global proprietary metadata and selected Orchard/Ironwood fields.
- **CLI** (`src/main.rs`): local binary input, text/JSON report, 0 pass / 1 input error / 2 policy findings.
- **Browser engine**: the *same* Rust core compiled to WebAssembly; no hosted file upload or analysis API.
- **Studio** (`apps/web`): React 19, TypeScript, Vite, Tailwind 4, GSAP animation, adaptive responsive UX, local file analysis, JSON export.
- **Fixtures** (`examples/generate_fixtures.rs`): synthetic non-spendable v6 PCZT files, clean and flagged.

## Development

Requires Rust stable, Node.js >=22 and pnpm 10.

```bash
cargo test --locked --all-targets
cargo run -- path/to/transaction.pczt --profile external-signer --json
cargo install wasm-bindgen-cli --version 0.2.129 --locked
bash scripts/build-wasm.sh
cd apps/web
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5173, choose **Launch studio**, load a genuine local binary PCZT or one of the two **synthetic examples**, select a profile, and run **real Rust WebAssembly analysis** without transferring your PCZT to any backend.

The prebuilt browser WASM is included under `apps/web/public/wasm`. The build script reproducibly regenerates it. GitHub Actions builds Rust + WASM + web.

## Current policies

- `external-signer`: flags dummy spending keys and unreviewed proprietary metadata.
- `restricted-handoff`: additionally flags selected output recipient/value/seed/address fields. This may reject legitimate signer workflows.

Reports contain rule IDs and field paths, **not private field values**.

## Security notice

**Early research software, not audited.** Passing implemented checks does **not** imply anonymity, complete private-data handling, consensus validity, safe signing, or a production security audit. Sapling and transparent checks are not yet complete, and network side channels are outside v0.1 scope. No wallet keys belong in committed fixtures.

Full threat-model summary: [docs/privacy-model.md](docs/privacy-model.md).

## Next milestones

Expanded role-specific policies, real signer/prover compatibility fixtures, comprehensive pool checks, CI regression examples, upstream integration, privacy review.

## References

[ZIP-374](https://zips.z.cash/zip-0374) · [librustzcash](https://github.com/zcash/librustzcash) · [pczt documentation](https://docs.rs/pczt/).

MIT licensed. Open source.
