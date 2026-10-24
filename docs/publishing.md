# Publishing Zerynex SDKs to registries

**Maintainer-controlled release only. No package is automatically uploaded
when commits reach `main`.** Zerynex is distributed as native Rust CLI
archives, a bundled Rust/WASM TypeScript SDK, a Python wheel, a Go source
module, and a GitHub Action. The first priority is making the existing
SDK artifacts straightforward to install through npm and PyPI, without
introducing public transaction data collection.

## What is currently released?

- The **last public GitHub Release is [v0.1.0](https://github.com/Oluwa-Laughter/zerynex/releases/tag/v0.1.0)**. It contains earlier platform archives and SDK packages.
- Repository source now prepares **v0.2.0**, which includes later developer tooling and is **not yet a tagged/public release**. Do not label `v0.1.0` artifacts as `v0.2.0` or expect the latest CLI/API additions in older downloads.
- **`@zerynex/sdk`**: TypeScript/JavaScript SDK, real bundled Rust/WASM runtime, and the offline `zerynex-refund-check` CLI. Independently installed and tested as an npm tarball. Registry ownership/publication is a separate action.
- **`zerynex-python`**: Python SDK, CLI adapters and optional local MCP server. Independently installed/tested as a wheel. Registry ownership/publication is separate.
- **Rust**: native CLI archives available via GitHub releases; crates.io is **not yet** part of the trusted registry publishing workflow. Its `cargo publish --dry-run --locked` package verification now passes, but name ownership, registry authorization, crate-content review and an actual publish decision remain outstanding.
- **Go**: [source module](go-sdk.md) uses `github.com/Oluwa-Laughter/zerynex/packages/go`. Go modules do not use npm or PyPI. Because the module lives in a subdirectory, a versioned Go release requires a separate tag such as **`packages/go/v0.2.0`** after a reviewed commit. The root Git tag `v0.2.0` does *not* release this nested Go module. Do not push that tag until the Go consumer tests pass.
- **GitHub Action**: use an immutable reviewed Git SHA for integration. Agents and public CI should use only reviewed synthetic PCZT fixtures.

## Registry-account readiness checklist

An npm login alone does not establish ownership of the **@zerynex** namespace.
Verify that your npm account owns that scope, or create the npm organization.
The reviewed package name is **@zerynex/sdk**. If npm cannot configure a
trusted publisher for an unpublished package, its first real reviewed release
may need an interactive account/2FA publish. Configure trusted publishing for
a **later** version; never re-publish an already published version, publish a
placeholder archive or commit registry credentials.

PyPI can create the new **zerynex-python** project using **Pending Publishers**
under the account Publishing settings. If the project already exists under your
ownership, configure its project-level Publishing settings instead. Pending
publisher registration does not reserve the project name.

Use these exact GitHub Actions identity fields on npm and PyPI:

| Field | npm | PyPI |
| --- | --- | --- |
| Package/project | @zerynex/sdk | zerynex-python |
| GitHub owner | Oluwa-Laughter | Oluwa-Laughter |
| Repository | zerynex | zerynex |
| Workflow filename | registry-publish.yml | registry-publish.yml |
| Environment | npm-publish | pypi-publish |

On GitHub repository Settings → Environments, create **npm-publish** and
**pypi-publish**, configure maintainers' required reviewer approvals and
approved branches if supported by your GitHub plan, and **test that the
protections actually work**. No tokens or passwords belong in this repository.

Only after an explicitly reviewed and approved version tag points to the
exact current main commit, a matching published GitHub Release exists, and
the artifacts/checksums are verified, start the existing **Publish verified
SDKs to registries (manual)** GitHub Actions workflow on main. For v0.2.0,
publish npm and PyPI in two separate runs, with confirmations
**PUBLISH-v0.2.0-npm** and **PUBLISH-v0.2.0-pypi**, respectively. The workflow
intentionally refuses a tag for an older main commit. Account registration
alone is not authorization to tag, upload or publish.

### Go and Rust distribution are independent

The Go SDK module lives at github.com/Oluwa-Laughter/zerynex/packages/go.
It runs policy checks through an installed trusted local Rust CLI; it has
no separate Go cryptographic engine or hosted PCZT analysis endpoint. After
reviewed tests and explicit approval, publishing the nested Go module
requires the Git tag **packages/go/v0.2.0** on its release commit. The
repository-root **v0.2.0** tag does not publish that module. External Go
consumers then use go get with that module path and version.

Rust supplies the canonical library and CLI. GitHub Release distributes
the native CLI; crates.io is an *optional separate registry* which requires
its own identity, reviewed crate-name ownership and approval.
Running cargo publish --dry-run --locked checks the source package locally
but **does not upload**. The npm/PyPI workflow does not release crates.io
or create Go tags.

## What the maintainer needs to do

1. **npm:** Sign in to [npm](https://www.npmjs.com/) and verify that you control the `@zerynex` scope (or create an npm organization). A registry `404` alone does **not** reserve or guarantee ownership of a namespace. If it is unavailable, decide on another scope and update all package references *before publishing*. **For an entirely new npm package, you may first need to publish the reviewed tarball interactively with your account and required 2FA**, because npm's trusted publisher settings are generally attached to an existing package. Do **not** upload credentials or a write token to the repo or Actions. After initial publication, configure an npm trusted publisher for `@zerynex/sdk` using **owner `Oluwa-Laughter`, repository `zerynex`, workflow `registry-publish.yml`, environment `npm-publish`**, with direct `npm publish` permission. A version already published manually cannot be published again; use the following reviewed version for OIDC publishing. The repository URL in `packages/sdk/package.json` must remain exact.
2. **PyPI:** Create/sign in to [PyPI](https://pypi.org/). Configure an existing or pending trusted publisher for **`zerynex-python`** with **owner `Oluwa-Laughter`, repository `zerynex`, workflow `registry-publish.yml`**, using the environment `pypi-publish`. Confirm the project name is actually available before scheduling publication.
3. **GitHub:** Set up protected environments named **`npm-publish`** and **`pypi-publish`** with required reviewers/approval and restrictions to the protected `main` branch (if supported by your repository plan). **Verify those approvals actually block a test workflow before a real release.** GitHub environment protection varies by repository visibility and account plan; if required reviewers cannot be configured, do not assume there is an approval gate. Restrict who can push release tags. The registry jobs use minimal OIDC permissions and **no long-lived registry tokens**.
4. **Release:** Review the changed SDK interface, dependency tree, package metadata, CLI binaries, privacy boundaries, changelog and version. Pass the complete CI/distribution workflows. After release approval, deliberately push an annotated **`v0.2.0`** tag pointing to the reviewed `main` commit. The existing distribution workflow will create its GitHub Release and tested native/WASM/wheel assets. **No tags are pushed automatically by Zerynex's new tooling.**
5. **Registry publication:** Once the Release exists, open GitHub Actions → **Publish verified SDKs to registries (manual)** → Run workflow on `main`, enter `v0.2.0`, select **one** registry, npm or pypi, and enter **`PUBLISH-v0.2.0-npm`** or **`PUBLISH-v0.2.0-pypi`** as the confirmation. Approve the protected environment. The **tag must resolve to the exact workflow commit on `main`** (if main advanced after tagging, a new reviewed release is required). Each run downloads **the existing GitHub Release artifact**, validates its version and entry points, verifies its SHA-256 against the checksum shipped with that Release, then publishes **that exact distribution** via OIDC. The workflow deliberately does not build code, run package lifecycle scripts or auto-run on new commits. Registry publication is public and generally irreversible; review the release assets and protected environments before clicking Run workflow.
6. **External adoption:** Run the independently installed [third-party consumer starter](https://github.com/Oluwa-Laughter/zerynex/tree/main/examples/consumer-integration) in Node.js and Python. The source and packaged examples are automatically verified in CI. Then test installation from the real public registries with a fresh project and no local aliases after publication. Check Node.js, Python, OS-native CLI and React bundler combinations. Publish versioned migration notes, sample repo integrations, support/security reporting, and real upstream Zcash compatibility matrices with explicit unknowns. Keep private wallet/transaction content out of CI and agents.

### Public registry status and first release caveat

**Checked October 20, 2026:** the public npm registry API for `@zerynex/sdk`,
PyPI JSON API for `zerynex-python`, and crates.io API for `zerynex`
returned HTTP 404. This means no public package was returned at those URLs,
**not** that the names or npm scope are guaranteed claimable. Verify registry
ownership interactively in your accounts before approving a release.
**No registry or Git tag is created by this project setup.** Only the reviewed
[`v0.1.0` GitHub Release](https://github.com/Oluwa-Laughter/zerynex/releases/tag/v0.1.0)
exists publicly as of that check.

The **npm** first-publication bootstrap may require an interactive maintainer
publish using the verified GitHub Release tarball and 2FA before a package
settings page exists for trusted publishing. Do not attempt to publish the
*same* immutable version twice. **PyPI** supports pending trusted publishers
for first-time projects, so configure its identity before the first publish.
For npm's newest trusted publisher policies, explicitly allow **`npm publish`**
(not just staged publication) if using this workflow. Verified maintainers
can also choose a staged publication process separately, but it is *not*
automatically enabled here.

The manual workflow is a *configured release path*, not evidence of registry
ownership, working reviewer protections or successful publication. Keep
publishing disabled until the environment, account, exact tag and artifact
checks are complete. The GitHub Release now includes
`SHA256SUMS-registry.txt`; its npm/PyPI assets are compared against that
manifest immediately before upload.

### Offline preflight before a release

```bash
python3 scripts/check-release-version.py
python3 scripts/check-registry-release.py
python3 -m unittest discover -s tests -p test_registry_release.py -v
python3 -m unittest discover -s tests -p test_registry_asset_digests.py -v
python3 -m unittest discover -s tests -p test_registry_publish_workflow.py -v
cargo publish --dry-run --locked  # verifies local crate; does not upload
cd packages/sdk && pnpm install --frozen-lockfile && pnpm build && pnpm test
cd ../.. && node scripts/test-sdk-packed.mjs
```

The distribution workflow also installs the Python wheel into a fresh
virtualenv, invokes the trusted Rust CLI and MCP tooling, and validates
platform-native archives. `scripts/check-registry-release.py --tag v0.2.0
--registry npm --artifact-dir release-assets` (or `pypi`) verifies the
actual versioned downloadable archive **before** a manual publisher run.

## Completion criteria before declaring v0.2.0 production-ready

- **Implemented and exercised in this repository:** reusable Rust/PCZT engine,
  bundled WASM SDK, Python and Go wrappers, local browser workbenches including
  offline lightwalletd metadata checks, read-only agent tooling, strict JSON
  boundaries, release artifact verification scripts, and synthetic CI fixtures.
- **Must pass on the exact reviewed commit:** all CI and distribution-artifact
  jobs, source-level Vercel module checks, independently installed npm and
  Python package consumers, mobile/desktop Playwright suite, and deployed
  public-route/WASM smoke verification. Re-run these after each merge.
- **Not proven by these tests:** real Zallet PCZT creation/proving/signing,
  Zebra/lightwalletd/Zaino network interoperability, full consensus or shielded
  privacy guarantees, or registry installation from a public, published version.
  Each requires separate version-pinned, explicitly authorized tests.
- **Owner-controlled external actions:** claim/check npm and PyPI namespaces,
  configure trusted publishers and approvals, review the final artifacts and
  checksums, authorize a GitHub release tag and registry publication. Never
  infer these steps from a green CI run.

The [upstream integration roadmap](https://github.com/Oluwa-Laughter/zerynex/blob/main/docs/ecosystem-integration-roadmap.md) identifies
follow-on network compatibility work after the offline toolkit release.

## Security, compatibility, and honest scope

Zerynex does not sign payments, attest anonymous transactions, verify Zcash
consensus or deliver a quantum-safe wallet. The offline privacy metadata
check only enforces the **declared** policy. A successful synthetic example
is not proof that a third-party Zcash wallet or RPC node is compatible.
Browser and Node SDKs must not upload private PCZT content, secrets,
viewing keys, refund addresses or wallet-account information. Require
explicit developer input and host authorization for any live wallet handoff.

Official references: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/),
[PyPI trusted publishers](https://docs.pypi.org/trusted-publishers/),
[Go nested-module version tags](https://go.dev/doc/modules/managing-source/),
and [Cargo publishing](https://doc.rust-lang.org/cargo/reference/publishing.html).
