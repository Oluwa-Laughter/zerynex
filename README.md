# Zerynex

**Privacy is a property. Not a promise.**

A Rust-first privacy-policy toolkit for Zcash Partially Created Zcash Transactions (PCZTs). Created for Zecathon 2026's **Core & Tooling** track.

**Problem:** ZIP-374 intermediary PCZT files may carry sensitive metadata that never appears in a final shielded transaction. Zerynex helps developers establish explicit policies at those handoff boundaries.

## Architecture

- **Rust library** (`src/lib.rs`): real PCZT parsing via the Zcash `pczt` crate, policy checks on global proprietary metadata and selected Orchard/Ironwood fields.
- **CLI** (`src/main.rs`): local binary input, text/JSON report, 0 pass / 1 input error / 2 policy findings.
- **Browser engine**: the *same* Rust core compiled to WebAssembly; no hosted file upload or analysis API.
- **Studio** (`apps/web`): Next.js 16 App Router, React 19, TypeScript, Tailwind 4, GSAP animation, adaptive responsive UX, local file analysis, JSON export.
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

Open http://127.0.0.1:3000, choose **Launch studio**, load a genuine local binary PCZT or one of the two **synthetic examples**, select a profile, and run **real Rust WebAssembly analysis** without transferring your PCZT to any backend.

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


## Next.js frontend

The web application uses Next.js 16 App Router and React 19. The home route is / and the local PCZT analyzer is /studio. Typography is bundled locally, with GSAP transitions and Lucide React SVG icons (no emoji graphics).

The browser loads a Rust/WebAssembly engine from local static assets. The wasm-bindgen JavaScript wrapper lives under apps/web/src/wasm, and its binary is served from apps/web/public/wasm. The engine runs entirely in the browser: private PCZT bytes are not sent to the Next.js server.

Use Vercel with project root apps/web. Set NEXT_PUBLIC_SITE_URL to the canonical public site URL for OpenGraph metadata, if the host does not provide VERCEL_URL.

## Frontend quality checks

After installation and WASM generation:

    cd apps/web
    pnpm build
    pnpm lint
    pnpm typecheck
    pnpm exec playwright install chromium
    pnpm test:e2e

GitHub CI also runs the Rust formatting, Clippy, tests, and WASM compatibility checks. Playwright covers real clean/flagged PCZT analysis on desktop and mobile.

**Security note:** This early research toolkit is not audited, and its limited policy checks are not a guarantee of privacy or consensus validity.
