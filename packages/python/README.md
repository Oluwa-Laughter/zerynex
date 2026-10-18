# zerynex-python

Python 3.11+ adapter for **local Rust-backed** Zcash PCZT privacy analysis.
This package is not yet published on PyPI. A source-free wheel has been
built and tested in a clean Python virtualenv against the real Rust CLI.
See [release artifact downloads](https://zerynex.vercel.app/docs/releases).

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

## Installable offline RPC contract checker

The Python wheel also installs `zerynex-rpc-check`, a standalone **offline**
OpenRPC compatibility checker. It does not require the Rust executable,
connect to Zallet, or process PCZT bytes. Only method names and argument
requirements from explicitly selected local JSON files are compared:

```bash
zerynex-rpc-check \
  --schema tests/fixtures/rpc/zallet-pczt-lifecycle-synthetic-openrpc.json \
  --contract tests/fixtures/rpc/zallet-pczt-lifecycle-contract.json \
  --deny-new-required --json
```

The fixture is synthetic, not a capture from an upstream Zallet release.
Exit codes: `0` pass, `1` invalid input, `2` contract drift.
For production integrations, pin an actual Zallet release and inspect its
protected local `rpc.discover` response instead. See `docs/rpc-contracts.md`.

## Agent/MCP extra

    pip install './packages/python[mcp]'

Use the **local-only** MCP server after specifying a dedicated sandbox directory
containing synthetic fixtures:

    ZERYNEX_CLI=/absolute/path/to/zerynex
    ZERYNEX_AGENT_ALLOWED_ROOT=/absolute/path/to/synthetic-fixtures
    zerynex-mcp

Run a real local stdio MCP diagnostic before connecting an AI assistant:

    zerynex-mcp-doctor --server /abs/path/to/zerynex-mcp --cli /abs/path/to/zerynex --fixtures /abs/path/to/synthetic-fixtures

It discovers ten tools, checks four Rust-backed synthetic expectations, and verifies the unified developer preflight and an expected RPC regression.
Exit 0 means all matched, 1 means setup failed, 2 means a test mismatched.
The public /agents frontend also generates client-specific configuration
for common MCP hosts; it does not execute the MCP process in-browser.

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

## Z3 local diagnostics

Use zerynex-z3-check to probe only Zebra's documented loopback-bound
/healthy and /ready endpoints:

    zerynex-z3-check --host 127.0.0.1 --port 8080

See docs/z3-local.md. This checks two readiness signals only, not Zcash
consensus, Zallet wallet operation or Zaino gRPC.

## Consume a locally held Zallet PCZT without a temporary file

For a trusted application with an in-memory base64 PCZT string:

    from zerynex_py import ZerynexClient, Policy
    result = ZerynexClient(cli="/path/to/zerynex").analyze_base64(
        pczt_base64, Policy(deny_transparent=True)
    )

The Python adapter passes the encoded bytes over Rust CLI stdin and only
returns sanitized report fields. Do not provide confidential intermediates
to a cloud agent or to CI. See docs/zallet-pczt-handoff.md.

## Compare PCZT role handoffs

    result = client.compare_files(
        "path/to/before-synthetic.pczt",
        "path/to/after-synthetic.pczt",
        Policy(deny_transparent=True),
    )
    print(result.agent_summary())

This produces rule and pool-component differences using the same local
Rust engine. Not a transaction equivalence or proof validator.
See docs/pczt-stage-regression.md.

## Real MCP developer workflows

Nine read-only tools are available through the official MCP protocol:
analyze_synthetic_pczt, compare_synthetic_pczt_stages,
list_synthetic_fixtures, explain_zerynex_rule,
run_synthetic_smoke_suite, zerynex_policy_schema,
zerynex_core_capabilities, check_synthetic_zallet_rpc_contract,
run_zerynex_developer_preflight, and zerynex_rule_catalog.

A tested host workflow can list allowed .bin fixtures, analyze a synthetic
transparent output, explain the corresponding privacy rule, and compare
clean and flagged fixture stages. The smoke suite checks four fixed
expected outcomes through real Rust CLI calls, not mocked reports.
For instructions and security boundaries see docs/agents.md.

## Discover CLI support before integrating

The trusted local CLI exposes versioned JSON without reading PCZT contents:

```python
from zerynex_py import ZerynexClient

client = ZerynexClient(cli="/absolute/path/to/zerynex")
caps = client.capabilities()
print(caps.version, caps.operations, caps.max_decoded_pczt_bytes)
```

The wrapper rejects unsupported capability versions and unsafe output. This does not imply any live Zallet wallet or network compatibility. See `docs/cli-capabilities.md`.

## Unified CLI + MCP + agent preflight

```bash
zerynex-agent-preflight --cli /absolute/path/to/zerynex \
  --fixtures /absolute/path/to/approved-synthetic-fixtures --json
```

The command works without MCP or network dependencies. It checks the installed
Rust CLI's capabilities, four real synthetic PCZT invariants and a bundled
Zallet-style synthetic RPC contract. Exit codes: pass `0`, input/error `1`,
regression mismatch `2`. The agent MCP tools use the same implementation,
including a fixed RPC regression scenario menu with **no arbitrary files**.
See `docs/agents.md` for the trust boundaries.

## Read-only local Zcash node readiness

`zerynex-node-check --host 127.0.0.1 --port 8232 --expect-network test`
reads one local `getblockchaininfo` response and emits only network/sync readiness
fields. Use `--cookie-file /path/to/owner-private/.cookie` for nodes requiring
RPC authentication. It never takes a password in argv, connects to public
hosts, or exposes arbitrary wallet RPCs.

Python applications may use `inspect_node_local()` or pass an already obtained
response to `evaluate_blockchain_info()`. The pure `evaluate_blockchain_info()`
function has no network dependency. A lack of sync/status fields fails closed.
See `docs/node-readiness.md` for API examples and limitations.
