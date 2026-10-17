# Integrate Zerynex into a Zcash application

This is a **consumer-repository starter**, not a wallet, signer, or live Zcash RPC integration. It runs selected Zerynex PCZT disclosure rules in CI against a synthetic test fixture. It neither receives secrets nor handles real user transactions.

1. Copy `.github/workflows/privacy-check.yml` to your application's `.github/workflows/` directory.
2. Copy `policies/zerynex.json` to your app's `policies/` directory.
3. Supply **your own** deterministic, synthetic, nonspendable test PCZT at `tests/fixtures/clean-v6.bin`, or copy the Zerynex-generated clean fixture from the repository. Keep private transaction intermediates and keys out of Git and CI.
4. Review the policy against your workflow, and set `pczt-path` accordingly. A shielded-only rule may reject legitimate applications using transparent components.
5. Pin `uses: Oluwa-Laughter/zerynex@...` to the reviewed **full commit SHA**. The `@main` example is for exploration only.
6. Open a pull request and examine the policy findings. A passing result **does not** guarantee anonymity, transaction validity, signing safety, or proof correctness.

For stage-to-stage regression testing, add `baseline-path` with a second synthetic PCZT. For a role-handoff scenario, use `scenario-manifest` instead of a single PCZT file. See `docs/github-action.md` and `docs/handoff-harness.md` in the Zerynex repository.

**Release status:** the GitHub Action source exists, but registry releases and stable version tags are not yet published. Production adoption must pin and independently review a specific source commit.
