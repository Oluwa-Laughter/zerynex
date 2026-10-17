# Offline Zcash RPC contract checks

Zerynex includes an **early, offline OpenRPC contract checker** for wallet
and infrastructure developers. It is not an RPC client, remote scanner,
live Zallet compatibility guarantee, or replacement for Zallet.

The official [Zallet RPC reference](https://zcash.github.io/zallet/rpc/index.html)
documents a machine-readable schema through the rpc.discover method.
Zallet is beta software, and its RPC interface can change.

## Check a local OpenRPC contract

    python3 scripts/check_rpc_contract.py --schema tests/fixtures/rpc/zallet-synthetic-openrpc.json --contract tests/fixtures/rpc/zallet-minimum-contract.json --json

Exit status: 0 contract satisfied, 2 missing/changed declarations,
1 input error. The sample OpenRPC description is **hand-authored synthetic
documentation**, not captured from a released Zallet binary.

## Saved Zallet `rpc.discover` results (offline)

Zerynex now accepts either the **bare OpenRPC schema** or a locally saved
**JSON-RPC 2.0 `rpc.discover` response** as `--schema`. The latter must have
exactly `jsonrpc`, `id`, and `result` fields, with `result` containing
the OpenRPC document. RPC errors, duplicate JSON keys, invalid IDs and
unexpected fields are rejected without copying payload contents into error output.

Try the **synthetic** saved response, which is not evidence of compatibility
with a real Zallet build:

```bash
python3 scripts/check_rpc_contract.py \
  --schema tests/fixtures/rpc/zallet-synthetic-discover-response.json \
  --contract tests/fixtures/rpc/zallet-minimum-contract.json --json
```

For a real integration, obtain `rpc.discover` only from a locally controlled,
trusted wallet instance. Store the resulting schema in a protected path outside
public CI, record the exact Zallet binary version and source commit, and
compare against your reviewed contract. **Do not upload wallet configuration,
authentication cookies, real PCZTs, or sensitive RPC responses.** The checker
makes no network connection and does not verify runtime Zallet behavior.

## Complete synthetic PCZT lifecycle contract

Zerynex provides a **reviewable, documentation-derived** baseline for Zallet's
six PCZT RPC methods: `pczt_create`, `pczt_combine`, `pczt_inspect`,
`pczt_prove`, `pczt_sign`, and `pczt_extract`, plus `rpc.discover`. It
checks method existence, ordered parameter names, and required/optional
flags. This expands the smaller historical four-method example.

```bash
python3 scripts/check_rpc_contract.py \
  --schema tests/fixtures/rpc/zallet-pczt-lifecycle-synthetic-openrpc.json \
  --contract tests/fixtures/rpc/zallet-pczt-lifecycle-contract.json \
  --deny-new-required --json
```

For a locally saved OpenRPC discovery response from **your own trusted
Zallet environment**, replace `--schema` with its protected local path.
The `--deny-new-required` option flags newly required parameters on covered
methods (`RPC-NEW-REQUIRED-PARAMETER`), which are otherwise allowed for
backwards compatibility. Adding an optional parameter remains permitted.
The JSON result explicitly identifies whether strict checking was enabled.

The bundled fixtures are **synthetic**, based on the published Zallet RPC
reference reviewed on October 17, 2026; they are **not** a pinned release's
actual generated `rpc.discover` schema or proof of live interoperability.
An integration can only claim tested support after validating a specific
upstream release binary and matching real, non-sensitive schema output.
The checker never calls the wallet, signs, proves or extracts transactions.

## Release-pinned upstream evidence: Zallet v0.1.0-beta.3

On October 17, 2026, Zerynex checked the seven covered method signatures
against **Zallet `v0.1.0-beta.3`**, at source commit
`987382f67e622915228686e9f956c6a9c9a7514c`.
The source is Zallet's **generated RPC reference**, not Zerynex's
handwritten synthetic fixture. Zallet ships tests tying that book reference
to its RPC method declarations. The source SHA-256 is pinned in
`tests/fixtures/rpc/zallet-v0.1.0-beta.3-provenance.json`.

Retrieve only that public, immutable upstream reference and verify it:

```bash
curl -fsSL \
  https://raw.githubusercontent.com/zcash/zallet/987382f67e622915228686e9f956c6a9c9a7514c/book/src/rpc/methods.md \
  -o /tmp/zallet-v0.1.0-beta.3-methods.md
python3 scripts/verify_zallet_upstream_contract.py \
  --source /tmp/zallet-v0.1.0-beta.3-methods.md --json
```

The verifier rejects incorrect bytes, repeated/missing methods, unexpected
required flags, changed parameter order, nested recipient field confusion,
and a narrowed local contract. Its tests include positive and negative
cases; CI runs the real pinned comparison on every push. It makes **no
RPC or wallet call** and never echoes upstream document contents.

**Verified:** Release-pinned documentation-level method names, parameter
order and required/optional flags, including `rpc.discover` and six PCZT
methods. **Not verified:** A running release binary's generated
`rpc.discover`, exact runtime behavior, base64 PCZTs created/proven/signed
by Zallet, wallet permissions, proofs, or transaction extraction. These
are separate compatibility milestones; do not call this a live Zallet
integration.

## Installable CLI for external Python projects

The `zerynex-python` wheel includes `zerynex-rpc-check` as a command-line
entry point (no Rust executable or wallet required for structural checks).
Until the package has been published to PyPI, install it from this
repository or from a verified wheel artifact:

```bash
python -m pip install ./packages/python
zerynex-rpc-check --schema tests/fixtures/rpc/zallet-pczt-lifecycle-synthetic-openrpc.json --contract tests/fixtures/rpc/zallet-pczt-lifecycle-contract.json --deny-new-required --json
```

The repository script `python3 scripts/check_rpc_contract.py` delegates to
the same Python SDK implementation. A separately built wheel is tested in
an unrelated virtual environment before a release is considered usable.

## Usage

Contracts list method names and ordered parameters, with a required flag.
Additional methods are accepted; optional new parameters are also accepted.
When strict additive checking is enabled, newly required parameters are reported.
All evaluation is local: no RPC URL,
credentials, cookies, wallet keys or network calls are necessary.

File reads reject symlinks and non-regular files; on POSIX they also
prevent symlink substitutions during opening. Size limits apply to the
opened file descriptor. The output contains only declared method/parameter names and their status.
It does not print RPC request/response values.

## Limitations

This tool does not test parameter types, runtime semantics, signing,
authorization, network configuration, proof validity, RPC connectivity or
consensus. Before claiming compatibility with a real Zallet release,
review and test its pinned upstream OpenRPC schema. Read the
[Zallet migration guide](https://github.com/zcash/zallet/blob/main/book/src/zcashd/json_rpc.md).
