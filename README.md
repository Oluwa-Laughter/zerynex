<p align="center">
  <img src="apps/web/public/favicon.svg" alt="Zerynex logo" width="84" height="84">
</p>

<h1 align="center">Zerynex</h1>

<p align="center"><strong>Local-first Zcash privacy checks for PCZT workflows, developer tools, SDKs, and CI.</strong></p>
<p align="center">
  <a href="https://zerynex.vercel.app/">Website</a> ·
  <a href="https://zerynex.vercel.app/tools">PCZT Inspector</a> ·
  <a href="https://zerynex.vercel.app/docs">Documentation</a> ·
  <a href="https://github.com/Oluwa-Laughter/zerynex/releases/tag/v0.2.0">Downloads</a> ·
  <a href="https://github.com/Oluwa-Laughter/zerynex/actions">Build status</a>
</p>

Zerynex lets Zcash developers **inspect selected disclosures in Partially Constructed Zcash Transactions (PCZTs)** and **compare transaction stages for newly introduced policy findings**. One canonical Rust engine powers the native CLI and browser-local WebAssembly. TypeScript, Python, and Go integrations reuse that engine rather than independently reimplementing PCZT parsing.

**No hosted analyzer, login, wallet connection, or remote transaction upload is required.** The browser tools process explicitly selected files on-device. The tool is a *policy and regression linter*, not a proof verifier, signer, wallet, consensus validator, or anonymity guarantee.

## Start here

