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
