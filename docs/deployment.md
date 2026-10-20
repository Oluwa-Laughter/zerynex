# Deploy the Zerynex developer frontend

The Zerynex website is a **Next.js 16 + React 19 frontend** that hosts
developer documentation and local Rust/WebAssembly tools. It does not
accept, store or analyze submitted PCZTs on a remote API endpoint.

## Source and routes

The frontend source lives under apps/web. Its canonical documentation
comes from docs/ and is mirrored into apps/web/content/docs during the
production build by scripts/sync-docs.mjs.

Key routes:
- /docs and /docs/[slug]: searchable installation, SDK and infrastructure guides.
- /tools: the single-PCZT inspector.
- /tools/stages: compare two PCZT snapshots locally in WASM.
- /tools/handoff: evaluate pre-generated synthetic PCZT role scenarios.
- /ecosystem: onboarding pathways for Rust, TypeScript, Python, Go, ZK and node developers.

## Vercel monorepo settings

Use a Vercel Next.js project connected to the Zerynex GitHub repository:

    Framework: Next.js
    Root Directory: apps/web
    Include source files outside the root directory: enabled
    Node.js: 24.x
    Install Command: pnpm install --frozen-lockfile
    Build Command: pnpm build

Source outside the app root is necessary because the Next.js app reads
docs/ during prebuild and imports the repository-local Rust/WASM TypeScript
SDK from packages/sdk.

The web tsconfig.json maps @zerynex/sdk to packages/sdk/src/index.ts.
This avoids relying on pre-built dist output from a file: dependency
that is absent from clean Git checkout and remote package installations.
The official published SDK package contract remains based on its own
dist export.

**SDK source mirrors are a deployment dependency.** Vercel follows the
TypeScript source alias, so imports such as `./strict-json.js` must have
checked-in generated JavaScript mirrors under `packages/sdk/src`. A local
`packages/sdk/dist` build can conceal missing mirrors because that directory
is ignored by Git. `apps/web` now runs `scripts/check-web-sdk-source.mjs`
before both development and production builds, while GitHub CI verifies that
all generated mirrors are synchronized with TypeScript:

```bash
node packages/sdk/scripts/sync-network-source.mjs --check
node scripts/check-web-sdk-source.mjs
cd apps/web && pnpm install --frozen-lockfile && pnpm build
```

After adding or editing an SDK source module, run
`node packages/sdk/scripts/sync-network-source.mjs`, review the generated
JavaScript diff, and commit the mirrors with the TypeScript implementation.
Never rely on local untracked `dist/` output to prove a Vercel deployment will
build. Vercel uses the pinned pnpm 10.34.6 package manager from the web
package manifest.

The WASM module is compiled from the canonical Rust crate and committed
as a checked build asset to apps/web/public/wasm; the frontend does not
run Rust/Cargo compilation on Vercel for every deployment. CI separately
compiles and tests the Rust crate with WASM support.

## Browser and privacy validation

After a deployment, verify:
- /docs/installation loads and code examples are readable;
- /tools shows RUST ENGINE READY and can inspect a synthetic fixture;
- /tools/stages detects synthetic metadata introduction and pool-count drift;
- /tools/handoff checks four expected synthetic transitions;
- /wasm/zerynex_bg.wasm loads with the proper application/wasm MIME type.

Never use private PCZT contents, wallet addresses, spending keys, credentials
or other confidential transaction intermediates in public test fixtures.
Browser workbench inputs are handled locally by the downloaded WASM engine.

## Limitations

Public hosting is **not** proof of live Zallet RPC, Zebra consensus, Zaino
indexer integration, signer authorization or zero-knowledge proof verification.
These remain separately scoped back-end integration milestones.

Monitor hobby deployment usage and keep production authentication settings
consistent with your intended public documentation access.
