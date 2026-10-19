# Zerynex changelog

This project is pre-1.0 developer infrastructure for Zcash. A package release
is not a certification of wallet privacy, consensus, signing, or cryptography.

## 0.2.0 — Unreleased; awaiting approved tag and registry configuration

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
- Prepared **manual-only** npm/PyPI trusted publishing with package validation
  and protected release environments. No registry push happens on commit.
- Prepared v0.2.0 version alignment across Rust, TypeScript, Python and web.

The **public v0.1.0 GitHub Release remains the latest released version** until
its v0.2.0 successor has been reviewed and deliberately tagged.

## 0.1.0 — 2026-10-17

- First public GitHub Release with cross-platform compiled CLI archives,
  Rust/WASM npm tarball, Python wheel and sdist.
- The initial release predates newer refund-privacy and local Node tooling.
