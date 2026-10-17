# Zallet PCZT handoffs: local policy checks

Zerynex checks selected Zcash PCZT disclosure rules between transaction
creation, proving and signing. Zallet's official RPC documentation describes
a PCZT workflow with pczt_create, pczt_inspect, pczt_prove, pczt_sign,
pczt_combine and pczt_extract. These RPC methods return/accept PCZTs in
base64-encoded transport formats.

Sources:
- https://zcash.github.io/zallet/rpc/index.html
- https://zips.z.cash/zip-0374

## Install locally, without a hosted service

Option A: clone the source and build the Rust CLI:

    git clone https://github.com/Oluwa-Laughter/zerynex.git
    cd zerynex
    cargo build --locked --release

Option B: install CLI into your Cargo home, directly from this repository:

    cargo install --git https://github.com/Oluwa-Laughter/zerynex --locked --bin zerynex

No Node package manager, browser, paid account, Zcash wallet or API key
is needed to perform local PCZT policy linting.

## Direct from Zallet's base64 transport

If a developer already holds the base64 PCZT locally in a protected file:

    zerynex path/to/synthetic.pczt.b64 --input-format base64 --deny-transparent --json

For locally controlled processes, write the base64 to the CLI's standard input:

    cat path/to/synthetic.pczt.b64 | zerynex - --input-format base64 --deny-transparent --json

This keeps PCZT text out of shell command arguments (and typically shell
history). Do not paste a real PCZT into a command, shared terminal log,
bug report, LLM prompt or public CI run.

The binary format remains the default:

    zerynex path/to/synthetic.pczt --deny-transparent --json

Both paths are checked by the same Rust core with the same policy.
The input size limit is 8 MiB decoded. No conversion service exists.

## Python applications and wallet test suites

The Python adapter can analyze a Zallet-style base64 string directly from a
trusted application memory buffer:

    from zerynex_py import ZerynexClient, Policy

    client = ZerynexClient(cli="/absolute/path/to/zerynex")
    # pczt_base64 comes from your trusted local application, not an AI agent.
    report = client.analyze_base64(
        pczt_base64,
        Policy(deny_transparent=True),
    )
    print(report.agent_summary())

The string is passed to the Rust CLI over stdin. The Python wrapper never
creates a temporary file or makes an RPC request.

## Why an extra pre-signing check?

Zallet's pczt_inspect reports a human-readable summary based on information
recorded in the PCZT, but the upstream docs warn the contents are not
cryptographically verified at inspection time. A PCZT received from another
party may have altered outputs or metadata. Zerynex adds **explicit,
repeatable disclosure rules** before or after role handoffs. It does not
replace Zallet's inspection, wallet approval, proof verification or signatures.

Use cases to test in your own trusted environment:

1. Examine the PCZT after pczt_create using a role-appropriate policy.
2. Verify the PCZT's disclosure policy before handing it to another party.
3. Run the same rule set on the PCZT after a prover or signer has contributed.
4. Compare findings, and separately review outputs, amounts and signing
   authority with the wallet's own pczt_inspect and safety policies.
5. Only authorize the transaction in your wallet after independent review.

These are integration patterns, **not** a claim that Zerynex calls Zallet
RPC or verifies a full live wallet lifecycle.

## Tests and next interoperability gate

Our tests generate harmless v6 PCZT fixtures with the upstream Rust pczt
crate, transport them through base64 and stdin, and confirm that the
Rust and Python integrations report identical policy violations.
Neither wallet credentials nor sendable transactions are involved.

A full Zallet RPC integration suite would require disposable testnet/regtest
wallet fixtures and live pczt_create/prove/sign/extract compatibility tests.
It has not been completed. Zerynex does not sign, broadcast, generate
proofs, authorize spends or validate cryptographic proofs.

## Check the upstream RPC shape without invoking the wallet

Developers can use the [offline RPC contract checker](rpc-contracts.md)
to compare a protected local `rpc.discover` response against a documented
PCZT method contract, including an optional check for new required
parameters. This is structure-only compatibility detection and does **not**
call Zallet or provide authorization, proof or signing verification.

## Offline role fixture testing before wallet integration

The separate zerynex-handoff executable provides synthetic Creator,
Updater, Combiner and Redactor policy scenarios without provisioning
Zallet. Read docs/handoff-harness.md. This does **not** establish
compatibility with real Zallet RPC, signing, proving or extraction.
