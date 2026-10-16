# PCZT Stage Regression: compare disclosure changes across Zcash roles

Zerynex compares two local PCZT snapshots with the same Rust disclosure
rules. This is an early developer guard for creator/prover/signer handoffs,
not a cryptographic transaction equivalence verifier.

## Try it in the browser

Open [the PCZT Stage Comparator](/tools/stages) to compare two local PCZT
snapshots with the **same Rust policy engine compiled to WebAssembly**. The
page includes three checked-in synthetic scenarios (new proprietary
metadata, transparent output topology, resolved metadata) and accepts
your own local binary PCZT files, up to 8 MiB each. Values are not sent
to a Zerynex server. You can export the resulting sanitized JSON report.

This is the browser implementation of selected structural checks, not
a full transaction equivalence verifier.

## CLI example: new sensitive metadata

    cargo run --locked -- \
      apps/web/public/examples/clean-v6.bin \
      --compare-with apps/web/public/examples/flagged-v6.bin --json

Expected: a new PCZT-GLOBAL-METADATA finding and exit code 2.
The report includes rule identifiers and field paths, never metadata values.

## CLI example: unexpected change in component structure

    cargo run --locked -- \
      apps/web/public/examples/clean-v6.bin \
      --compare-with apps/web/public/examples/transparent-v6.bin --json

Expected: transparent.outputs component count changes, exit code 2, even
when the active policy permits transparent components.

Use --policy-file to apply an explicit disclosure policy. Both source
and candidate use the same --input-format (binary or base64). The source
may be "-" for stdin, while the candidate must be a path.

## Python SDK

    from zerynex_py import ZerynexClient, Policy
    client = ZerynexClient(cli="./target/debug/zerynex")
    result = client.compare_files(
        "apps/web/public/examples/clean-v6.bin",
        "apps/web/public/examples/flagged-v6.bin",
        Policy(deny_transparent=True),
    )
    print(result.agent_summary())

## Reusable CI action

    - uses: Oluwa-Laughter/zerynex@main
      with:
        baseline-path: tests/fixtures/before-synthetic.pczt
        pczt-path: tests/fixtures/after-synthetic.pczt
        fail-on-findings: 'true'

Review and pin the action to an immutable commit for real integrations.
Use synthetic, nonspendable fixtures only. The action adds regression-count
to its outputs (new rule findings and component-count changes).
finding-count is the number of remaining candidate policy findings.

Even if no NEW finding appears, a pre-existing violation fails the policy
check. No component-count drift is allowed in a passing comparison.

## Explicit limitations

This can detect:
- newly present rule/field locations covered by existing disclosure checks;
- removed previously violating fields;
- changed component counts for six shielded/transparent component types.

It cannot detect:
- changed field values with the same structure or classification;
- changed recipient, amount, memo, randomness, commitment or signing keys;
- proof validity, consensus correctness or signing authorization;
- privacy leaks in logging, RPC traffic or transport behavior.

This is a partial acceptance test and should not be treated as an
audit or an authorization to broadcast funds.
