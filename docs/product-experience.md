# Zerynex product experience and distribution plan

## Phase II interface, October 2026

The website is a **developer product**, not a source-code showcase.
The critical journey is:

1. Discover a Zcash developer capability.
2. Run a tested synthetic example in the browser (no installation).
3. Review a sanitized privacy report and its limitations.
4. Read the canonical /docs guide.
5. Integrate the smallest applicable SDK, local CLI or CI action.

The frontend is not an account dashboard or a wallet.

### Information architecture

- / — product statement, usable Rust/WASM demo, core capabilities.
- /tools — interactive single-PCZT inspection.
- /tools/stages — compare two local PCZT snapshots.
- /tools/handoff — deterministic synthetic role scenarios.
- /ecosystem — language tabs: Rust, TypeScript, Python, Go.
- /agents — restricted MCP server, portable agent skills and CI tooling.
- /docs — searchable canonical guides and technical limitations.

Languages should be listed as language names, not personas. Prover,
wallet, node, ZK and agent workflows are **use cases**, not languages.

### Brand and motion

Phase II uses an original geometric offset-Z mark, a lime signal accent
and a dark-forest / warm-light token-based palette. The symbol is reused
in the favicon, social card and product navigation. React Icons replaces
decorative emoji.

GSAP handles the narrative hero and scroll reveals. Motion for React
handles interactive presence and states, SDK language transitions, hover
feedback and the theme control. CSS handles simple hover transitions.

Scroll motion must not apply hidden visibility to interactive content.
Respect prefers-reduced-motion without hiding information.
Light, Dark and System themes apply to the entire app and persist.

### Distribution

| Path | Now | Next |
| --- | --- | --- |
| Public web workbench | Zero install, local WASM | More tested browser utilities |
| TypeScript | Repository-local Rust/WASM SDK | Versioned npm package |
| Rust | Cargo Git source install and local CLI | Published crate and binaries |
| Python | Source adapter with local Rust CLI | Wheels and native bindings |
| Go | Source adapter with local Rust CLI | Tagged Go module |
| CI | Composite GitHub Action | Immutable tagged release |
| Agents | Restricted MCP server and source skill | Versioned installers |

Never advertise a registry package as published until a clean consumer
installation has actually been tested.

### GitHub ownership

The public site does not promote a personal GitHub repository in its
main navigation or homepage CTAs. Required source attribution remains
in integration instructions and package metadata. An organizational
repository transfer needs an existing owner-authorized GitHub organization.
Do not invent a destination and break real install or CI references.

### Release acceptance

A Phase II release must pass:
- production Next.js build and canonical doc sync;
- live Rust/WASM example desktop/mobile checks;
- all existing PCZT workbench regression tests;
- language and agent navigation;
- Light/Dark/System persistence tests;
- reduced-motion accessibility tests;
- Rust and SDK CI workflows;
- public deployment smoke tests.

A passing policy report is not a privacy guarantee or a consensus audit.
