# Policy as code (experimental)

Zerynex accepts a local binary PCZT and checks selected field-disclosure rules.
The JSON schema is strict; unknown names and unsupported profiles return generic
errors without logging raw input. The maximum policy size is 4096 bytes.

## Schema

    {"profile":"external_signer","deny_transparent":true,"deny_sapling":false}

- profile: external_signer (default) or restricted_handoff.
- deny_transparent: reject transparent inputs and outputs (default false).
- deny_sapling: reject Sapling spends and outputs (default false).

This is a linter, **not a transaction redactor**. A rejected PCZT is unchanged.
The restricted profile can reject fields a legitimate signer requires.
All profiles flag unreviewed proprietary metadata accessible through the
public PCZT getters and Orchard/Ironwood dummy spending keys.

The Sapling checks are partial: not all private intermediate fields
(including dummy authorizing key internals) have upstream public getters.

## CI

    cargo run --locked -- path/to/synthetic.pczt --policy-file policies/shielded-only.json --json

Exit status 0: implemented rules found no issues; 1: input/runtime error;
2: findings. Never commit real transaction secrets, spendable keys or
confidential PCZTs to CI artifacts or repositories.

CLI flags --deny-transparent and --deny-sapling only tighten restrictions.

## Samples

- policies/external-signer.json
- policies/restricted-handoff.json
- policies/shielded-only.json
- policies/ironwood-focused.json

## Limitations

Passing does not establish anonymity, verify Zcash consensus, or prove
that a signer is trustworthy. The transparency rule enforces only the
absence of transparent inputs/outputs in the intermediary PCZT.
Sapling prohibition is an application preference, not a protocol requirement.
Reference: https://zips.z.cash/zip-0374

The nonspendable transparent-v6 fixture demonstrates the additional protection:

    cargo run -- apps/web/public/examples/transparent-v6.bin --deny-transparent --json

That test returns exit status 2 and identifies transparent.outputs as a violation.
