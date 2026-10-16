# Package manager support

Zerynex does not require pnpm. npm, Yarn and pnpm can install the TypeScript
SDK and Next.js app. The repository commits pnpm lockfiles for reproducible CI,
but dependencies use standard package.json declarations.

## Setup using npm

    cd packages/sdk
    npm install --no-package-lock
    npm run build
    npm test

    cd ../../apps/web
    npm install --no-package-lock
    npm run dev

## Setup using Yarn

Yarn classic version 1:

    cd packages/sdk
    yarn install --no-lockfile
    yarn build
    yarn test

    cd ../../apps/web
    yarn install --no-lockfile
    yarn dev

Yarn Berry may need a node-modules linker for Next.js and the local SDK file
dependency. Follow Yarn's official linker documentation if necessary.
CI tests the Yarn classic workflow.

## Setup using pnpm (CI reference)

    cd packages/sdk
    pnpm install --frozen-lockfile
    pnpm build
    pnpm test

    cd ../../apps/web
    pnpm install --frozen-lockfile
    pnpm dev

When switching managers, first remove their old node_modules directories,
then rebuild the SDK before installing the web application, because apps/web
references the locally built SDK using a relative file dependency.

## Rust and WebAssembly

The frontend runs the generated Rust/WebAssembly analysis engine. Rebuild with:

    cd /path/to/zerynex
    bash scripts/build-wasm.sh

The script requires the Rust wasm32 target and wasm-bindgen-cli 0.2.129.
The Rust CLI works without Node tooling:

    cargo test --locked
    cargo run --locked -- apps/web/public/examples/flagged-v6.bin --json

The SDK is NOT published to the npm registry yet. External installations by
package name will only be possible after a reviewed release is published.
