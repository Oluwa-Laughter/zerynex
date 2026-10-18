# CLI reference

The `zerynex` executable is the local command-line interface to the canonical Rust PCZT disclosure engine. It has **no hosted API requirement** and does not connect to wallets or broadcast transactions.

## Usage

```text
zerynex <PCZT-PATH | -> [OPTIONS]
zerynex --capabilities
```

`-` reads from standard input; unlike raw shell arguments, stdin avoids embedding confidential transaction bytes in command history or the process argument list.

## Options

| Option | Meaning |
| --- | --- |
| `--input-format binary` | Parse raw PCZT bytes (default) |
| `--input-format base64` | Decode base64 PCZT transport from a file or stdin |
| `--profile external-signer` | Standard signer handoff policy (default) |
| `--profile restricted-handoff` | Additional field-disclosure restrictions |
| `--deny-transparent` | Report transparent PCZT inputs and outputs |
| `--deny-sapling` | Report Sapling spends and outputs under an application policy |
| `--policy-file <path>` | Read a strict, bounded JSON policy file |
| `--compare-with <path>` | Compare the primary PCZT with a later local stage |
| `--json` | Output a machine-readable report instead of human text |
| `--sarif` | Output sanitized SARIF 2.1.0 results with logical PCZT field locations; mutually exclusive with `--json` |
| `--capabilities` | Print a versioned capability JSON document; cannot be combined with analysis arguments |
| `--help`, `--version` | Display usage or version information |

The primary PCZT argument is required except for `--capabilities`. Binary inputs have an **8 MiB limit**; policy files have a **4 KiB limit**. Exceeding limits, failing to decode, or supplying unknown policy fields fails closed.

## Single-stage analysis

```bash
zerynex path/to/synthetic.pczt --profile external-signer --deny-transparent --json
```

## Base64 via stdin

```bash
cat path/to/synthetic.pczt.b64 | \
  zerynex - --input-format base64 --deny-transparent --json
```

Use **local** test fixtures for CI and assistant-driven workflows; do not upload a wallet's intermediate transaction to external services.

## Compare two stages

```bash
zerynex path/to/before-synthetic.pczt \
  --compare-with path/to/after-synthetic.pczt --json
```

The report detects new or resolved *structural findings* and component counts, **not** changed amounts or cryptographic transaction equivalence. See [Stage regression testing](pczt-stage-regression.md).

## Exit codes

| Exit | Interpretation | Required automation behavior |
| --- | --- | --- |
| `0` | Implemented checks passed | Continue, subject to separate wallet validation |
| `1` | Invalid input, parsing, unsupported option or runtime failure | Stop; no reliable report |
| `2` | Policy findings or stage regressions detected | Stop or request explicit review |

If you need to detect supported features without passing a file, use `zerynex --capabilities` and check `schema_version` before consuming it. See [Capabilities](cli-capabilities.md), [Policy JSON](policy-format.md), [SARIF security reports](sarif.md), and [Reports](report-reference.md).
