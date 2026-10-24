# Contributing to Zerynex

Thanks for helping make Zcash developer tooling safer and easier to integrate.

## Scope and boundaries

Zerynex is a local-first **PCZT disclosure-policy linter and stage-regression toolkit**, not a wallet, signer, transaction broadcaster, Zcash consensus implementation or proof verifier. Keep the canonical PCZT parser and privacy-rule implementation in **Rust**. The browser uses its WASM build; Python and Go invoke the trusted native CLI. New adapters should not invent a second implementation of security-sensitive parsing.

## Local development

Prerequisites: a current stable Rust toolchain, Node.js 22+, pnpm 10+, Python 3.11+ (and Go 1.23+ for Go work). The Rust/WASM build also requires the `wasm32-unknown-unknown` target and `wasm-bindgen-cli 0.2.129`.

```bash
git clone https://github.com/Oluwa-Laughter/zerynex.git
cd zerynex
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked --all-targets
bash scripts/build-wasm.sh
cd packages/sdk && pnpm install --frozen-lockfile && pnpm build && pnpm test
cd ../../apps/web && pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Run `python3 -m unittest discover -s tests -p 'test_*.py'` for repository Python coverage and `go test ./...` from `packages/go` when Go is installed. Run `node scripts/test-sdk-packed.mjs` at the repository root to validate the packaged SDK in an unrelated consumer.

## Expectations for code and documentation

- Include a nonspendable synthetic fixture and both expected-success and expected-failure checks for any new policy behavior.
- Fail closed on malformed/oversized inputs, unknown fields and unsupported cryptographic capabilities.
- Keep PCZT bytes, wallet keys, real addresses, viewing keys, transaction IDs and raw RPC secrets out of logs, telemetry, public issues and CI.
- Document supported operations, input sizes, exit statuses, data flows and boundaries; a green synthetic fixture is not proof of live wallet compatibility.
- Edit canonical guides in `docs/`, then run `node scripts/sync-docs.mjs`, `node scripts/validate-docs.mjs` and `node scripts/test-public-docs.mjs`. Do not edit generated `apps/web/content/docs/` directly.
- Check mobile layout, keyboard accessibility, reduced motion, clipboard failures and non-ambiguous actionable UI text for frontend changes.
- Keep CI green and document behavior changes before merging or deploying.

## Releases and distribution

The released `v0.2.0` source and public npm/PyPI packages are immutable. Further feature work must not be described as part of an already published distribution unless the matching version has actually been released. Native archives, Go module versions and language registries have distinct release gates. Repository owners control version tagging, release approvals and protected GitHub publishing environments.

## Security reports

If your finding could reveal private data or enable a security bypass, follow [SECURITY.md](SECURITY.md) instead of filing a public issue containing proof-of-concept secrets.
