# zerynex-python

Python 3.11+ adapter for **local Rust-backed** Zcash PCZT privacy analysis.
The official [`zerynex-python` 0.2.0 release](https://pypi.org/project/zerynex-python/0.2.0/)
is available on PyPI, with a verified wheel and source distribution.
The Python PCZT adapter requires the separately installed trusted
[`zerynex` Rust CLI](https://github.com/Oluwa-Laughter/zerynex/releases/tag/v0.2.0).

## Install from PyPI

    python3 -m pip install zerynex-python==0.2.0

## Install from a source checkout

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

## Installable local PCZT producer-fixture checker

The wheel also installs `zerynex-zallet-fixture-check`. Supply a protected
local manifest and canonical base64 `.b64` PCZT fixtures, plus the trusted
Rust CLI path:

```bash
zerynex-zallet-fixture-check \
  --manifest /protected/local/manifest.json --cli /absolute/path/to/zerynex
```

The command checks file digests and exact policy findings without an RPC or
network connection. Its producer release label is supplied by the manifest
author, not authenticated by Zerynex. The clean-wheel consumer test uses
synthetic PCZTs, so it does not establish live Zallet compatibility. See
`docs/zallet-pczt-handoff.md` for the manifest and exit codes.

## Agent/MCP extra

    pip install './packages/python[mcp]'

Use the **local-only** MCP server after specifying a dedicated sandbox directory
containing synthetic fixtures:

    ZERYNEX_CLI=/absolute/path/to/zerynex
    ZERYNEX_AGENT_ALLOWED_ROOT=/absolute/path/to/synthetic-fixtures
    zerynex-mcp

Run a real local stdio MCP diagnostic before connecting an AI assistant:

    zerynex-mcp-doctor --server /abs/path/to/zerynex-mcp --cli /abs/path/to/zerynex --fixtures /abs/path/to/synthetic-fixtures

It discovers twelve tools, checks four Rust-backed synthetic PCZT expectations, and verifies the unified developer preflight, bundled refund scenarios, and an expected RPC regression.
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

## Project bootstrap (offline)

The wheel installs `zerynex-project`. This command creates an integration
inside an existing Zcash application rather than connecting this website to
a developer machine:

```bash
zerynex-project init --project /absolute/path/to/my-zcash-app --ci --json
zerynex-project verify --project /absolute/path/to/my-zcash-app --cli /absolute/path/to/zerynex --json
```

Initialization refuses existing files and symlinked destination directories,
and creates only a reviewed policy, manifest, bundled nonspendable synthetic
PCZT fixtures and optional GitHub Action pinned to an immutable commit.
Verification checks those bytes and executes the **actual local Rust CLI**
against both fixtures. Passing proves only the local toolchain's expected
synthetic behavior, not wallet connectivity, chain consensus or anonymity.
No private PCZT, signing key, RPC endpoint or wallet connection is accessed.

### Explicit project PCZT policy checks

After `init`, developers can opt in to analyzing an actual local PCZT.
These commands **never discover** private files, use the network, or
automatically change a wallet transaction. `--pczt`, `--before` and
`--after` must be existing, regular files **inside** the selected project.

```bash
zerynex-project check --project /path/to/app --pczt data/my.pczt --cli /path/to/zerynex --json
zerynex-project compare --project /path/to/app --before data/unsigned.pczt --after data/signed.pczt --cli /path/to/zerynex --json
```

`check` uses the project's strict `.zerynex/policy.json`, which the
developer may customize, and returns only a result, finding count and
recognized rule IDs. `compare` returns before/after counts and added or
resolved known rule IDs, without exporting PCZT field contents.
Exit code `0` means no selected policy findings/regressions,
`2` means findings, and `1` means invalid input or execution failure.
Use a trusted local workspace and CLI. Do not put real private PCZTs into
public CI, browser demos, external MCP hosts, or logs.

## Swap refund and viewing-key privacy metadata audit

The installed `zerynex-refund-audit` command checks a strict, local JSON manifest of **opaque non-secret identifiers**, not Zcash addresses or keys. Its static findings cover refund-address reuse, shared viewing-key scope, public refund exposure, refund query disclosure and unsupported custody assertions. This is a threat-model integration aid, not a post-quantum cryptography implementation or real wallet inspection. See `docs/refund-privacy-audit.md` for schema, examples and limitations.


### Compare refund integration revisions

Use `zerynex-refund-audit --baseline /path/to/before.json --manifest /path/to/after.json --json` to detect **new per-flow** exposure declarations. A newly affected flow triggers a regression even if the same rule ID already applied to another flow. Exit `0` means no *new* declared risk events, exit `2` means new events, and exit `1` is invalid input. No private values or flow references are returned. Source manifests must contain **non-secret metadata only**. This does not attest wallet isolation or quantum safety. See `docs/refund-privacy-audit.md`.


The packaged refund-audit SDK also exports `audit_manifest`, `compare_manifests`, `sarif_report` and `RefundAuditInputError`. Add `--sarif` instead of `--json` when integrating with SARIF-capable tooling. The exported SARIF contains no source locations or opaque references and only covers **declared** risk categories.


## Refund privacy checks for local MCP agents

The optional read-only MCP server exposes
`audit_synthetic_refund_privacy(scenario)` and
`compare_synthetic_refund_privacy(baseline, candidate)`. Only the three
bundled scenario names `isolated`, `risky` and `regression-expanded`
are accepted; arbitrary paths and JSON are denied. The packaged
`zerynex-agent-preflight` verifies six offline, synthetic refund-privacy
expectations and the MCP doctor checks these tools via a real stdio host.
Agents never receive viewing keys, wallet data, refund addresses or flow
identifiers, and a passing synthetic declaration is **not** a post-quantum
privacy certification. For actual application-owned, public-safe metadata
use the standalone `zerynex-refund-audit` CLI in a trusted environment.
