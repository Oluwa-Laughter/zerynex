# zerynex-python

Python 3.11+ adapter for **local Rust-backed** Zcash PCZT privacy analysis.
This early package is not published to PyPI.

## Installation from this checkout

First compile the Rust CLI:

    cargo build --locked --release

Then install the Python SDK from the repo:

    python -m venv .venv
    .venv/bin/python -m pip install ./packages/python

Or with uv:

    uv pip install ./packages/python

Pass the trusted Rust executable explicitly:

    from pathlib import Path
    from zerynex_py import ZerynexClient, Policy

    client = ZerynexClient(cli=Path("./target/release/zerynex"))
    result = client.analyze_file(
        "apps/web/public/examples/transparent-v6.bin",
        Policy(deny_transparent=True),
    )
    print(result.agent_summary())

The sample should flag a transparent output using the same Rust rules as the
Next.js Studio, Rust CLI and TypeScript SDK.

## Agent/MCP extra

    pip install './packages/python[mcp]'

Use the **local-only** MCP server after specifying a dedicated sandbox directory
containing synthetic fixtures:

    ZERYNEX_CLI=/absolute/path/to/zerynex
    ZERYNEX_AGENT_ALLOWED_ROOT=/absolute/path/to/synthetic-fixtures
    zerynex-mcp

The MCP server exposes strictly read-only policy checks through stdio. It
accepts only simple fixture filenames inside the configured directory. It
never reads arbitrary host paths or sends PCZT bytes to the model. The
underlying Rust process may inspect the bytes locally.

## Security

This package has no direct network operations, agent LLM calls, signers or
custody code. The analyzer output contains only the limited rule IDs and
field paths enforced by Rust. The user controls which executable is trusted.

Future direction: use PyO3/maturin to ship native wheels based on the same
Rust core, avoiding the CLI dependency. This is not implemented yet.
