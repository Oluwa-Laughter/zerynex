# Supported policy rules (v0.1)

Transparent inputs or outputs (when denied):
PCZT-TRANSPARENT-INPUTS, PCZT-TRANSPARENT-OUTPUTS.

Unreviewed proprietary metadata:
PCZT-GLOBAL-METADATA, PCZT-UNREVIEWED-METADATA.

Accessible Orchard/Ironwood dummy spend keys:
PCZT-DUMMY-KEY.

Restricted output handoff:
PCZT-RESTRICTED-DISCLOSURE.

Sapling spends or outputs when application policy prohibits them:
PCZT-SAPLING-POLICY.

Default agent policy: external_signer with deny_transparent true
and deny_sapling false.

A restricted-handoff policy may flag fields legitimate signers actually
require. Sapling prohibition is not a Zcash consensus requirement. Passing
any of these checks does not establish anonymity or protocol correctness.

Official specification: https://zips.z.cash/zip-0374
