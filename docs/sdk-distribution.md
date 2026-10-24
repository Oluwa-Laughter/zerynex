# SDKs and lightweight installation

**No installation is needed to try Zerynex.** Open the public workbench
at [/tools](/tools), select a harmless synthetic fixture, and analyze it
locally through the Rust/WebAssembly engine.

For applications, use the smallest compatible interface:

| Language | Integration | Current availability |
| --- | --- | --- |
| TypeScript | SDK bundled with Rust/WASM | Tested local SDK tarball |
| Rust | Canonical library and CLI | Tested OS-native archive and Cargo Git source install |
| Python | Adapter invoking the trusted Rust CLI | Tested local wheel |
| Go | Source module invoking the trusted Rust CLI | Source SDK tested against the Rust CLI |
| Agents | Restricted stdio MCP and Agent Skill | Explicit opt-in source integration |
| CI | Composite GitHub Action | Commit-SHA pinning and synthetic fixtures |

One Rust parser and policy engine avoids duplicated security-critical
cryptographic code and keeps findings consistent. TypeScript runs it as
WASM. Python and Go currently invoke the local executable.

## Distributable artifacts

Zerynex builds standalone Rust CLI archives, a compiled Python wheel and
a TypeScript SDK tarball containing its matching Rust/WASM engine.
Each format is independently tested outside the monorepo against real
synthetic PCZT fixtures. See [download and release artifacts](releases.md).

## Rust CLI without cloning the Next.js app

Cargo Git installation fetches and builds the CLI executable:

    cargo install --git https://github.com/Oluwa-Laughter/zerynex --locked --bin zerynex

This is still **compilation from source**, not a prebuilt binary release.
A compatible Rust toolchain is required. The website does not need Rust
installed when analyzing PCZTs in-browser.

## Organization ownership

When an owner-authorized Zerynex GitHub organization exists, source and
CI/install links can be migrated deliberately. Until then, retain valid
links only in technical provenance, not the homepage or main navigation.
