# Add Zerynex to a Zcash developer project

This is a **third-party integration starter**, not a Zcash wallet, signer,
live node integration, or quantum-safe protocol. It contains reviewed,
nonspendable synthetic PCZT and **non-secret swap metadata** checks.
No application secrets, real refund addresses, viewing keys, wallet IDs,
or real transaction intermediates belong in these examples or public CI.

## 1. Use the pinned GitHub Action in your application

Copy `.github/workflows/privacy-check.yml` and `policies/zerynex.json`
to the corresponding paths in your own project. Provide a **synthetic**
PCZT at `tests/fixtures/clean-v6.bin` (for example the public clean
fixture from Zerynex). The Action references a **full reviewed commit SHA**,
not `main`; review that commit and update only deliberately. Confirm the
shielded-only policy is appropriate for your application.

## 2. Node.js and TypeScript application integration

The Node starter under `node/` uses the **actual installed**
`@zerynex/sdk` package. It reads only the two explicitly supplied
public-safe JSON files, checks the current metadata, compares per-flow risk
occurrences and emits rule IDs and counts or redacted SARIF.

After `v0.2.0` is reviewed and publicly published to npm:

```bash
cd node
npm install
node check.mjs ../fixtures/isolated.json ../fixtures/risky.json
node check.mjs ../fixtures/risky.json ../fixtures/isolated.json sarif
```

**Before registry publication**, obtain and verify the reviewed
`zerynex-sdk-0.2.0.tgz` from the corresponding GitHub Release or CI
artifact and install it locally from `node/` using
`npm install ./path/to/zerynex-sdk-0.2.0.tgz` instead. Do not assume
the older `v0.1.0` release contains the `v0.2.0` SDK APIs.

## 3. Python application integration

The Python starter under `python/` uses the separately installed
`zerynex-python` package with **strict local JSON parsing**.
From the starter root, after installing a verified version-`0.2.0`
wheel into your virtual environment:

```bash
python python/check.py fixtures/isolated.json fixtures/risky.json
python python/check.py fixtures/risky.json fixtures/isolated.json --sarif
```

After PyPI publication, `pip install -r python/requirements.txt`
can install the public release; until then install the vetted wheel by
its local filename. The wheel's PCZT features also require a separately
installed trusted Rust CLI, but **these metadata-only examples do not**.

## Expected results

For both languages, comparing `isolated.json` → `risky.json` must exit
**2** and report **8 newly declared risk events** across the five
known rule categories. Reversing the comparison must exit **0** (no new
events, previous declarations resolved). Invalid or unreadable input must
exit **1** and omit input contents. These behaviors are automatically
tested from the independently built SDK tarball and Python wheel.

The fixtures declare **logical test identifiers**, not actual Zcash
receiver strings. Passing checks validate selected metadata rules, **not**
shielded-transaction privacy, proof verification, viewing-key isolation,
settlement, consensus or future quantum resistance.

Further documentation: [installation](../../docs/installation.md),
[TypeScript API](../../docs/typescript-api.md),
[refund privacy audit](../../docs/refund-privacy-audit.md),
[release status](../../docs/releases.md), and
[maintainer publishing steps](../../docs/publishing.md).
