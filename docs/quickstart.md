# Quickstart: your first PCZT privacy check

Zerynex analyzes selected **disclosure-policy rules** in a local Zcash Partially Constructed Zcash Transaction (PCZT). Start with a generated, nonspendable test fixture—no wallet connection, private key, account, or RPC endpoint is required.

## 1. Try it instantly

Open the [privacy workbench](/tools). Select **Transparent v6** and choose **Run privacy analysis**. The Rust engine runs through WebAssembly in your browser, and the fixture intentionally includes a transparent output.

Expected finding: `PCZT-TRANSPARENT-OUTPUTS`, under a policy that denies transparent components. This is an intentional failing fixture, **not** a failed installation.

## 2. Install the local CLI

You need a compatible Rust toolchain for source installation:

```bash
cargo install --git https://github.com/Oluwa-Laughter/zerynex --locked --bin zerynex
zerynex --capabilities
```

The command reports the installed version, supported operations, input formats, size limits and exit codes without opening a transaction file. For prebuilt downloadable artifacts and actual publication status, see [Releases](releases.md).

## 3. Check a fixture offline

From a local clone of this repository:

```bash
cargo run --locked -- \
  apps/web/public/examples/clean-v6.bin \
  --deny-transparent --json
```

Expected: zero policy findings, exit code `0`. Next run:

```bash
cargo run --locked -- \
  apps/web/public/examples/transparent-v6.bin \
  --deny-transparent --json
```

Expected: `PCZT-TRANSPARENT-OUTPUTS`, exit code `2`. Exit `1` instead means the CLI could not evaluate the input, and the caller must **not** treat it as a clean transaction.

## 4. Choose your next integration

- **Rust or shell**: [CLI reference](cli-reference.md) and [Rust API](rust-api.md)
- **React/TypeScript**: [TypeScript and browser API](typescript-api.md)
- **Backend/Python**: [Python SDK](python-api.md) or [Go SDK](go-sdk.md)
- **CI pipeline**: [GitHub Action](github-action.md)
- **Coding assistants**: [MCP and agent tools](agents.md), restricted to approved synthetic fixtures

## What a passing check means

Only the selected, implemented policy rules found no violations in the given intermediate PCZT. It **does not** verify proofs, signatures, transaction equivalence, wallet authorization, Zcash consensus correctness or complete anonymity. Never paste confidential PCZT bytes, wallet addresses or keys into public CI, issue reports, or AI conversations. Read the [privacy and trust model](privacy-model.md) before working with real wallet data locally.
