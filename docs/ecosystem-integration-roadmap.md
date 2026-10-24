# Ecosystem integration roadmap

Zerynex is a **policy and regression-testing layer**, not a replacement for Zcash wallet SDKs, Zebra nodes, lightwalletd, indexers, or proving libraries. Its primary extension point is a local PCZT at a transaction handoff boundary. Avoid exporting wallet keys or private PCZTs to hosted analysis services.

## Adopt today (implemented interfaces)

| Developer | Integration | Boundary |
| --- | --- | --- |
| Wallet / signer / prover team | Rust CLI + PCZT role-handoff checker | Selected metadata/pool disclosure checks, not signature/proof verification |
| Web app team | Local TypeScript + WASM browser SDK | File/Blob analysis on-device; no hosted upload |
| Backend developer | Rust library; Python and Go CLI adapters | Same Rust rules; adapters are not native protocol SDKs |
| Maintainer | Composite GitHub Action and regression manifests | CI with synthetic, nonspendable fixtures only |
| Agent developer | Restricted read-only MCP tools | Explicitly approved synthetic fixtures, never private wallets |

Start with the copyable [consumer CI starter](https://github.com/Oluwa-Laughter/zerynex/tree/main/examples/consumer-integration), then the [SDK distribution notes](sdk-distribution.md) and [integration contracts](integration-contracts.md).

## Upstream compatibility targets (not yet verified end-to-end)

1. **Zallet + PCZT RPC:** Zallet beta.3's generated RPC book is SHA-256-pinned and checked for seven method/parameter signatures in CI. An offline producer-fixture harness can check locally supplied, version-labelled base64 PCZTs against expected findings; CI exercises it with synthetic bytes only. The producer label is author asserted. Still capture and test actual version-pinned Zallet output in a disposable local environment. Documentation, synthetic fixtures and base64 transport do not prove runtime RPC interoperability.
2. **Zebra / Z3:** strengthen local readiness diagnostics against versioned node responses, with explicit auth and loopback restrictions. Liveness is not consensus correctness.
3. **lightwalletd:** the shipped TypeScript SDK and [browser workbench](https://zerynex.vercel.app/tools/lightwalletd) now normalize public `GetLightdInfo` responses offline with strict bounded JSON and sanitized status. **Still missing:** opt-in version-pinned live gRPC compatibility tests and a trusted backend adapter. No health response can guarantee consensus, shielded sync, privacy or wallet correctness.
4. **Zaino / indexer:** add a read-only adapter for trusted local fixtures and version-pinned protocol definitions; surface chain mismatch and indexing lag distinctly.
5. **Prover and signer environments:** positive/negative stage fixtures, checks on expected PCZT field visibility, and compatibility matrices. Do not claim ZK proof correctness.
6. **Language/tool distribution:** publish versioned Rust binaries and crate, npm WASM SDK, Python wheel, tested Go module tags, reviewed Action tag, and checksums. Actual registry publication requires owner-approved credentials and external consumer testing.

## Gates for declaring a new integration supported

- Reference an exact upstream library or service version.
- Demonstrate a deterministic positive and negative fixture in the consuming project.
- Report only sanitized rule identifiers, counts, and field names; not contents.
- Avoid silent outbound network access and never handle spend authority or wallet secrets.
- Test on an unrelated clean consumer, not only inside the monorepo.
- Document known missing surfaces (consensus, network privacy, prover/signature semantics).

Upstream reference material: [librustzcash](https://zcash.github.io/librustzcash/rustdoc/latest/zcash_client_backend/), [pczt](https://zcash.github.io/librustzcash/rustdoc/latest/pczt/), [Zebra/lightwalletd](https://github.com/ZcashFoundation/zebra/blob/main/book/src/user/lightwalletd.md).
