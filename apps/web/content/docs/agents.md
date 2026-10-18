# Zerynex for agentic developer workflows

Zerynex supplies a portable Agent Skill and an optional local MCP server
for Zcash privacy engineering. Agents work with sanitized policy findings,
never raw intermediate transactions. The current implementation uses a real
MCP 2.x stdio server with the canonical Rust CLI and **ten verified tools**.

You can start at [the Agent Tools page](/agents): choose Cursor, Claude
Desktop or VS Code, enter three local absolute paths, and copy the
configuration. No path is transmitted to Zerynex. The in-browser sample
there runs Rust/WebAssembly **not** an MCP server. The MCP server must
be installed, launched and authorized by your own local agent host.

## Install Agent Skill

The folder agent/skills/zcash-privacy-check contains a compliant SKILL.md,
with YAML frontmatter and reference material. Add the folder to an agent
host's supported skill directories. Exact installation depends on the
host product and is not automatic.

## Install the read-only MCP server

Requires Python 3.11+, a built Rust CLI and the official MCP Python SDK.
From repository root:

    cargo build --locked --release
    python -m venv .venv
    .venv/bin/python -m pip install './packages/python[mcp]'

The MCP process needs these two explicit environment variables (absolute
paths, not tilde shortcuts):

    ZERYNEX_CLI=/absolute/path/to/zerynex/target/release/zerynex
    ZERYNEX_AGENT_ALLOWED_ROOT=/absolute/path/to/zerynex/apps/web/public/examples

Launch by configuring an MCP host to execute:

    /absolute/path/to/zerynex/.venv/bin/zerynex-mcp

Before connecting an AI assistant, use the actual installed MCP client
diagnostic:

    /absolute/path/to/zerynex/.venv/bin/zerynex-mcp-doctor       --server /absolute/path/to/zerynex/.venv/bin/zerynex-mcp       --cli /absolute/path/to/zerynex/target/release/zerynex       --fixtures /absolute/path/to/zerynex/apps/web/public/examples

It launches an independent stdio MCP server process, discovers all ten
tools, executes three real Rust scans plus a stage comparison against
approved synthetic fixtures, and reports how many of four expectations
matched. Exit 0 = connected and all expectations matched; 1 = connection/
configuration failure; 2 = connected but regression expectations failed.

The server uses stdio and does NOT expose any HTTP port, wallet session,
signer, transaction publisher, or arbitrary filesystem tool.

## Tools and permissions

analyze_synthetic_pczt accepts only a simple lowercase .bin filename within
the configured synthetic-fixture directory. It rejects traversal, separators,
symlinks and paths outside the root. It only returns a list of rule identifiers
and field paths; it does not return PCZT bytes.

compare_synthetic_pczt_stages takes two approved synthetic .bin
basenames from the configured fixture directory. It returns rule
identifiers and component-count observations from the local Rust engine.
No private fields or transaction bytes are returned.

list_synthetic_fixtures lists up to 32 approved .bin basenames, no
contents. Symlinks and non-regular files are excluded, and it bounds
directory enumeration.

explain_zerynex_rule accepts one of seven fixed rule IDs and returns a
reviewed explanation and a suggested developer check; it does not
echo arbitrary agent input or inspect files.

run_synthetic_smoke_suite executes four real Rust-backed checks, three
individual policy scans and one stage comparison, and verifies the
expected fixture outcomes. Detecting the intentionally flagged or
transparent fixture is a **passing test**, not a passing privacy policy.
It returns 4/4 for the known-good bundled test suite. If a fixture
is missing, its case fails closed.

zerynex_policy_schema returns documentation about the currently supported
rules, with no file access.

## Unified developer preflight and offline RPC regressions

The installed Python wheel also ships `zerynex-agent-preflight`, which joins
**Rust CLI capability discovery**, four real Rust-backed synthetic PCZT checks,
and a bundled **seven-method synthetic Zallet OpenRPC contract** into one
sanitized result. This is usable from CI without an MCP host or network
service:

```bash
zerynex-agent-preflight \
  --cli /absolute/path/to/zerynex \
  --fixtures /absolute/path/to/approved-synthetic-fixtures \
  --json
```

Exit status: `0` all checks matched; `2` a synthetic check failed; `1`
configuration or execution error. The check does **not** prove compatibility
with any Zallet release or confirm real wallet transaction safety.

Four additional read-only MCP tools expose reviewed registry metadata and the same verified components:

