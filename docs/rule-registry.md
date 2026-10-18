# Versioned privacy-rule registry

Zerynex exposes a machine-readable, reviewed catalog of the **eight currently implemented** structural PCZT rules. The catalog is one definition of stable IDs, human-readable titles, severity, category, lifecycle scope, and concise summaries. It is **not** a list of all Zcash privacy vulnerabilities, a wallet certification, a transaction validator, or a guarantee of anonymity.

## Discover rules locally

```bash
zerynex --rule-catalog
```

The command requires no PCZT path or network connection, and cannot be combined with analysis options. Its JSON includes `schema_version: 1`, `tool: "zerynex"`, `rule_set_version: "1.0.0"`, an explicit `scope`, and a `rules` array.

Each record contains `id`, `title`, `severity`, `category`, `applies_to`, and `summary`. `severity` is a **tooling classification** (`warning` or `error`), not a CVSS security rating. `PCZT-STRUCTURE-DRIFT` is applicable to stage comparisons and is classified as `error`; the other rules represent reviewable structural/policy observations. Separately, the CLI's **exit code 2** still denotes any policy findings or regressions, even when a rule's severity is `warning`.

`--capabilities` now reports `rule_set_version` and `rule_catalog_schema_version`. Consumers should reject unsupported catalog schema versions. A compatible CLI can expose the catalog independently of any transaction.

## Use the same rule IDs in each integration

**TypeScript:**

```ts
import { RULE_CATALOG, getRule } from '@zerynex/sdk'
console.log(RULE_CATALOG.rule_set_version) // '1.0.0'
console.log(getRule('PCZT-TRANSPARENT-OUTPUTS')?.severity) // 'warning'
```

The npm SDK includes a generated, strongly typed `RuleId` type and `getRule`. The snapshot is bundled and does not require initializing Rust/WASM.

**Python:**

```python
from zerynex_py import ZerynexClient, bundled_rule_catalog

local = ZerynexClient(cli="/absolute/path/to/zerynex")
assert local.rule_catalog() == bundled_rule_catalog()
```

The Python SDK parses bounded catalog JSON from the *actual selected* local Rust executable. The bundled snapshot is provided for integrations that need static metadata; version mismatches should be reviewed, never assumed equivalent.

**MCP:** `zerynex_rule_catalog` verifies the local Rust metadata equals the installed Python SDK's reviewed snapshot before returning public rule definitions to an agent. Invalid or incompatible versions fail closed. The `explain_zerynex_rule` tool adds human guidance for the seven analysis rules, while the stage-only drift rule belongs to comparison results.

**SARIF:** Zerynex uses the Rust registry to construct `rules[]`, severities and human-readable descriptions; there is no separate hard-coded SARIF rule catalog.

## Conformance and change policy

The source of truth is `rules/catalog.json`, compiled into the canonical Rust library. Distributable SDK snapshots are generated using (the TypeScript and JavaScript source representations remain synchronized so direct-source bundlers such as Vercel can resolve NodeNext `.js` imports):

```bash
python3 scripts/sync-rule-catalog.py
python3 scripts/sync-rule-catalog.py --check
```

CI verifies both snapshots, the Rust finding IDs, the CLI's exported catalog and the installed SDK package tests. Introducing a rule means reviewing its metadata, adding a test vector, verifying that its detection is implemented, and intentionally updating the rule-set version if semantics change. Do not silently reassign an existing ID to a different meaning.

See [Reports](report-reference.md), [SARIF exports](sarif.md), [CLI capabilities](cli-capabilities.md), and [MCP agent integration](agents.md).

## Executable rule conformance vectors

Zerynex provides **eight deterministic, nonspendable PCZT binary fixtures** under `tests/fixtures/rules/`. They exercise transparent inputs, transparent metadata, restricted transparent outputs, Sapling policy and restricted-field checks, and Orchard dummy-key, metadata and output checks. Existing `clean-v6.bin`, `flagged-v6.bin` and `transparent-v6.bin` fixtures supply positive and negative baselines. The Orchard dummy-key vector uses an **all-zero synthetic sentinel**, not a wallet secret.

`tests/fixtures/rules/expectations.json` is the single, reviewed expected-output contract for **18 policy cases and seven stage transitions**. Each policy case specifies a fixture basename, policy profile, pool-deny settings and the exact expected rule IDs and field paths. Stage cases additionally specify introduced and resolved findings, topology changes, and pass/fail expectations.

From a local source checkout:

```bash
# Validate committed fixture bytes against the upstream PCZT generator.
cargo run --locked --example generate_rule_fixtures -- --check

# Exercise all fixtures through the real Rust CLI and SARIF exporter.
cargo test --locked --test rule_conformance

# Exercise the same expectations through the Python CLI adapter.
python3 -m unittest discover -s packages/python/tests -p test_rule_vectors.py

# Verify the real Rust/WASM engine in a clean external npm consumer.
node scripts/test-sdk-packed.mjs
```

The generator can be run without `--check` to deliberately regenerate the version-controlled binary fixtures. Verify every fixture and its expected finding before committing changes. CI verifies reproducible fixture bytes, exact Rust CLI JSON and SARIF output, Python SDK behavior and separately packed npm/WASM behavior. All rule IDs in the analysis registry must be exercised by at least one positive fixture; **`PCZT-STRUCTURE-DRIFT` is stage-only** and is checked through the shared stage cases.

This conformance suite tests Zerynex's current limited structural analysis and adapter parity. **It does not exercise real Zallet wallet RPC, create spendable transactions, validate proof/signature correctness or establish transaction equivalence.** Keep wallet credentials and private PCZT data out of fixtures, issues, CI artifacts and AI-assisted workflows.
