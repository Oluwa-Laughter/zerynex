# Zerynex Core & Tooling: engineering contracts

Zerynex is privacy-testing infrastructure for Zcash developers. The web
interface is optional onboarding and an executable PCZT inspector, not the
foundation of the product. The authoritative parsing and policy logic live
inside the Rust library built on the official pczt crate.

## Supported now

| Surface | Verified implementation | Consumer |
| --- | --- | --- |
| Rust library | Parses real binary PCZTs and evaluates selected policies | Wallet SDKs, protocol tooling |
| Rust CLI | Input from local binary files, strict JSON policy, JSON findings, process exit codes | CI, shell, security regression tests |
| WASM | Same Rust engine in the browser, no hosted transaction processing | Web and wallet frontends |
| TypeScript | Typed client, local file analysis, policy import/export | TypeScript apps and SDKs |
| Python | Local adapter to trusted Rust CLI | Python tests and automation |
| MCP / Agent Skill | Read-only synthetic fixture tools, safe policy findings | IDE agents and automation |
| Z3 / Zebra | Local /healthy and /ready checks | Node operator preflight |
| Next.js | /tools PCZT inspection plus integration examples; /ecosystem onboarding | Optional developer frontend |

The CLI report JSON fields are profile, deny_transparent, deny_sapling,
checked_pools, findings (rule, field, explanation), and disclaimer.

Exit status 0: valid PCZT with no implemented-policy findings.
Exit status 2: valid PCZT with one or more findings.
Exit status 1: CLI input, policy, or execution failure.

Public CI uses synthetic, nonspendable PCZTs and no wallet secrets.

## Priority integration work and acceptance gates

### Zallet wallet and PCZT workflow — next milestone

Implement verified transaction-stage privacy checks from official Zallet
PCZT examples, or a disposable regtest/testnet wallet without actual funds.
Each creator/prover/signer handoff must have documented allowed fields,
negative and positive synthetic test vectors and tested PCZT compatibility.
Never log a private PCZT or create spendable test fixtures for CI.

Status: not implemented. Generic PCZT parsing does not prove compatibility
with every Zallet RPC stage.

### Zebra / Z3

The Python local-health checker reads Zebra's documented loopback liveness
and readiness HTTP routes, with mock-server tests. It does not verify
consensus or Zallet operation. Live Z3 stack integration is a future task.

### Zaino and indexer SDKs

Plan a restricted read-only indexer adapter, with a developer-controlled
local endpoint, upstream service/version contract, fixture chain and
separate indexing-lag outcomes. No Zaino gRPC adapter exists yet.

### Provers / ZK engineers

Plan prover handoff checks and test-vector compatibility tied to upstream
Zcash prover APIs. The current engine neither generates nor verifies ZK
proofs and does not audit circuit correctness.

### Native Python, Go, Java

Native PyO3/maturin bindings can reduce the current Python CLI dependency.
Additional language SDKs need demonstrated use cases and tests.
They must call the same Rust rules, not duplicate protocol logic.

## Contributor checklist

Before a new integration is called supported, require:

1. Documented upstream protocol or service version and invocation.
2. Reproducible positive/negative synthetic integration tests.
3. Machine-readable, value-free results and sanitized errors.
4. No unapproved network connection, key custody, real user PCZT uploads or logging.
5. CI verification for the consumer interface, not only unit mocks.
6. Honest feature limitations in documentation.

The /studio and /console paths redirect to /tools to preserve older links.
That naming is a website detail; applications should depend on the Rust,
CLI or SDK contracts, not a website route.
