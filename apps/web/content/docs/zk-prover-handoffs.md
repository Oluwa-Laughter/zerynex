# ZK and prover handoff engineering

Zerynex is **not a proof system or zero-knowledge verifier**. Its current
ZK-related value is at the interface between privacy engineering and Zcash
Partially Created Transactions: developers can test disclosure rules and
component structure as a transaction moves between upstream PCZT roles.

## What works today

- Parse real PCZTs with the upstream Rust PCZT crate.
- Compare field **presence** and component **counts** across two stages.
- Flag newly present proprietary metadata and selected disclosure-policy
  fields using the canonical Rust engine.
- Run synthetic Creator/Updater/Combiner/Redactor role acceptance scenarios.
- Export sanitized results through CLI, Python, Go, CI and MCP fixtures.

A synthetic stage check:

    cargo run --locked -- \
      apps/web/public/examples/clean-v6.bin \
      --compare-with apps/web/public/examples/flagged-v6.bin --json

This is an example of checking whether extra metadata appears at a handoff.
The sample does not exercise ZK proof generation or verification.

## Suggested workflow for prover engineers

1. Work with a disposable, synthetic or nonspendable PCZT fixture.
2. Define a role-specific privacy policy and a permitted component topology.
3. Capture a baseline fixture before a proving/signing handoff.
4. Run the same policy after the role completes, using the stage regression CLI.
5. Check separate upstream verifier/prover outcomes using their own published
   cryptographic APIs. Do not infer proof validity from a Zerynex report.
6. Add the deterministic, non-sensitive fixtures to a regression suite.

## Not implemented yet

- Calling Sapling, Orchard, Ironwood, or Halo2 proving/verifier APIs
- Circuit constraint checks, witness analysis, proof generation, or
  cryptographic soundness verification
- A signer/prover authorization policy or transaction equivalence checker
- Real Zallet prover RPC compatibility and regtest lifecycle checks

We must pin upstream versions, supply positive and negative synthetic test
vectors, and run the real upstream prover/verifier before describing any
of those as supported.

## Upstream references

- [ZIP-374 PCZT](https://zips.z.cash/zip-0374)
- [librustzcash](https://github.com/zcash/librustzcash)
- [Orchard](https://github.com/zcash/orchard)
- [Halo2](https://github.com/zcash/halo2)
- [Zallet RPC](https://zcash.github.io/zallet/rpc/index.html)

This feature is an early privacy regression guard, not an audit.
Do not publish actual wallet PCZTs or ZK witnesses to public CI or LLMs.