- `zerynex_rule_catalog`: validates the live local Rust rule registry against the bundled Python metadata and returns only public IDs, descriptions, severity and scope; mismatched versions fail closed
- `zerynex_core_capabilities`: validated Rust CLI operations and limits,
  without reading a transaction file
- `check_synthetic_zallet_rpc_contract`: takes only `baseline`,
  `missing_method` or `new_required_parameter` as a fixed scenario; tests
  bundled, nonspendable synthetic RPC schemas; an intentionally failing
  contract is an **expected successful regression detection**
- `run_zerynex_developer_preflight`: checks CLI, synthetic PCZT suite and
  synthetic RPC contract together, with explicit per-component statuses

No agent can submit arbitrary filesystem paths, credentials, RPC URLs, raw
PCZTs or untrusted OpenRPC JSON to these tools. The two synthetic JSON files
are included in the Python wheel and compared against the repository's
canonical fixtures in tests. Developers working with actual wallet
schemas should run the standalone `zerynex-rpc-check` **themselves** on
protected local files, rather than sending the schema to an agent.

The MCP doctor verifies these tools against a genuine stdio subprocess,
including one negative RPC regression. See the [RPC contract guide](rpc-contracts.md)
and [CLI capability contract](cli-capabilities.md).

Use a dedicated synthetic-fixture directory and keep actual wallet files,
secrets and production data elsewhere. The file root is explicitly trusted
by the operator, not automatically safe.

## MCP host configuration

Hosts generally register a local server using command, args and env keys.
For example, a host supporting the mcpServers format may use:

    {
      "mcpServers": {
        "zerynex": {
          "command": "/absolute/path/to/zerynex/.venv/bin/zerynex-mcp",
          "args": [],
          "env": {
            "ZERYNEX_CLI": "/absolute/path/to/zerynex/target/release/zerynex",
            "ZERYNEX_AGENT_ALLOWED_ROOT": "/absolute/path/to/zerynex/apps/web/public/examples"
          }
        }
      }
    }

Some hosts use servers instead of mcpServers. Follow that host's own docs.

## Testing

    PYTHONPATH=packages/python/src python -m unittest discover -s packages/python/tests -v

MCP protocol integration tests run in CI with the optional SDK installed.

## Why not send the file to an AI model?

ZIP-374 documents that intermediate PCZTs may reveal more than their final
shielded on-chain result. Prompts, cloud logs, and external tools can create
new disclosure risks. Agents should coordinate test scenarios and interpret
sanitized findings, not ingest actual transaction intermediates.

This does not establish a sandbox against a compromised host or a
cryptographic security certification.

## Node health is opt-in and separate

The zerynex-z3-check Python command can check loopback-only Zebra health
endpoints. This command is NOT exposed through the MCP agent tools by
default. See docs/z3-local.md.

## First actual agent task

After connecting a supported MCP host, ask your assistant:

> List the approved synthetic fixtures, run the synthetic smoke suite,
> report the number of expectations matched, and explain
> PCZT-TRANSPARENT-OUTPUTS. Do not read raw PCZT bytes or access the wallet.

The expected tool calls are list_synthetic_fixtures,
run_synthetic_smoke_suite, and explain_zerynex_rule. With the checked-in
fixtures and compiled trusted Rust CLI, the smoke suite should report
4/4 matched, with the developer preflight and synthetic RPC negative test also passing; the final output is only status, rule and path metadata.
A host may require you to approve tool execution first.

For a developer pull-request workflow, compare
clean-v6.bin against flagged-v6.bin with
compare_synthetic_pczt_stages. A new PCZT-GLOBAL-METADATA finding should
be reported. This is a *synthetic regression* example and is not an
assertion that a real wallet signing session was inspected.

### Do not confuse product surfaces

- The hosted browser can run Rust/WASM checks locally without a server.
- The MCP adapter starts only in the developer's machine after explicit
  installation and approval.
- CI tools run only approved synthetic test vectors.
- None of these tools create Zcash transactions, send ZEC, generate ZK
  proofs, read mnemonic phrases or prove complete confidentiality.

## VS Code configuration format

Zerynex's website supplies the VS Code-specific .vscode/mcp.json shape,
with a top-level servers object and a stdio server type. Modern VS Code
also supports a portable workspace .mcp.json configuration with a top-level
mcpServers object. To share configuration across compatible hosts, prefer
the portable format where possible. The current VS Code specific format
continues to work for existing workspaces. Review VS Code's upstream
configuration reference before enabling an agent tool:
https://code.visualstudio.com/docs/agents/reference/mcp-configuration
