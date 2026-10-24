# Finalist submission verification checklist

Verify against the **exact commit submitted**, not just an earlier green run.

- [ ] Public GitHub main SHA recorded; changes merged only after review and passing CI.
- [ ] CI and distribution workflows pass for submitted SHA, not merely an older main.
- [ ] Vercel production deployment SHA matches submitted SHA; READY alone is not a functional test.
- [ ] Browser clean/flagged synthetic analysis and stage comparison succeed on desktop and mobile.
- [ ] Browser invalid/empty inputs, labels, focus states, results and 320px layout tested.
- [ ] No private PCZT bytes or wallet values appear in errors, exported JSON, SARIF or CI logs.
- [ ] Browser traffic inspected during selected PCZT analysis; no transaction upload or wallet operations.
- [ ] README, /integrate, docs mirrors, SDK interfaces and release status agree.
- [ ] Synthetic fixtures clearly non-spendable; offline upstream fixture/contract checks not called live signer/prover verification.
- [ ] Public release remains v0.1.0 until explicitly approved publication.
- [ ] Choose actual available competition track; do not invent a category or deadline.
- [ ] Record and watch the actual MP4 of **120 seconds or less**.
- [ ] Submit name, under-2,000-character description, selected track, public code URL, working demo URL and video; confirm form receipt.

## Limitations

No signing/proving/broadcasting, audited privacy guarantee, full consensus check or live Zallet signer/prover interoperability demonstration. A timed storyboard is not an uploaded video. No public npm/PyPI v0.2.0 publication is claimed.

## Verification commands

    cargo fmt --all -- --check
    cargo clippy --locked --all-targets -- -D warnings
    cargo test --locked --all-targets
    cargo check --locked --target wasm32-unknown-unknown --features browser
    (cd packages/sdk && pnpm install --frozen-lockfile && pnpm build && pnpm test)
    node scripts/test-sdk-packed.mjs
    (cd apps/web && pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm typecheck && pnpm test:e2e)
    node scripts/validate-docs.mjs
    node scripts/test-public-docs.mjs

These are acceptance commands, **not a claim** that they all completed. Record the check results with the submitted commit.
