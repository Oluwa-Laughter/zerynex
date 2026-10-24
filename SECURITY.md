# Security policy

Zerynex is experimental Zcash developer tooling, not an audited security product. Passing implemented disclosure checks **does not prove transaction privacy, proof validity, signing safety, or Zcash consensus correctness**.

## Supported versions

Security fixes and updates target the current development source on `main`. Version `v0.2.0` is a fixed GitHub Release and independently published npm/PyPI distribution; its contents do not change after publication. Consumers should pin an approved version and verify release artifacts.

## Report a vulnerability privately

Please do **not** post private PCZT bytes, wallet credentials, spending/viewing keys, addresses, secrets, unredacted RPC responses or exploit payloads in public GitHub issues, pull requests, CI, or chats.

Use GitHub's **Report a vulnerability** / private security advisory option under the repository's **Security** tab if it is available. If that option is unavailable, contact the repository maintainer through a private GitHub communication channel before sharing sensitive details. Do not assume this repository monitors a public security inbox.

A useful report includes the affected release/commit, synthetic nonspendable reproduction steps, expected/actual behavior, the confidentiality risk and sanitized logs or rule identifiers. For ordinary non-sensitive feature requests and functional bugs, public GitHub issues are appropriate.

## Runtime trust assumptions

- Browser PCZT analysis executes locally using bundled Rust/WASM; compromised browsers or extensions may still read selected local files.
- Python and Go adapters execute a locally installed Rust binary. Verify the binary's origin and version.
- RPC readiness and observation helpers operate only on supplied or explicitly configured local/trusted data; do not infer network or settlement guarantees.
- Public CI and local agent/MCP tests must use approved nonspendable synthetic fixtures.
- No Zerynex component should be entrusted with wallet signing authority based on a policy-lint result alone.

Read [the privacy model](docs/privacy-model.md) and [integration contracts](docs/integration-contracts.md) for further limitations.
