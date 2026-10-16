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
Versioned tags/releases are not published yet.

Supported action inputs:
- pczt-path (required): fixture relative to the checked-out repository.
- policy-path: optional strict JSON file from the checked-out repository.
- input-format: binary (default) or base64 (Zallet transport).
- deny-transparent: true by default; can be false when appropriate.
- deny-sapling: false by default, optional application policy.
- fail-on-findings: true by default; false enables reporting-only CI.

Outputs:
- passed: true only if zero policy findings.
- finding-count: an integer.

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
