# Adopt Zerynex in GitHub Actions

**No SDK integration or hosted service is required.** Use the Zerynex
repository as a GitHub composite action to check your own non-spendable,
synthetic PCZT fixtures during pull requests.

This action compiles the canonical Rust CLI from the pinned Zerynex revision
and runs it inside your GitHub runner. It outputs only counts and limited
rule/field identifiers. It never publishes PCZT contents or wallet keys.

Add a workflow like the following to your own Zcash project:

    name: Zcash privacy regression
    on: [push, pull_request]
    permissions:
      contents: read
    jobs:
      privacy:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: Oluwa-Laughter/zerynex@main
            id: privacy
            with:
              pczt-path: tests/fixtures/synthetic.pczt
              policy-path: policies/shielded-only.json
              input-format: binary
              fail-on-findings: 'true'

The @main reference tracks development, so in a production repository
replace it with the exact reviewed Zerynex commit hash.

Supported action inputs:
- pczt-path (required): fixture relative to the checked-out repository.
- policy-path: optional strict JSON file from the checked-out repository.
- input-format: binary (default) or base64 (Zallet transport).
- deny-transparent: true by default; can be false when appropriate.
- deny-sapling: false by default, optional application policy.
- fail-on-findings: true by default; false enables reporting-only CI.
- sarif-output: optional relative `.sarif` path for redacted single-PCZT or stage findings; no scenario-manifest support.

Outputs:
- passed: true only if zero policy findings.
- finding-count: an integer.
- sarif-path: relative generated SARIF path, or empty when not requested.

Exit behaviors: malformed input always fails CI. In default mode findings
also fail the job. Reporting-only mode retains a false passed result but
allows the job to complete so teams can evaluate adoption.

The action rejects paths outside the checked-out repository, empty files,
invalid policy options, and symlink fixtures. It produces a limited
job summary; it does not upload PCZTs as build artifacts.

## Security warning

**Never commit or upload real user PCZTs, keys, wallet databases, watch-only
key material, addresses, or sensitive RPC logs to CI.** PCZT intermediates
can reveal details absent from the final chain transaction. Use only
pre-generated synthetic, nonspendable fixtures. Do not enable debug shell
traces that could dump the working directory or transaction contents.

A passing policy check does not prove privacy, transaction validity,
proof correctness, or safe signing. Zerynex is an unaudited research tool.

For the complete fixture/workflow example see
examples/github-actions/privacy-policy-check.yml.

## Compare transaction handoff stages

An optional baseline-path changes the action from one-PCZT linting
into a stage-to-stage regression test.

    - uses: Oluwa-Laughter/zerynex@main
      with:
        baseline-path: tests/fixtures/before.pczt
        pczt-path: tests/fixtures/after.pczt
        fail-on-findings: 'true'

The regression-count output counts newly found rule/field issues and
pool component structure changes. finding-count still represents
remaining candidate policy violations. Preexisting policy violations
are not hidden by a clean regression result.

See docs/pczt-stage-regression.md for strong limitations.

## Offline synthetic PCZT role scenarios

Use scenario-manifest instead of pczt-path to evaluate multiple
expected policy transitions:

    - uses: Oluwa-Laughter/zerynex@main
      id: handoff
      with:
        scenario-manifest: tests/fixtures/synthetic-handoff/scenario.json

The passed, scenario-count and scenario-matched outputs describe whether
the test expectations matched. A fixture that intentionally introduces
a policy finding can still pass a regression test if this was expected.
Do not mix scenario-manifest with pczt-path, baseline-path or policy-path.

See docs/handoff-harness.md for the format and safety boundaries.

## Optional SARIF artifact

To produce a standard-format, **logical-location-only** report, set `sarif-output: zerynex.sarif` and archive `steps.<id>.outputs.sarif-path` with `actions/upload-artifact@v4` or another approved artifact system. The input path must be relative, inside the workspace, refer to a new file, and end in `.sarif`. No original PCZT path, bytes or wallet values are included in the report.

See [SARIF security reports](sarif.md) for a full example, disclosure limits, and status of GitHub Code Scanning support. The optional feature does not change the action's default behavior or policy failure exit codes.
