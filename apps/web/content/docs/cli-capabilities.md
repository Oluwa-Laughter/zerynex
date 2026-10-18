# CLI capability discovery for developer integrations

The native Zerynex CLI exposes a **versioned, offline, machine-readable capabilities contract**. Wallet developers, CLI wrappers, CI jobs, and trusted local agent tooling can inspect supported operations and limits **without reading a PCZT**.

```bash
zerynex --capabilities
```

This prints JSON on standard output and exits with status `0`. No file path, RPC server, wallet, network access or key material is required.

## Contract (schema version 1)

| Property | Meaning |
| --- | --- |
| `schema_version` | The capability-document structure version, currently `1` |
| `cli_version` | The exact installed Rust CLI package version |
| `rule_set_version` | Version of the compiled rule registry (use `--rule-catalog` to inspect it) |
| `rule_catalog_schema_version` | JSON registry schema version (currently `1`) |
| `tool` | Fixed identifier `zerynex` |
| `operations` | Available actions: `analyze_pczt` and `compare_pczt_stages` |
| `input_formats` | Raw `binary` and Zallet-compatible `base64` input **transport** |
| `output_formats` | Human-readable `text`, native `json`, and redacted `sarif` reports; older CLI builds may omit this property |
| `input_sources` | Local `file` or stdin (`-`) |
| `policy_profiles` | `external_signer`, `restricted_handoff` |
| `max_decoded_pczt_bytes` | Per-PCZT input limit (8 MiB) |
| `max_policy_file_bytes` | Local JSON policy-file limit (4 KiB) |
| `exit_codes` | `pass=0`, `error=1`, `findings_or_regressions=2` |
| `network_access`, `signing` | Both `false`; this CLI neither calls RPC nor signs |
| `disclaimer` | Explicit limits of the analyzer's conclusions |

**SDK compatibility rule:** Require a recognized `schema_version`, inspect `operations` rather than assuming a new feature exists, and pin/review the installed CLI version in production. The `cli_version` is not an upstream Zallet protocol compatibility version. A future major capability schema may change the shape; reject unsupported versions without silently falling back to weaker checks.

The capability command is exclusive: passing a transaction path, `--json`, `--profile`, policy switches or other analysis options together with `--capabilities` is an error. The normal `--json` flag still applies to actual policy analysis reports.

## Python adapter

```python
from zerynex_py import ZerynexClient

client = ZerynexClient(cli="/absolute/path/to/zerynex")
capabilities = client.capabilities()
assert "analyze_pczt" in capabilities.operations
print(capabilities.version, capabilities.max_decoded_pczt_bytes)
```

The Python wrapper exposes `capabilities.output_formats` (falling back to `text` and `json` for older CLI builds) and rejects unsupported or contradictory capability responses and never echoes process stderr. This is a local executable discovery API, **not** a remote service or a guarantee that another Zcash wallet's transaction lifecycle is fully supported.

## Downstream acceptance

- Inspect `--capabilities` on the executable extracted from an independently built release archive.
- Test synthetic PCZTs for successful and expected-finding exit codes.
- Use negative tests for unknown schema versions, unsupported operations and malformed response data.
- Do not place real user PCZTs, addresses, wallet databases or keys in public CI.

See [install instructions](installation.md), [GitHub Action guide](github-action.md), and [Zallet PCZT handoffs](zallet-pczt-handoff.md).
