# Zerynex for agentic developer workflows

Zerynex supplies a portable Agent Skill and an optional local MCP server
for Zcash privacy engineering. Agents work with sanitized policy findings,
never raw intermediate transactions.

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

zerynex_policy_schema returns documentation about the currently supported
rules, with no file access.

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
