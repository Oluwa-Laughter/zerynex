# Zerynex changelog

This project is pre-1.0 developer infrastructure for Zcash. A package release
is not a certification of wallet privacy, consensus, signing, or cryptography.

## 0.2.0 — 2026-10-24

- Broadened privacy tooling across Rust CLI, WASM, TypeScript, Python and local
  MCP integrations, with synthetic fixtures and repeatable local checks.
- Added ZIP-321 payment-request inspections, wallet handoff contracts, Zcash
  node-readiness/transaction diagnostics, and local application integration.
- Added refund-privacy metadata audits, per-flow regression checks, and
  location-free SARIF; these analyze declarations, not live viewing keys.
- Added the independent `zerynex-refund-check` Node CLI, strict raw JSON
  duplicate-key rejection, and more readable copyable public documentation.
- Fixed `@zerynex/sdk` root exports; added registry metadata and verified
  local npm/Python artifact checks against expected entry points.
- Released `@zerynex/sdk` to npm and `zerynex-python` to PyPI using
  reviewed release artifacts and manual, approval-protected publishing.
- Aligned v0.2.0 Rust, TypeScript, Python and web package versions.
- Tagged and verified the independently installable Go SDK module as `packages/go/v0.2.0`.

## 0.1.0 — 2026-10-17

- First public GitHub Release with cross-platform compiled CLI archives,
  Rust/WASM npm tarball, Python wheel and sdist.
- The initial release predates newer refund-privacy and local Node tooling.
