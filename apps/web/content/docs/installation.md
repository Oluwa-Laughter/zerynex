# Install and integrate Zerynex

**Choose a path:** [Try the bundled demo](/#synthetic-demo), [analyze your own local PCZT](/tools), or [integrate Zerynex into your project](/integrate).

For a guided CLI, SDK, policy, CI and MCP workflow, see [Project integration](project-integration.md). For release archives and the SDK tarball/wheel, see [Downloads](releases.md). For application integration, see [language API guides](typescript-api.md) and verify compatibility with your chosen version.

Zerynex is a **local-first Rust privacy policy engine** for Zcash PCZT workflows.
A node, wallet, hosted account or API token is not needed for synthetic PCZT
linting or role-handoff regression tests.

## Choose an integration

| Interface | For | Current state |
| --- | --- | --- |
| Rust CLI and library | Wallets, CI, Rust programs | Supported from source |
| PCZT role scenario runner | Offline wallet developer acceptance tests | Supported from source |
| TypeScript/WASM SDK | React/Next.js and browser wallet UIs | Packaged Rust/WASM tested in independent applications |
| Python SDK | Automation and Python test suites | Calls trusted Rust CLI |
| GitHub Action | Repository pull-request checks | Supported with synthetic fixtures |
| MCP and Agent Skill | Read-only agent workflows | Optional and local |
| Go SDK | Go wallet and infrastructure applications | Source SDK: see [Go guide](go-sdk.md) |
| Zebra/Z3 | Local node-readiness checks | Partial |
| ZK/prover structural handoffs | ZK and privacy engineers | Partial: see [ZK guide](zk-prover-handoffs.md) |
| Live Zallet RPC, Zaino, proof adapters | Wallet/prover/indexer teams | Not yet supported |

## Install Rust CLI

Requires a compatible Rust toolchain.

    cargo install --git https://github.com/Oluwa-Laughter/zerynex --locked --bin zerynex

Or clone and build both Rust executables:

    git clone https://github.com/Oluwa-Laughter/zerynex
    cd zerynex
    cargo build --locked --release --bins

Discover the installed CLI version, supported input formats, size limits and operations without providing a transaction:

    ./target/release/zerynex --capabilities

See the [CLI capabilities contract](cli-capabilities.md) for integration details.

Check a synthetic fixture:

    ./target/release/zerynex apps/web/public/examples/clean-v6.bin --policy-file policies/shielded-only.json --json

Exit codes: 0 selected checks passed, 2 findings, 1 input error.

See [project bootstrap and verification](project-integration.md) for the offline `zerynex-project` scaffolder, synthetic fixture checks and optional pinned GitHub Action.

## Python SDK

Requires Python 3.11+ and local Rust CLI.

    python -m venv .venv
    .venv/bin/python -m pip install ./packages/python

Python example:

    from zerynex_py import ZerynexClient, Policy
    client = ZerynexClient(cli="./target/release/zerynex")
    report = client.analyze_file("apps/web/public/examples/transparent-v6.bin",
                                 Policy(deny_transparent=True))
    print(report.agent_summary())

This Python adapter requires a separately installed local Rust CLI.

## TypeScript/WASM SDK

The SDK is in packages/sdk and shares the Rust core compiled to WASM.
The Rust/WASM SDK can be integrated from the checked-in source. Development supports npm, Yarn and
pnpm. See [TypeScript browser API](typescript-api.md).

## Offline PCZT role-handoff harness

    cargo run --locked --bin zerynex-handoff -- --manifest tests/fixtures/role-handoff/scenario.json --json

See [Role-handoff harness](handoff-harness.md) for fixture expectations.

## GitHub Actions

No app-level SDK installation is required.

    - uses: actions/checkout@v4
    - uses: Oluwa-Laughter/zerynex@main
      with:
        pczt-path: tests/fixtures/synthetic.pczt
        policy-path: policies/shielded-only.json

Pin a reviewed commit SHA instead of main for production, and use synthetic,
nonspendable fixture data only. See [GitHub Actions](github-action.md).

## Privacy boundaries

Zerynex does not sign transactions, generate or verify proofs, or guarantee
anonymity. Do not send wallet secrets, real PCZTs or addresses to public CI,
external LLMs or issue trackers. The browser inspector processes files locally
through Rust/WASM. See [Privacy model](privacy-model.md).