| Goal | Use this |
| --- | --- |
| Try without installing | [PCZT Inspector](https://zerynex.vercel.app/tools) · [Stage regression](https://zerynex.vercel.app/tools/stages) |
| Learn with nonspendable fixtures | [Quickstart](docs/quickstart.md) · [Live documentation](https://zerynex.vercel.app/docs) |
| Install the native engine | [v0.2.0 Linux/macOS/Windows builds](https://github.com/Oluwa-Laughter/zerynex/releases/tag/v0.2.0) · [CLI reference](docs/cli-reference.md) |
| Build a Zcash application | [Integration guide](https://zerynex.vercel.app/integrate) · [Developer SDKs](https://zerynex.vercel.app/ecosystem) |
| Automate a safe synthetic check | [GitHub Action guide](docs/github-action.md) · [Consumer example](examples/consumer-integration/README.md) |

## Install and run

### Rust CLI — canonical parser and policy engine

Use a reviewed `v0.2.0` binary from [GitHub Releases](https://github.com/Oluwa-Laughter/zerynex/releases/tag/v0.2.0), or compile the pinned release using Cargo:

```bash
cargo install --git https://github.com/Oluwa-Laughter/zerynex --tag v0.2.0 --locked --bin zerynex
zerynex --capabilities
zerynex /path/to/local-synthetic.pczt --deny-transparent --json
```

From a source checkout, reproduce the two canonical examples:

```bash
cargo run --locked -- apps/web/public/examples/clean-v6.bin --deny-transparent --json
cargo run --locked -- apps/web/public/examples/transparent-v6.bin --deny-transparent --json
```

The clean example exits **0** with no findings; the transparent example exits **2** with `PCZT-TRANSPARENT-OUTPUTS`. Exit **1** means an input/engine error and **must not** be treated as a passing check. Files can also be read from stdin and compared with `--compare-with`. See [CLI reference](docs/cli-reference.md) and [policy JSON](docs/policy-format.md).

### TypeScript / browser — npm + bundled Rust/WASM

```bash
npm install @zerynex/sdk@0.2.0
```

```ts
import { createBrowserZerynexClient } from '@zerynex/sdk/browser'

const client = createBrowserZerynexClient()
await client.ready() // Your bundler must serve the adjacent trusted .wasm asset

// A File selected by the user in YOUR application.
const report = await client.analyzeBlob(file, { deny_transparent: true })
console.log(report.findings.map(({ rule, field }) => ({ rule, field })))
```

For bundlers that do not resolve adjacent WASM automatically, pass a trusted WASM source to `createBrowserZerynexClient({ wasm })`. No application keys or PCZT data should go to public CI. See [TypeScript/browser API](docs/typescript-api.md), [npm package](https://www.npmjs.com/package/@zerynex/sdk), and [SDK development guide](packages/sdk/README.md).

### Python — PyPI + local Rust CLI

```bash
python3 -m pip install zerynex-python==0.2.0
```

```python
from zerynex_py import Policy, ZerynexClient

client = ZerynexClient(cli="/absolute/path/to/zerynex")
report = client.analyze_file("/path/to/local-synthetic.pczt", Policy(deny_transparent=True))
print(report.agent_summary())
```

Python **delegates PCZT analysis to an installed, trusted Rust `zerynex` executable**; installing the wheel alone does not install the Rust binary. The wheel also provides restricted MCP tooling, project bootstrap, offline RPC checks, and refund metadata auditing. See [Python API](docs/python-api.md), [PyPI package](https://pypi.org/project/zerynex-python/0.2.0/), and [Python package guide](packages/python/README.md).

### Go — CLI-backed source adapter

The [public Go module](https://pkg.go.dev/github.com/Oluwa-Laughter/zerynex/packages/go) is versioned `v0.2.0` and delegates analysis to the separately installed Rust CLI. From your Go application's module, run:

```bash
go get github.com/Oluwa-Laughter/zerynex/packages/go@v0.2.0
```

See [Go SDK guide](docs/go-sdk.md) for `AnalyzeFile`, `AnalyzeBase64` and `CompareFiles`; no live Zcash node or hosted Zerynex API is required.

### GitHub Actions — reproducible synthetic checks

Use the [composite Action](action.yml) on a **nonspendable synthetic fixture** in your repository. Pin it to a reviewed full Git commit SHA, not a moving `main` reference. Copy the [consumer workflow](examples/consumer-integration/.github/workflows/privacy-check.yml) or follow the [GitHub Action guide](docs/github-action.md). Never submit a real wallet PCZT, key, or intermediate transaction to public CI.

## What the toolkit does

| Tool | Supported operation | Boundary |
| --- | --- | --- |
| [PCZT inspector](https://zerynex.vercel.app/tools) | Inspect an explicit binary PCZT with selected disclosure policies | Not a signature, proof, or consensus check |
| [Stage regression](https://zerynex.vercel.app/tools/stages) | Compare two PCZT stages for newly introduced structural findings | Does not prove transaction equivalence |
| [PCZT role harness](docs/handoff-harness.md) | Replay synthetic Creator/Updater/Combiner/Redactor scenarios | Not a live signer/prover test |
| [ZIP-321](docs/payment-requests.md) | Locally validate payment request format and network | No payment execution or wallet custody |
| [Wallet handoff](docs/wallet-handoffs.md) | Explicit consent and validated provider-facing request contracts | No automatic signing or settlement |
| [Refund privacy](docs/refund-privacy-audit.md) | Audit non-secret declared metadata for linkability regressions | Does not inspect real viewing keys |
| [Node readiness](docs/node-readiness.md) / [lightwalletd](docs/node-readiness.md) | Read-only diagnostics and normalized trusted RPC observations | Not a live indexed wallet service |
| [Transaction observations](docs/transaction-observations.md) | Detect inconsistent confirmation reports and possible reorg hints | Not a payment receipt guarantee |
| [OpenRPC contracts](docs/rpc-contracts.md) | Offline compatibility checks against approved schemas | Not live Zallet RPC verification |
| [MCP and agents](docs/agents.md) | Explicitly configured, read-only synthetic-fixture tools | No arbitrary wallet-file access |

## Documentation by developer task

- **Build an integration:** [Install](docs/installation.md) · [Project integration](docs/project-integration.md) · [Rust library](docs/rust-api.md) · [TypeScript](docs/typescript-api.md) · [Python](docs/python-api.md) · [Go](docs/go-sdk.md).
- **Understand results:** [Privacy policies](docs/policy-format.md) · [Rule registry](docs/rule-registry.md) · [Reports and errors](docs/report-reference.md) · [SARIF](docs/sarif.md) · [Stage regression](docs/pczt-stage-regression.md).
- **Zcash ecosystem:** [Zallet handoffs](docs/zallet-pczt-handoff.md) · [ZK/prover boundaries](docs/zk-prover-handoffs.md) · [Application recipes](docs/zcash-app-recipes.md) · [Capability discovery](docs/cli-capabilities.md).
- **Download and trust:** [Release artifacts](docs/releases.md) · [External consumer verification](docs/developer-verification.md) · [Privacy model](docs/privacy-model.md) · [MIT license](LICENSE).

## Architecture and development

```text
Browser / Node              Python / Go / CI
   |                           |
   v                           v
@zerynex/sdk + Rust WASM     zerynex native CLI
   |                           |
   +------ canonical Rust PCZT/policy engine -----+
```

The browser runs local Rust/WASM; Python and Go execute the same Rust CLI on your machine. Infrastructure helpers that normalize supplied RPC data do not themselves fetch private node data.

```bash
git clone https://github.com/Oluwa-Laughter/zerynex.git
cd zerynex
cargo fmt --all -- --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked --all-targets
bash scripts/build-wasm.sh
cd packages/sdk && pnpm install --frozen-lockfile && pnpm build && pnpm test
cd ../../apps/web && pnpm install --frozen-lockfile && pnpm dev
```

For the complete browser check, run `pnpm test:e2e` from `apps/web` after installing Playwright Chromium. Building WASM requires the `wasm32-unknown-unknown` Rust target and `wasm-bindgen-cli 0.2.129`. See [developer documentation workflow](docs/documentation-workflow.md), [product integration contracts](docs/integration-contracts.md), [changelog](CHANGELOG.md), and [CI](https://github.com/Oluwa-Laughter/zerynex/actions).

## Verify the actual public SDK distributions

For a network-enabled acceptance test of the **published npm, PyPI and Go
packages** (rather than only the monorepo build), run from this checkout:

```bash
node scripts/smoke-published.mjs 0.2.0
```

The script runs only against reviewed nonspendable synthetic fixtures in
temporary directories. It checks the npm CLI, Rust/WASM browser SDK and
Python installation, queries the Go module proxy, and tests Python → Rust
when an installed native binary is available. See
[external developer verification](docs/developer-verification.md) for
requirements, skip conditions and security boundaries.

## Verify the deployed developer experience

After deploying, run the **real public-site browser acceptance check** from
the checked-out repository. It uses only the site's nonspendable synthetic
fixtures, inspects the working Rust/WASM findings and stage regression,
checks public install instructions, and tests mobile layout. No wallet
connection or private PCZT upload is needed.

```bash
cd apps/web
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm verify:live
# Optional: save ten synthetic-only desktop/mobile screenshots outside the repo
pnpm verify:live --capture-dir /tmp/zerynex-demo-capture
```

The verification checks the public Zerynex HTTPS site and fails on uncaught
browser exceptions, incorrect findings, unavailable guides, or horizontal
overflow. This is a product acceptance smoke, **not** a security audit
or proof of compatibility with every browser or wallet. See
[developer verification](docs/developer-verification.md) for other release checks.

## Security and limits

Zerynex is **experimental, unaudited developer tooling**. A passing report means only that the configured, implemented *disclosure-policy rules* found no issues. It is **not evidence of anonymity, cryptographic proof validity, safe signing, complete consensus validation, transaction equivalence, or wallet compatibility**. Do not put wallet secrets, real transaction intermediates, viewing keys, or addresses into public GitHub issues, hosted AI conversations, or CI test artifacts.

Zerynex is [MIT licensed](LICENSE). Contributions should follow [CONTRIBUTING.md](CONTRIBUTING.md); confidential vulnerability reports belong through the channels described in [SECURITY.md](SECURITY.md).
