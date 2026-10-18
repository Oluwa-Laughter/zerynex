# SARIF exports for security review and CI

Zerynex can export **SARIF 2.1.0**, a standard JSON interchange format for security-analysis results. This lets developer tooling consume sanitized **PCZT disclosure-policy observations** without writing another parser for Zerynex's native JSON report.

SARIF is generated from the canonical Rust PCZT engine. It does **not** make a security claim about proofs, signing authority, consensus correctness, privacy guarantees, or upstream wallet interoperability.

## Export findings locally

From a Zerynex source checkout, using only **synthetic, nonspendable** test fixtures:

```bash
cargo run --locked -- \
  apps/web/public/examples/transparent-v6.bin \
  --deny-transparent --sarif > zerynex.sarif
```

Rule IDs, severity, category and human-readable descriptions are read from the [versioned rule registry](rule-registry.md), not from a separate hand-maintained SARIF list. The output is valid JSON containing `version: "2.1.0"`, the Zerynex rule catalog, a single `runs` entry, and any findings under `results`. The fixture above deliberately triggers `PCZT-TRANSPARENT-OUTPUTS`, so the CLI exits with code **2** even though it successfully wrote the report. An input or runtime error exits **1** and must not be treated as a clean report.

The `--sarif` and `--json` switches are **mutually exclusive**. `zerynex --capabilities` lists all supported output formats without accepting PCZT data.

## Compare PCZT stages

```bash
cargo run --locked -- \
  apps/web/public/examples/clean-v6.bin \
  --compare-with apps/web/public/examples/transparent-v6.bin \
  --deny-transparent --sarif > zerynex-stages.sarif
```

Stage output includes current policy violations and `PCZT-STRUCTURE-DRIFT` when covered component counts change. Each policy result indicates whether it was **new in the candidate stage**. A violation that already existed in the baseline is **not hidden**. Resolved findings are not reported as active failures.

This is structural regression detection, **not** byte-level, amount, recipient, proof, signing, or commitment equivalence.

## Export from a GitHub Action

The Zerynex composite Action accepts an optional **`sarif-output`** path and exposes **`sarif-path`**. The output path must be relative to the checked-out repository, end in `.sarif`, and have an existing parent directory. It must not already exist. Symlinks, traversal, and out-of-workspace paths are rejected. The report is created as a new file with restrictive permissions. This option is available for single-fixture checks and stage comparisons, **not** scenario manifests.

```yaml
name: Synthetic PCZT security report
on: [pull_request]
permissions:
  contents: read
jobs:
  pczt-policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Oluwa-Laughter/zerynex@<reviewed-commit-sha>
        id: policy
        with:
          pczt-path: tests/fixtures/transparent-v6.bin
          deny-transparent: 'true'
          fail-on-findings: 'false'
          sarif-output: zerynex.sarif
      - uses: actions/upload-artifact@v4
        with:
          name: zerynex-policy-sarif
          path: ${{ steps.policy.outputs.sarif-path }}
          if-no-files-found: error
```

Replace the placeholder with a **reviewed commit SHA**, and supply your own nonspendable fixture at the stated path. `fail-on-findings: 'false'` makes this an **informational** job while retaining `passed=false` and the policy findings in the SARIF output. To enforce a CI gate instead, omit that option or set it to `true`; plan for an artifact upload step with `if: always()` when necessary.

**Artifact upload is opt-in and your responsibility.** The example archives a sanitized SARIF file; it does not upload PCZT bytes. GitHub Code Scanning ingestion and source-line annotations have **not** been independently certified for this logical-location-only format. Do not assume Code Scanning has accepted the report without checking that service's response.

## Privacy design and output contract

- SARIF results use **logical PCZT field locations** such as `pczt::transparent.outputs`, not a `physicalLocation`, file URI, original PCZT filename, source checkout path, or line number.
- The output includes a fixed, reviewed rule catalog. Unknown future rule IDs are rejected rather than mislabeled.
- Rule `properties` contain only the structural field path, observation category, and an optional `new_in_candidate` boolean. No transaction values or wallet addresses are intentionally emitted.
- The GitHub Action **only** processes developer-approved local synthetic fixtures. Do not add real PCZTs, signing material, addresses, wallet exports, or private RPC responses to public CI, even when the SARIF file itself is sanitized.
- The SARIF invocation carries a `zerynexPassed` property. Policy findings may be present despite a successful SARIF file write. Do not confuse file generation with policy success.

See [CLI reference](cli-reference.md), [Reports and exit codes](report-reference.md), [GitHub Action](github-action.md), and [Privacy model](privacy-model.md).
