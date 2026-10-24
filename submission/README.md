# Zerynex finalist submission kit

This is a **submission draft**, not evidence that a competition entry or video has been submitted. No release, package, transaction, or production promotion is performed by following it.

## Suggested project name and track

- **Project:** Zerynex
- **Track:** Choose the actual dropdown option that most closely matches **developer tooling/infrastructure for Zcash**; if none exists, choose the closest **privacy tooling** category. Do not copy a guessed track name into a form.
- **Public source:** https://github.com/Oluwa-Laughter/zerynex
- **Public demo:** https://zerynex.vercel.app/tools
- **Before/after comparison:** https://zerynex.vercel.app/tools/stages
- **Homepage / entry:** https://zerynex.vercel.app/

## Submission description (under 2,000 characters)

Zerynex is local-first developer infrastructure for privacy-policy checks around Partially Created Zcash Transactions (PCZTs). Developers can explicitly select a binary PCZT, run selected disclosure policies through a Rust analysis engine, and receive a sanitized report containing rule IDs and field paths instead of private field values.

The core workflow compares two PCZT snapshots across creation, update, or handoff stages to reveal newly introduced privacy findings and pool-component count changes. The same Rust foundation powers a native CLI, browser/WebAssembly analysis, language SDKs, and repeatable CI checks. The website demonstrates the real engine using clearly labeled, non-spendable synthetic PCZTs, without uploading selected files to a hosted analysis endpoint.

Supporting integrations include offline RPC-contract checks and read-only Zcash infrastructure diagnostics. Zerynex does not sign, prove, authorize, or broadcast transactions; a passing check is not proof of anonymity, consensus validity, or safe spending. Live Zallet signer/prover interoperability remains unverified, and unreleased source changes are not advertised as published registry packages.

## Demo flow

1. Open /tools and confirm **RUST ENGINE READY**; choose **Clean v6**, run privacy analysis, and show a policy pass.
2. Choose **Flagged v6**, run again, and show PCZT-GLOBAL-METADATA with the global.proprietary field path rather than a private value.
3. Open /tools/stages, choose **New metadata**, click **Compare PCZT stages**, and show an introduced finding and before/after counts.
4. Mention **Pool topology** as an optional second scenario, where a synthetic transparent output changes structure even if the default policy permits it.
5. Close with /integrate and the public repository. The feature and package inventory is secondary to this repeatable demonstration.

See [120-second recording script](VIDEO.md) and [verification checklist](CHECKLIST.md).

## Evidence boundary

The synthetic example binaries are **non-spendable** and contain no live wallet secrets. The browser uses compiled Rust/WASM; the CLI and SDKs are independently tested. A live Zallet producer/prover/signer has not been demonstrated here. Repository main and the website may evolve after this package is written; verify the deployed Git SHA, public routes, and checks again immediately before submission.

The latest public GitHub Release verified on 24 October 2026 is **v0.1.0**. Source code identifying as v0.2.0 is **not** a published v0.2.0 release. Do not publish or tag without maintainer approval.
