# Zerynex

**Privacy is a property. Not a promise.**

A Rust-first privacy-policy toolkit for Zcash Partially Created Zcash Transactions (PCZTs). Created for Zecathon 2026's **Core & Tooling** track.

**Problem:** ZIP-374 intermediary PCZT files may carry sensitive metadata that never appears in a final shielded transaction. Zerynex helps developers establish explicit policies at those handoff boundaries.

## Architecture

- **Rust library** (`src/lib.rs`): real PCZT parsing via the Zcash `pczt` crate, policy checks on global proprietary metadata and selected Orchard/Ironwood fields.
- **CLI** (`src/main.rs`): local binary input, text/JSON report, 0 pass / 1 input error / 2 policy findings.
- **Browser engine**: the *same* Rust core compiled to WebAssembly; no hosted file upload or analysis API.
- **Studio** (`apps/web`): Next.js 16 App Router, React 19, TypeScript, Tailwind 4, GSAP animation, adaptive responsive UX, local file analysis, JSON export.
- **Fixtures** (`examples/generate_fixtures.rs`): synthetic non-spendable v6 PCZT files: clean, metadata-flagged, and transparent-output.

## Development

Requires Rust stable, Node.js >=22 and any of npm, Yarn, or pnpm. The commands below use pnpm because CI uses frozen pnpm lockfiles.

```bash
cargo test --locked --all-targets
cargo run -- path/to/transaction.pczt --profile external-signer --json
cargo install wasm-bindgen-cli --version 0.2.129 --locked
bash scripts/build-wasm.sh
cd packages/sdk
pnpm install --frozen-lockfile
pnpm build
cd ../../apps/web
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:3000, choose **Launch studio**, load a genuine local binary PCZT or one of the three **synthetic examples**, select a profile, and run **real Rust WebAssembly analysis** without transferring your PCZT to any backend.

The prebuilt browser WASM is included under `apps/web/public/wasm`. The build script reproducibly regenerates it. GitHub Actions builds Rust + WASM + web.

## Current policies

- `external-signer`: flags dummy spending keys and unreviewed proprietary metadata.
- `restricted-handoff`: additionally flags selected output recipient/value/seed/address fields. This may reject legitimate signer workflows.

Reports contain rule IDs and field paths, **not private field values**.

## Security notice

**Early research software, not audited.** Passing implemented checks does **not** imply anonymity, complete private-data handling, consensus validity, safe signing, or a production security audit. Sapling and transparent checks remain partial, and network side channels are outside v0.1 scope. No wallet keys belong in committed fixtures.

Full threat-model summary: [docs/privacy-model.md](docs/privacy-model.md).

## Next milestones

Expanded role-specific policies, real signer/prover compatibility fixtures, comprehensive pool checks, CI regression examples, upstream integration, privacy review.

## References

[ZIP-374](https://zips.z.cash/zip-0374) · [librustzcash](https://github.com/zcash/librustzcash) · [pczt documentation](https://docs.rs/pczt/).

MIT licensed. Open source.


## Next.js frontend

The web application uses Next.js 16 App Router and React 19. The home route is / and the local PCZT analyzer is /studio. Typography is bundled locally, with GSAP transitions and React Icons (Lucide collection) SVG components (no emoji graphics).

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

## Policy-as-code

Local JSON policies specify signer profile and permitted shielded pools.
See [policy reference](docs/policy-format.md) and [policy examples](policies/).
The CLI supports --policy-file, --deny-transparent, and --deny-sapling
alongside the built-in profiles. A findings-free report never guarantees
privacy, signing safety, or consensus validity.

Zerynex ships three non-spendable synthetic PCZT v6 examples:
clean, global-metadata-flagged, and transparent-output. The last one demonstrates
why a shielded-only policy is meaningful, with no spendable funds or private keys.

## Reusable TypeScript SDK

The independent @zerynex/sdk package in packages/sdk provides a typed API,
strict policy normalization, lazy local WASM loading, Blob and Uint8Array
analysis, and sanitized error messages. The Next.js Studio now consumes
this SDK rather than calling WebAssembly directly.

The SDK is not yet published to the npm registry. The web app links it
locally through a standard file dependency. We test npm and Yarn installation
separately from our pnpm-based reference CI build.

See docs/package-managers.md for installation and development instructions.

## Importable Studio policies

The Studio can import/export repository-local JSON policy files with
strict validation performed by @zerynex/sdk. A malformed policy does not
alter the selected disclosure safeguards. Imported data is read on-device,
and exported policies can be used directly with the Rust --policy-file CLI.
