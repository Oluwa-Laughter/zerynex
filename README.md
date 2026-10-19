# Zerynex

**Local-first Zcash developer tooling for privacy policies, PCZT testing, node readiness, RPC compatibility, SDK integration, and CI.**

Zerynex is a local-first, composable toolkit for developers building on Zcash: inspect Partially Created Zcash Transaction (PCZT) disclosures, compare privacy policies across transaction stages, validate synthetic wallet role handoffs, and integrate reproducible checks into application CI. Rust, TypeScript, Python, Go and MCP are interfaces into that foundation—not the limits of the product. Originally created for Zecathon 2026's **Core & Tooling** track.

**Try it without installing anything:** https://zerynex.vercel.app/tools


**Problem:** ZIP-374 intermediary PCZT files may carry sensitive metadata that never appears in a final shielded transaction. Zerynex helps developers establish explicit policies at those handoff boundaries.

**Executable rule conformance:** The same 18 policy fixtures/scenarios and seven stage regressions run through the Rust CLI, Python SDK and independently packed TypeScript/WASM SDK. See [rule vectors](docs/rule-registry.md#executable-rule-conformance-vectors).

**Read-only transaction observations:** Zcash confirmation consistency and possible chain reorganizations for trusted backend RPC results, with no txids or block hashes in returned SDK reports. See [Transaction observations](docs/transaction-observations.md). This is not payment settlement verification.

**Three ways to start:** [Try the bundled synthetic demo](https://zerynex.vercel.app/#synthetic-demo), [analyze a PCZT in your browser](https://zerynex.vercel.app/tools), or [integrate into your local project](https://zerynex.vercel.app/integrate). The homepage does not connect to developers' machines. See [Project integration](docs/project-integration.md).\n\n**ZIP-321 payment tooling:** Validate Zcash payment requests offline with real address checksums/network validation, integer zatoshi amounts, redacted Rust/WASM reports and a packaged native CLI. Try [the payment workbench](https://zerynex.vercel.app/tools/payment) and read the [ZIP-321 integration guide](docs/payment-requests.md). This does not authorize or execute payments.

**Zcash node integration:** Read-only, loopback-only `zerynex-node-check` checks chain/network readiness; a pure TypeScript normalizer works in browser/backend projects without exposing RPC credentials. See [Node readiness](docs/node-readiness.md) and [Zcash builder recipes](docs/zcash-app-recipes.md).

**Rule registry:** `zerynex --rule-catalog` returns the public, versioned PCZT finding definitions used across SDKs, SARIF and MCP. See [rule metadata](docs/rule-registry.md).

**SARIF security reports:** `zerynex synthetic.pczt --deny-transparent --sarif` emits redacted SARIF 2.1.0 for local review and optional CI artifacts; see [SARIF integration](docs/sarif.md).

**CLI capabilities:** `zerynex --capabilities` prints a versioned, offline JSON contract for SDK and CI consumers; see [capability discovery](docs/cli-capabilities.md).

## Developer workflows

- **PCZT policy inspection**: local browser/Rust checks for supported disclosure rules and selected pool-component policies.
- **Transaction-stage regression tests**: compare two local PCZT snapshots and report newly introduced findings.
- **Wallet signer/handoff scenarios**: verify deterministic synthetic Creator, Updater, Combiner and Redactor checkpoints.
- **CI and SDK integration**: reuse the canonical Rust engine with CLI, WebAssembly and language adapters.
- **Infrastructure diagnostics**: read-only loopback `getblockchaininfo` node readiness and offline RPC contract checks. Real signing, consensus verification and indexer adapters remain outside the supported scope.
- **Agent tooling**: explicitly authorized, read-only MCP operations for approved synthetic fixtures, not private wallet contents.

## Architecture

- **Rust library** (`src/lib.rs`): real PCZT parsing via the Zcash `pczt` crate, policy checks on global proprietary metadata and selected Orchard/Ironwood fields.
- **CLI** (`src/main.rs`): local binary input, text/JSON report, 0 pass / 1 input error / 2 policy findings.
- **Browser engine**: the *same* Rust core compiled to WebAssembly; no hosted file upload or analysis API.
- **Developer Tools** (`apps/web`): Next.js 16 App Router, React 19, TypeScript, Tailwind 4, GSAP, responsive PCZT workbenches and a local-only node-readiness report workbench (`/tools/node`).
- **Node adapters** (`packages/python/src/zerynex_py/node.py` and `packages/sdk/src/network.ts`): read-only local RPC checks and pure cross-platform chain-state normalization, validated against shared fixtures.
- **Fixtures** (`examples/generate_fixtures.rs`): synthetic non-spendable v6 PCZT files: clean, metadata-flagged, and transparent-output.

## Development

Requires Rust stable, Node.js >=22 and any of npm, Yarn, or pnpm. The commands below use pnpm because CI uses frozen pnpm lockfiles.

```bash
cargo test --locked --all-targets
cargo run -- path/to/transaction.pczt --profile external-signer --json
cargo install wasm-bindgen-cli --version 0.2.129 --locked
bash scripts/build-wasm.sh
cd packages/sdk
pnpm install --frozen-lockfile
pnpm build
cd ../../apps/web
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:3000, open **Developer Tools**, load a genuine local binary PCZT or one of the three **synthetic examples**, select a profile, and run **real Rust WebAssembly analysis** without transferring your PCZT to any backend.

The prebuilt browser WASM is included under `apps/web/public/wasm`. The build script reproducibly regenerates it. GitHub Actions builds Rust + WASM + web.

## Current policies

- `external-signer`: flags dummy spending keys and unreviewed proprietary metadata.
- `restricted-handoff`: additionally flags selected output recipient/value/seed/address fields. This may reject legitimate signer workflows.

Reports contain rule IDs and field paths, **not private field values**.

## Security notice

**Early research software, not audited.** Passing implemented checks does **not** imply anonymity, complete private-data handling, consensus validity, safe signing, or a production security audit. Sapling and transparent checks remain partial, and network side channels are outside v0.1 scope. No wallet keys belong in committed fixtures.

Full threat-model summary: [docs/privacy-model.md](docs/privacy-model.md).

## Integrate into your own Zcash app

Start with the [copyable consumer CI workflow](examples/consumer-integration/README.md) and [ecosystem integration roadmap](docs/ecosystem-integration-roadmap.md). Zerynex currently checks selected PCZT disclosure policies; upstream wallet, node and indexer compatibility requires version-pinned integration tests. Package registries are not yet published.

## Next milestones

Expanded role-specific policies, real signer/prover compatibility fixtures, comprehensive pool checks, CI regression examples, upstream integration, privacy review.

## References

[ZIP-374](https://zips.z.cash/zip-0374) · [librustzcash](https://github.com/zcash/librustzcash) · [pczt documentation](https://docs.rs/pczt/).

MIT licensed. Open source.


## Next.js frontend

The web application uses Next.js 16 App Router and React 19. The homepage is / and the local PCZT inspector lives at /tools (legacy /studio links redirect there). Typography is bundled locally, with GSAP transitions and React Icons (Lucide collection) SVG components (no emoji graphics).

The browser loads a Rust/WebAssembly engine from local static assets. The wasm-bindgen JavaScript wrapper lives under apps/web/src/wasm, and its binary is served from apps/web/public/wasm. The engine runs entirely in the browser: private PCZT bytes are not sent to the Next.js server.

Use Vercel with project root apps/web. Set NEXT_PUBLIC_SITE_URL to the canonical public site URL for OpenGraph metadata, if the host does not provide VERCEL_URL.

## Frontend quality checks

After installation and WASM generation:

    cd apps/web
    pnpm build
    pnpm lint
    pnpm typecheck
    pnpm exec playwright install chromium
    pnpm test:e2e

GitHub CI also runs the Rust formatting, Clippy, tests, and WASM compatibility checks. Playwright covers real clean/flagged PCZT analysis on desktop and mobile.

**Security note:** This early research toolkit is not audited, and its limited policy checks are not a guarantee of privacy or consensus validity.

## Policy-as-code

Local JSON policies specify signer profile and permitted shielded pools.
See [policy reference](docs/policy-format.md) and [policy examples](policies/).
The CLI supports --policy-file, --deny-transparent, and --deny-sapling
alongside the built-in profiles. A findings-free report never guarantees
privacy, signing safety, or consensus validity.

Zerynex ships three non-spendable synthetic PCZT v6 examples:
clean, global-metadata-flagged, and transparent-output. The last one demonstrates
why a shielded-only policy is meaningful, with no spendable funds or private keys.

## Reusable TypeScript SDK

The independent @zerynex/sdk package in packages/sdk provides a typed API,
strict policy normalization, lazy local WASM loading, Blob and Uint8Array
analysis, and sanitized error messages. The Next.js PCZT Inspector now consumes
this SDK rather than calling WebAssembly directly.

The SDK is not yet published to the npm registry. The web app links it
locally through a standard file dependency. We test npm and Yarn installation
separately from our pnpm-based reference CI build.

See docs/package-managers.md for installation and development instructions.

## Importable policy configuration

The PCZT Inspector can import/export repository-local JSON policy files with
strict validation performed by @zerynex/sdk. A malformed policy does not
alter the selected disclosure safeguards. Imported data is read on-device,
and exported policies can be used directly with the Rust --policy-file CLI.

## Python and AI-agent integrations

The new Python adapter in packages/python invokes the trusted local Rust CLI
without reimplementing Zcash cryptography. It provides typed Policy, Report,
Finding, and ZerynexClient interfaces and sanitized policy findings.

Agent developers can install the portable skill at
agent/skills/zcash-privacy-check/SKILL.md and use the read-only local
MCP server from the optional Python integration. Details are in
docs/agents.md. The server only scans approved synthetic fixtures; it
does not load arbitrary files or transmit PCZT data to hosted models.

## Ecosystem Atlas and Z3 onboarding

The /ecosystem route provides an interactive developer onboarding atlas with
Rust, TypeScript, Python, MCP / Agent Skills and Z3 node operator quickstarts.
The Z3 topology diagram is based on upstream documentation and is NOT live
node telemetry.

The Python SDK includes zerynex-z3-check: a read-only loopback-only
Zebra /healthy and /ready diagnostic. No wallet RPC credentials are used.
See docs/z3-local.md.

## Core and Tooling integration contracts

Zerynex is a Rust-first developer-tooling library with a standalone CLI,
TypeScript/WASM and Python SDKs, CI checks and an opt-in agent interface.
The website is optional: /tools supports PCZT inspection and integration
quickstarts; /ecosystem offers onboarding; previous /studio and /console
deep links redirect to /tools. Applications integrate through stable core
interfaces rather than depending on the website.

See [integration contracts](docs/integration-contracts.md) for current support,
honest gaps in Zallet, Zaino, and prover integrations, and release gates.
See [report JSON Schema](docs/report.schema.json) for interoperable results.


## Install and adopt Zerynex (no hosted account)

- **Rust**: install CLI directly using Cargo from this GitHub repository.
- **Zallet/PCZT workflows**: pass local binary or base64 PCZTs to the CLI,
  including through stdin without an intermediary conversion service.
- **Python**: install the source adapter locally; it supports in-memory
  base64-to-Rust analysis as well as private local files.
- **TypeScript**: use the repo-local SDK with trusted bundled Rust/WASM.
  Public npm publishing is not complete yet.
- **GitHub Actions**: use this repository as a **composite action** in other
  repos, with only synthetic fixtures; no application SDK installation.

See [adoption guide](docs/github-action.md) and
[Zallet PCZT handoffs](docs/zallet-pczt-handoff.md). Zerynex does not call
Zallet RPC directly or complete wallet signing/proving. Testnet/regtest
end-to-end compatibility is a separate pending milestone.

## Ecosystem research and stage-to-stage PCZT privacy testing

Our [Zcash ecosystem research](docs/ecosystem-research-2026-10.md)
maps concrete official gaps to possible new Zerynex capabilities,
without asserting originality that hasn't been independently verified.

[PCZT Stage Regression](docs/pczt-stage-regression.md) is now supported
by the Rust library/CLI, Python adapter and reusable GitHub Action.
It compares locally held PCZTs to flag newly present sensitive policy
fields and changed pool component counts. It does NOT prove two
transactions are cryptographically equivalent.

## Offline PCZT role-handoff scenario tests

Zerynex now includes a separate Rust executable that runs deterministic
synthetic role-handoff policy scenarios. It exercises official PCZT
Creator, Updater, Combiner and Redactor operations, without a live Zcash
node, wallet, prover or signer.

    cargo run --locked --example generate_role_handoff -- --check
    cargo run --locked --bin zerynex-handoff -- \
      --manifest tests/fixtures/role-handoff/scenario.json --json

The reusable GitHub Action also accepts scenario-manifest to run several
synthetic disclosure regression checks in one job. Read the
[role-handoff guide](docs/handoff-harness.md) for installation, the
strict manifest format, and limitations.

## Developer documentation on the frontend

The Next.js website now includes a built-in documentation center at /docs,
with searchable guides, status labels, language/role onboarding and
individually prerendered Markdown articles. Canonical source files live
only in docs/ and are mirrored into apps/web/content/docs by
scripts/sync-docs.mjs during web development and production builds.

Each documented integration in Developer Tools links to its own in-site
guide. New adapters must include source documentation, catalog registration,
fixture tests and CI verification. See docs/installation.md, docs/go-sdk.md,
docs/rpc-contracts.md and docs/zk-prover-handoffs.md.

The offline RPC compatibility tool checks approved OpenRPC method and
parameter declarations only. It does NOT connect to Zallet, test method
semantics, sign transactions or validate consensus.

The Go source SDK delegates to the existing canonical Rust CLI; there
is no independently implemented Zcash cryptography or hosted API.

## In-browser developer workbenches

The frontend now runs multiple practical PCZT tools with the canonical
Rust engine compiled to WebAssembly, entirely on the developer's device:

- /tools: inspect one local binary PCZT using configurable privacy rules.
- /tools/stages: compare two local binary PCZTs, try three synthetic
  scenarios, inspect sanitized findings and export a JSON report.
- /tools/handoff: replay four upstream role-generated synthetic PCZT
  snapshots against the Rust stage engine, verify expected disclosures,
  expand each test and export a safe JSON report.
- /docs: canonical guides with direct links to running browser tools.

Full nodes, Zallet RPC signing, proof generation, and Zaino connectivity
are not simulated as supported. Those need separate upstream tests.

For public Next.js deployment and verification, see docs/deployment.md.

## Phase II product and SDK onboarding

The functional product UX includes language-only SDK tabs, a separate
restricted-agent experience, a geometric logo/favicons, GSAP narrative
animations, Motion interactive transitions, and persistent Light, Dark
and System themes. See docs/product-experience.md.

For no-install browser use and lightweight adapter distribution, see
docs/sdk-distribution.md. Unpublished SDKs are identified explicitly.

## Distribution and installation

Zerynex now builds independently validated OS-native Rust CLI archives,
a Python wheel with local MCP tools, and a TypeScript npm tarball that
contains its **matching Rust/WASM runtime**. See
[release artifacts](docs/releases.md). The distribution workflow
supports manual artifact builds and releases from explicit version tags.
These artifacts are not yet published on the npm/PyPI/crates.io registries.

Responsive layout and mobile navigation guidelines: docs/responsive-design.md. Run the frontend audit with pnpm audit:responsive.
