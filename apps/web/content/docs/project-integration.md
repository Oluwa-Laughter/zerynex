# Integrate Zerynex into your Zcash project

Zerynex is a **local-first toolkit**. The homepage does not connect to a visitor's files, wallet, machine, Zcash node, or GitHub repository automatically. Choose which integration to authorize and install in **your own development environment**.

The [interactive integration guide](/integrate) gives copyable setup commands for each interface.

## Choose one of three distinct paths

| Path | Source of the PCZT | What runs |
| --- | --- | --- |
| [Try a synthetic demo](/#synthetic-demo) | Bundled nonspendable example at `/examples/transparent-v6.bin` | Real Rust/WebAssembly in browser memory |
| [Analyze your own PCZT](/tools) | File **explicitly selected** on your device | The same browser-local Rust/WASM policy engine |
| [Integrate into your project](/integrate) | Files/bytes from your own codebase | Your installed local CLI, SDK, CI job or explicitly configured MCP server |

The bundled fixture intentionally includes a transparent output. Seeing `PCZT-TRANSPARENT-OUTPUTS` only shows that the engine detected it under the shielded-only policy. It **does not** demonstrate a connection to the developer's workspace.

## Rust CLI: install and analyze a file you explicitly select

Requires Rust and Cargo. The standalone CLI can be installed without hosting Zerynex or cloning its website:

```bash
cargo install --git https://github.com/Oluwa-Laughter/zerynex --locked --bin zerynex
zerynex --capabilities
```

Create `zerynex-policy.json` in the local application:

```json
{
  "profile": "external_signer",
  "deny_transparent": true,
  "deny_sapling": false
}
```

Run a policy check on an explicitly selected path:

```bash
zerynex /absolute/path/to/your-local.pczt \
  --policy-file ./zerynex-policy.json --json
```

Exit `0`: implemented rules found no issues. Exit `2`: policy findings. Exit `1`: invalid input or execution error—**not a clean result**. The CLI does not check every cryptographic property, grant spending authority or broadcast transactions.

## TypeScript / WASM: integrate into your frontend

The TypeScript SDK is independently tested as a bundled npm tarball. **It has not been published to the public npm registry.** Obtain a trusted artifact through [releases](releases.md) or build `packages/sdk` from the source checkout.

```typescript
import { createBrowserZerynexClient } from '@zerynex/sdk/browser'

const client = createBrowserZerynexClient()
await client.ready()

// A File provided by an explicit input in YOUR application.
const file = document.querySelector<HTMLInputElement>('#pczt-input')?.files?.[0]
if (!file) throw new Error('Select a local PCZT')

const report = await client.analyzeBlob(file, {
  profile: 'external_signer',
  deny_transparent: true,
})

if (report.findings.length > 0) {
  // Show the rule IDs and component paths to your developer or reviewer.
}
```

Your app must bundle and serve the trusted WASM asset. There is **no hosted PCZT analysis endpoint** and no automatic local file enumeration. Your wallet/app separately handles approval and signing.

## Python SDK: automate on your developer machine

The source package is not currently published to PyPI. From a local checkout:

```bash
git clone https://github.com/Oluwa-Laughter/zerynex.git
cd zerynex
cargo build --locked --release --bin zerynex
python3 -m venv .venv
.venv/bin/python -m pip install ./packages/python
```

```python
from zerynex_py import ZerynexClient, Policy

client = ZerynexClient(cli='/absolute/path/to/zerynex/target/release/zerynex')
report = client.analyze_file(
    '/absolute/path/to/your-local.pczt',
    Policy(deny_transparent=True),
)
print(report.agent_summary())
```

The Python SDK calls the trusted local Rust CLI. It does not read remote wallets, run arbitrary RPC methods or send PCZT bytes to a website.

## CI: repeat checks in your own repository

Use **nonspendable synthetic fixtures only**. Do not commit real PCZTs, signing keys, viewing keys, wallet databases or other confidential transaction material to GitHub.

In the Zcash application's `.github/workflows/zerynex.yml`:

```yaml
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
          fail-on-findings: 'true'
```

Replace both example paths with files in **your own repository**. The `@main` reference is useful during development; for production, **pin the action to a reviewed immutable commit SHA**. The action runs inside the repository's GitHub runner, **not your laptop**. Its pass/fail status covers selected policy rules only.

## MCP: explicit, restricted local agent setup

The hosted demo is **not an MCP server**. A developer must install and configure the separate, read-only stdio MCP server inside a supported local agent host.

```bash
# From the Zerynex source checkout:
cargo build --locked --release --bin zerynex
python3 -m venv .venv
.venv/bin/python -m pip install './packages/python[mcp]'
```

Configure the host to start `/absolute/path/to/zerynex/.venv/bin/zerynex-mcp` with:

```text
ZERYNEX_CLI=/absolute/path/to/zerynex/target/release/zerynex
ZERYNEX_AGENT_ALLOWED_ROOT=/absolute/path/to/zerynex/apps/web/public/examples
```

The allowed directory is a **synthetic-fixture root**, not an entire home directory or wallet folder. Follow the [MCP and agent setup guide](agents.md) to run `zerynex-mcp-doctor` and test actual host connectivity. Agents cannot request unrestricted private PCZT files or authorize payments through these tools.

## Privacy and capability boundaries

- Browser demos use deliberately nonspendable **bundled example data**.
- Browser analysis requires an explicit `File` selection; it does not access the rest of the developer's machine.
- CLI/SDK installations are local and operate on **explicit** application-controlled inputs.
- Public CI and agent fixtures must be nonspendable and contain no secrets.
- Passing a rule check does **not** prove privacy, proof validity, safe signing, transaction equivalence or Zcash consensus correctness.

Continue with the [privacy policy schema](policy-format.md), [CLI reference](cli-reference.md), [TypeScript SDK](typescript-api.md), [GitHub Action](github-action.md), and [privacy/trust model](privacy-model.md).

## Bootstrap and verify your Zcash project

The independently tested Python wheel includes `zerynex-project`, an **offline, non-destructive** setup command. Obtain and verify the wheel and a trusted separately installed Rust CLI from [release artifacts](releases.md). Public PyPI publication is not complete.

```bash
# Run from the environment where you installed the verified Python wheel:
zerynex-project init --project /absolute/path/to/my-zcash-app --ci --json
zerynex-project verify --project /absolute/path/to/my-zcash-app \
  --cli /absolute/path/to/zerynex --json
```

`init` writes `.zerynex/project.json`, `.zerynex/policy.json` and two **bundled, nonspendable synthetic PCZT fixtures**. With `--ci`, it also creates `.github/workflows/zerynex-privacy.yml`, pinned to a reviewed immutable Zerynex commit and checking only the clean synthetic fixture. Existing files and symlink destinations are rejected rather than overwritten.

`verify` checks fixture integrity, discovers local Rust CLI capabilities, and executes two **real** Rust policy scans: a clean example with zero findings and an intentionally transparent example reporting `PCZT-TRANSPARENT-OUTPUTS`. The sanitized result never contains original PCZT bytes, wallet data or project paths.

This does **not** connect to any real wallet, node, private PCZT or agent host. A passing check verifies the local toolchain against reviewed synthetic vectors, not wallet safety, valid payments or complete privacy. Review the generated CI workflow before enabling it; never add real intermediate transactions or keys to public CI.
