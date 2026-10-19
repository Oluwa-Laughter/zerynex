# Download Zerynex without cloning the repository

Zerynex is a Rust-first developer-tool platform with a small WebAssembly SDK
and local MCP integrations. **No download is required to try the publicly
hosted PCZT workbenches** at [/tools](/tools).

## Tested distribution formats

| Package | Included | Runtime requirements |
| --- | --- | --- |
| CLI archive (.tar.gz or .zip) | Compiled `zerynex` analyzer, `zerynex-handoff`, and `zerynex-payreq` payment-request validator, MIT license, policies and docs | Compatible OS/architecture; no Rust compiler or Next.js |
| TypeScript SDK (.tgz) | Typed SDK APIs **and** the matching Rust WebAssembly binary | Modern Node for server tests; compatible bundler for browsers |
| Python SDK (.whl and .tar.gz) | Python API, offline `zerynex-project` scaffolder, MCP server/doctor, Z3 loopback diagnostic | Python 3.11+ plus the separately installed trusted Rust CLI |
| Go SDK | Go adapter using a trusted local Rust CLI | Go 1.23+ and an installed CLI; public tagged module pending |

These are independently consumer-tested **build formats**, not claims that
npm, PyPI or crates.io publication is finished.

**Release status:** The last public GitHub Release is `v0.1.0`. The source
now prepares **v0.2.0**, which is not yet tagged or published. Commands
using `0.2.0` below apply **only after building these artifacts from source
or creating a reviewed `v0.2.0` release**. Do not download `v0.1.0` and
assume it includes newer refund-privacy, Node CLI or integration fixes.

For package maintainers, see the [registry publishing checklist](publishing.md).
Versioned GitHub Releases created after the new publisher hardening include
`SHA256SUMS-registry.txt`, covering the bundled npm tarball, Python wheel
and Python source archive. The separately gated, **manual-only** registry
workflow checks those digests before publishing either SDK. npm and PyPI
registry accounts, permissions and protected-environment approvals remain
maintainer responsibilities; no registry uploads happen automatically.
Registry publication requires explicitly approved release artifacts, npm/PyPI
account ownership and verified GitHub Actions environments.

## GitHub distribution workflow

The [distribution workflow](https://github.com/Oluwa-Laughter/zerynex/actions/workflows/distributions.yml)
runs automatically when release-related source files change on main, or
manually by maintainers, to produce download artifacts retained by GitHub
Actions for a limited time. It builds Linux, macOS and Windows
CLI executables as well as TypeScript and Python packages.

A reviewed version tag deliberately pushed by a maintainer triggers the
same tested build and creates a GitHub Release with the artifacts. That
does **not** automatically publish anything to npm, PyPI or crates.io.
Do not mistake a checksum for a cryptographic signature.

## Download the compiled Rust CLI

Download your OS-specific archive and its adjacent SHA256SUMS file.
Verify the checksum, extract the compiled analyzer executable, then run
it against your own local synthetic fixture:

    zerynex path/to/approved-synthetic.pczt --deny-transparent --json

No monorepo checkout or Rust toolchain is needed to execute the binary.
Never upload real confidential PCZTs, wallet keys, mnemonics or private
transaction details to GitHub Actions or public sample fixtures.

## TypeScript: SDK with bundled Rust/WASM

The npm tarball carries the **same compiled Rust/WASM engine** as the
hosted workbenches. Developers do not have to compile Rust. Install a
downloaded tarball with a supported package manager:

    npm install ./zerynex-sdk-0.2.0.tgz
    yarn add ./zerynex-sdk-0.2.0.tgz
    pnpm add ./zerynex-sdk-0.2.0.tgz

The runtime entry point is `@zerynex/sdk/browser`. It exports
`createBrowserZerynexClient`, which initializes the packaged WASM.
The separate `@zerynex/sdk/wasm/zerynex_bg.wasm` export supports
application-specific asset loading when required.

~~~ts
import { createBrowserZerynexClient } from '@zerynex/sdk/browser'

// Supply the trusted packaged wasm bytes through your asset pipeline,
// if your bundler cannot automatically resolve the adjacent WASM asset.
const client = createBrowserZerynexClient({ wasm: trustedWasmBytes })
const report = await client.analyzeBlob(file, { deny_transparent: true })
console.log(report.findings)
~~~

When a bundler correctly serves the adjacent WASM asset,
`createBrowserZerynexClient()` can initialize it without a
custom loader. Framework compatibility must be tested individually.
Both forms execute policy checks locally.

To test the actual tarball from an unrelated temporary application:

    cd packages/sdk
    npm run build
    cd ../..
    node scripts/test-sdk-packed.mjs

This uses npm install offline against a local packed artifact and verifies
real Rust/WASM scanning and stage comparison, not a fake engine.

## Python wheel with locally installed CLI

Download the Python wheel and matching OS-native CLI archive.
After installing the verified CLI:

    python -m pip install ./zerynex_python-0.2.0-py3-none-any.whl

The MCP integration uses an optional dependency:

    python -m pip install './zerynex_python-0.2.0-py3-none-any.whl[mcp]'

Set ZERYNEX_CLI to the installed Rust executable. Configure a dedicated
approved synthetic fixture directory through ZERYNEX_AGENT_ALLOWED_ROOT,
then follow [MCP and agent setup](agents.md) for the doctor command.

The Python wheel delegates to the Rust CLI locally; it does not include
a separate cryptographic engine or require Next.js.

## Trust boundaries

- Download release artifacts from the intended organization and verify
  the published SHA-256 digests.
- Pin immutable reviewed commit SHAs for CI integration.
- Local policy lint results do not establish a formal audit, transaction
  correctness, Zcash consensus validity or anonymity.
- Registry publication, signed releases and organizational GitHub
  ownership remain explicit future release-hardening milestones.
