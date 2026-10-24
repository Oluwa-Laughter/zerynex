# Python SDK API

`zerynex-python` provides a thin, local adapter to the canonical Rust CLI. It does not duplicate the PCZT parser in Python, host a wallet, call a remote Zerynex API or send transaction data to an AI service.

## Install from PyPI or source

Requires Python **3.11+** and the trusted Rust `zerynex` executable:

```bash
# Install the reviewed Rust CLI, or compile it from the source checkout:
cargo build --locked --release --bin zerynex
python3 -m venv .venv
.venv/bin/python -m pip install zerynex-python==0.2.0
```

The Python wheel is independently tested and delegates PCZT analysis to the local Rust CLI. See [Downloads](releases.md).

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

The wheel also installs `zerynex-rpc-check` for offline schema drift,
`zerynex-zallet-fixture-check` for explicitly supplied local base64 PCZT
fixtures, `zerynex-agent-preflight` for synthetic integration verification,
and an optional `zerynex-mcp` server when installed with `[mcp]`. The fixture
checker needs a trusted Rust CLI executable; its producer label is author
asserted and does not prove live Zallet interoperability. The MCP tools are
**read-only and synthetic-fixture-only**.

See [MCP and agents](agents.md), [RPC compatibility](rpc-contracts.md), and [Report reference](report-reference.md).

For real Zcash infrastructure integrations, see [Node readiness](node-readiness.md) and [Zcash application recipes](zcash-app-recipes.md).

## Offline synthetic refund privacy for agent-safe workflows

The installed Python wheel includes three fixed, nonspendable manifest
scenarios and the read-only helpers
`synthetic_refund_audit(scenario)`,
`synthetic_refund_regression(baseline, candidate)` and
`synthetic_refund_smoke_suite()` in
`zerynex_py.refund_workflows`. Only `isolated`, `risky` and
`regression-expanded` scenario names are accepted; no arbitrary
files, wallet keys or real address data are read.

The wheel's `zerynex-agent-preflight` checks six expected refund
cases in addition to Rust PCZT and synthetic RPC diagnostics.
`zerynex-mcp` offers `audit_synthetic_refund_privacy` and
`compare_synthetic_refund_privacy` for explicitly configured
local stdio hosts. No MCP tools can operate on private or external
refund metadata; use the [local refund auditor](refund-privacy-audit.md)
in your trusted application instead.
