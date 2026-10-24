# External developer verification and extension boundaries

Zerynex v0.2.0 is a **policy and regression-testing toolkit**, not a Zcash wallet, light client, proof verifier, broadcast service, or privacy guarantee. The checks below make clear which integration paths exercise real installed artifacts rather than only local imports. The workbench uses local Rust/WASM and does not require uploading PCZT bytes.

## Verification contract

| Interface | How to test it independently | What the test actually proves | Not yet proven |
| --- | --- | --- | --- |
| Rust CLI and library | `cargo test --locked --all-targets` plus `cargo publish --dry-run --locked` | Rust policy behavior, stage vectors and crate packaging | Runtime interoperability with every wallet or node |
| JS/TS SDK | `cd packages/sdk && npm run check`, then from the repository root run `node scripts/test-sdk-packed.mjs` | Locally packed `@zerynex/sdk` installs in an unrelated project; actual Rust/WASM analyzes synthetic PCZTs, validates ZIP-321, checks RPC snapshots, imports strict policies | Published npm ownership/availability, arbitrary browser bundler behavior |
| Python adapter | Build v0.2.0 wheel, then `python scripts/test-python-wheel.py dist/python` | Clean virtualenv imports and executes the wheel with the real Rust CLI; known synthetic policy, refund, MCP and RPC tests | Published PyPI availability or a Python-only native PCZT engine |
| Web UI | `cd apps/web && pnpm typecheck && pnpm lint && pnpm test:e2e` | Responsive browser interactions and Rust/WASM UI analysis when the E2E suite completes | Every browser, device, or production deployment |
| Go SDK | `cd packages/go && go test ./...` | Adapter behavior against checked-in fixtures | Tagged, independently installed Go module and live-node interoperability |
| Action/agent | `python3 -m unittest discover -s tests -p test_consumer_starter.py`; MCP checks in CI | Reviewed SHA-pinned CI starter and opt-in synthetic operations | Real wallet authority, live application secrets, arbitrary agent autonomy |

Run browser tests without overlapping Playwright suites on limited-memory machines. If timeouts occur under resource contention, rerun the affected tests in isolation and do not count the run as successful.

## Consumer-safe contract

- **Input boundaries:** Local PCZT files are bounded to 8 MiB. Imported policy JSON is at most 4 KiB and rejects unknown options and duplicate decoded keys, including Unicode aliases. Refund manifests are at most 64 KiB and use the same strict JSON boundary.
- **Policy comparison:** Only versioned IDs/field names and sanitized counts are suitable for CI. Findings indicate selected disclosures, not proof of anonymity or consensus validity.
- **Extensibility:** Integrate through `@zerynex/sdk`, `@zerynex/sdk/browser`, the Rust CLI/library, the Python/Go wrappers, the composite Action, or the read-only MCP tooling. Consumers own local file selection, RPC endpoints, provider authorization and disclosure policy.
- **No hidden network dependency:** Privacy policy and synthetic regression checks run offline. Node readiness and transaction observations only normalize results supplied by a trusted backend; they do not make remote calls themselves.
- **Release limitations:** GitHub artifacts, npm/PyPI/crates.io publication, and real-world wallet/node interop have independent verification and approval gates. No public registry publication should be inferred from a successful source build.

See [external integration starter](https://github.com/Oluwa-Laughter/zerynex/tree/main/examples/consumer-integration), [SDK distribution](https://github.com/Oluwa-Laughter/zerynex/blob/main/docs/sdk-distribution.md) and [upstream compatibility roadmap](https://github.com/Oluwa-Laughter/zerynex/blob/main/docs/ecosystem-integration-roadmap.md).
