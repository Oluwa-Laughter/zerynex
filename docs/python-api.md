# Python SDK API

`zerynex-python` provides a thin, local adapter to the canonical Rust CLI. It does not duplicate the PCZT parser in Python, host a wallet, call a remote Zerynex API or send transaction data to an AI service.

## Install from source or verified wheel

Requires Python **3.11+** and the trusted Rust `zerynex` executable:

```bash
cargo build --locked --release --bin zerynex
python -m venv .venv
.venv/bin/python -m pip install ./packages/python
```

The Python wheel is independently tested; PyPI registry publication is not yet complete. See [Downloads and releases](releases.md).

## Analyze a local PCZT

```python
from zerynex_py import Policy, ZerynexClient

client = ZerynexClient(cli="/absolute/path/to/zerynex")
report = client.analyze_file(
    "apps/web/public/examples/transparent-v6.bin",
    Policy(profile="external_signer", deny_transparent=True),
)
if not report.passed:
    for finding in report.findings:
        print(finding.rule, finding.field)
```

The fixture path above exists in a Zerynex source checkout. For an external SDK consumer, use a synthetic fixture you generated locally and control.

## Python interfaces

| API | Description |
| --- | --- |
| `Policy(profile=..., deny_transparent=..., deny_sapling=...)` | Immutable typed disclosure policy |
| `ZerynexClient(cli=..., timeout=12.0)` | Configure a local Rust binary and finite timeout |
| `client.capabilities()` | Return validated CLI version, supported operations and output formats (including SARIF when available) |
| `client.analyze_file(path, policy?)` | Inspect a local PCZT file |
| `client.analyze_base64(encoded, policy?)` | Pass an in-memory base64 PCZT to the CLI via stdin |
| `client.compare_files(before, after, policy?)` | Compare local handoff stages |
| `report.agent_summary()` | Build a sanitized finding/rule summary |

`ZerynexError` covers invalid configuration, local execution failures, and malformed output. It avoids echoing transaction contents or stderr from the Rust subprocess. Do not treat an exception as a clean policy result.

## Developer automation

The wheel also installs `zerynex-rpc-check` for offline schema drift, `zerynex-agent-preflight` for local synthetic integration verification and an optional `zerynex-mcp` server when installed with `[mcp]`. The MCP tools are **read-only and synthetic-fixture-only**.

See [MCP and agents](agents.md), [RPC compatibility](rpc-contracts.md), and [Report reference](report-reference.md).

For real Zcash infrastructure integrations, see [Node readiness](node-readiness.md) and [Zcash application recipes](zcash-app-recipes.md).
