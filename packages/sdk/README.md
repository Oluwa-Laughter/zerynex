# @zerynex/sdk

A typed SDK for the local Zerynex Zcash PCZT disclosure-policy analyzer.
It delegates to a trusted locally executed Rust/WebAssembly engine and does
not transmit PCZT contents, hold keys, sign transactions or broadcast payments.

## Install

When published, users will be able to install it with any standard package manager:

    npm install @zerynex/sdk
    yarn add @zerynex/sdk
    pnpm add @zerynex/sdk

The SDK is currently only used as a local dependency from this repository
and is **not yet published on the npm registry**.

## API

    import { createZerynexClient } from '@zerynex/sdk'
    import init, { analyze_pczt_policy } from './wasm/zerynex.js'

    const client = createZerynexClient({
      loadEngine: async () => {
        await init({ module_or_path: '/wasm/zerynex_bg.wasm' })
        return { analyze_pczt_policy }
      },
    })

    const report = await client.analyzeBlob(file, {
      profile: 'external_signer',
      deny_transparent: true,
      deny_sapling: false,
    })

The web application must supply its own trusted WASM runtime. The Zerynex
Next.js Studio is a functioning reference implementation.

Use exportPolicyJson to create JSON policies compatible with the Rust CLI.
The SDK rejects misspelled/unsupported policy fields and uses generic error
messages to avoid exposing input data in logs.

## Security limits

This is an experimental privacy policy linter, not a guarantee of anonymity,
consensus validity, or signing safety. A malicious host or compromised browser
can access local files regardless of this SDK's own no-upload design.

## Development

    npm install
    npm run build
    npm test

The same scripts work with Yarn and pnpm.

## Importing JSON policies

The SDK exposes parsePolicyJson to validate imported policy files. It rejects
unknown keys and invalid types, mirroring the Rust policy format.
In the Studio, users can import a JSON policy locally without uploading it.
