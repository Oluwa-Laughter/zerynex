# Zerynex privacy model

Local PCZT privacy analysis at component handoff boundaries. Both Rust CLI and browser WASM process local bytes; no hosted analysis endpoints.

Protected: unnecessary disclosure to signers/provers, unreviewed proprietary fields, and dummy spending keys.

Reports intentionally emit only fixed rule identifiers and field paths, never field values.

Not covered: consensus validity, proof validation, complete Sapling/transparent pool scanning, compromised browsers/devices, or network metadata privacy. Passing checks is not a security audit.

Synthetic fixtures are v6 PCZTs created by official Zcash Rust APIs with no spendable funds; one includes intentionally flagged synthetic global metadata.
