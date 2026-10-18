# Reports and error codes

Zerynex emits **sanitized policy findings**, not transaction values. Reports describe only implemented structural disclosure checks. The Rust CLI is the authoritative engine; TypeScript/WASM and the Python/Go adapters preserve its classifications.

## Analysis report

An analysis `--json` response contains:

```json
{
  "profile": "external_signer",
  "deny_transparent": true,
  "deny_sapling": false,
  "findings": [
    {"rule": "PCZT-TRANSPARENT-OUTPUTS", "field": "transparent.outputs", "explanation": "..."}
  ],
  "checked_pools": ["transparent", "sapling", "orchard", "ironwood"],
  "disclaimer": "Selected disclosure-policy checks only. Not a proof of anonymity, consensus validity, or safe signing."
}
```

The example is illustrative: its `explanation` is abbreviated, not an assertion that this is byte-for-byte executable output. `findings.length === 0` means the selected rules found no issue, **not** that a Zcash transaction is safe, anonymous, cryptographically valid, or authorized.

| Field | Type | Interpretation |
| --- | --- | --- |
| `profile` | string | Selected local disclosure role policy |
| `deny_transparent`, `deny_sapling` | boolean | Enabled application restrictions |
| `findings` | array | Entries with `rule`, `field`, `explanation` |
| `checked_pools` | string[] | Pools examined for implemented checks |
| `disclaimer` | string | Explicit limitations of the analysis |

## Rule identifiers

| Rule | Meaning |
| --- | --- |
| `PCZT-GLOBAL-METADATA` | Global proprietary metadata was present |
| `PCZT-UNREVIEWED-METADATA` | Unreviewed field-level proprietary metadata |
| `PCZT-DUMMY-KEY` | Accessible intermediate dummy spending key |
| `PCZT-RESTRICTED-DISCLOSURE` | Field forbidden by restricted handoff profile |
| `PCZT-TRANSPARENT-INPUTS` | Transparent inputs under a no-transparent policy |
| `PCZT-TRANSPARENT-OUTPUTS` | Transparent outputs under a no-transparent policy |
| `PCZT-SAPLING-POLICY` | Sapling component under a no-Sapling application policy |

Rule identifiers should be used for programmatic comparisons, not arbitrary prose matching.

For automated security tooling, use [SARIF exports](sarif.md) to produce rule IDs and **logical** PCZT field locations with no original input filename or physical source path. A policy failure still exits `2` when the report is written successfully.

## Stage comparison

When `--compare-with` is supplied, the report includes `before_findings_count`, `after_findings_count`, `added_findings`, `resolved_findings`, `component_deltas`, `no_new_findings`, `passed`, active policy fields, and a disclaimer. `component_deltas` report `component`, `before` and `after` counts. A passing stage comparison requires no new findings, no component-count changes, and no outstanding candidate policy findings.

For a developer example, see [PCZT stage regression](pczt-stage-regression.md).

## Fail closed in automation

| Surface | Success | Policy/regression failure | Input or runtime error |
| --- | --- | --- | --- |
| Rust CLI | `0` | `2` | `1` |
| Python `analyze_file` | `report.passed` | `False` | Raises `ZerynexError` |
| TypeScript `analyzeBlob` | Empty `findings` | One or more `findings` | Throws `ZerynexSdkError` |
| GitHub Action | `passed=true` output | `passed=false` output | Job/setup failure |

Do not interpret input errors, unavailable tooling, or an SDK exception as "no vulnerabilities". For versioned feature negotiation use [CLI capabilities](cli-capabilities.md). For upstream RPC changes use [RPC compatibility](rpc-contracts.md), whose rule IDs and output shape belong to a **separate RPC contract report**.
