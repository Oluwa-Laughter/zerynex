# Documentation workflow for Zerynex contributors

The **docs/ folder is the canonical documentation source**. The Next.js
website mirrors approved files into a statically rendered /docs experience.
Do not write a second, drifting set of guides inside React components.

## When you implement a feature

1. Implement the Rust core or appropriate interface with real behavior,
   deterministic synthetic fixtures, and positive/negative tests.
2. Create or update its Markdown guide inside docs/. Include the
   audience, installation, a complete executable example, version
   assumptions, expected output, failure behavior, safety boundaries,
   and unsupported capabilities.
3. Add the guide to docs/catalog.json with a unique slug, group, status,
   audience and concise summary.
4. If the capability is exposed by Developer Tools, link its integration
   quickstart to the corresponding in-site /docs/slug route.
5. For a new language or developer role, add an honest onboarding path
   to the Ecosystem Atlas, or link to the guide.
6. Add integration and browser tests; do not describe an untested
   adapter as supported.
7. Run the documentation sync and validator before publishing.

## Run the docs build

    node scripts/sync-docs.mjs
    node scripts/validate-docs.mjs

The sync copies explicitly cataloged Markdown and index.json into
apps/web/content/docs. Do not hand-edit those mirrored files.
The validator checks catalog metadata, canonical/generated parity and
local guide links. Both run in GitHub CI.

Next.js also executes the sync before dev and production builds.
The mirrored output is committed so the deployment is self-contained,
even when apps/web is used as the deployment root.

## Support labels

- supported: the described specific interface has passing tests.
- partial: useful and tested behavior exists, but significant API
  or protocol paths are still unsupported.
- preview: an early or synthetic integration with limited external
  compatibility validation.
- research: a documented proposal, **not an implemented feature**.

Avoid conflating supported **offline fixtures** with complete node,
prover, signer, mainnet, or wallet compatibility.

## Security and privacy documentation

Always be explicit when an operation:
- reads local transaction files or bytes;
- uses the network or authenticated RPC;
- handles wallet addresses, metadata, keys or spend authority;
- emits stdout/stderr/log output and CI reports;
- can be safely run with public nonspendable synthetic fixtures.

Do not put real wallet transactions, addresses, private ZK witnesses,
viewing keys or signing keys in public documentation, tests or screenshots.
Never invent audit guarantees, cryptographic verification, or network
support that Zerynex does not perform.

## Website and code review

Maintain /docs as an accessible, searchable content library and keep
its pages independent of a Zcash wallet connection. Verify desktop/mobile
navigation, link integrity, content rendering, reduced motion and code
readability. The optional website is not needed to use the Rust CLI or
SDKs.

Code owners should evaluate new languages by their specific ecosystem
use cases, test burden and adoption paths. Keep the actual PCZT parser and
privacy-rule implementation in Rust rather than porting cryptography
independently.
