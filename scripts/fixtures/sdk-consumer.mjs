import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createBrowserZerynexClient } from '@zerynex/sdk/browser'
import { normalizePolicy, RULE_CATALOG, getRule } from '@zerynex/sdk'

assert.equal(normalizePolicy({ deny_transparent: true }).deny_transparent, true)
assert.equal(RULE_CATALOG.schema_version, 1)
assert.equal(RULE_CATALOG.rule_set_version, '1.0.0')
assert.equal(RULE_CATALOG.rules.length, 8)
assert.equal(getRule('PCZT-STRUCTURE-DRIFT')?.severity, 'error')
assert.equal(getRule('unknown_from_consumer'), undefined)
const wasm = new Uint8Array(await readFile(fileURLToPath(
  import.meta.resolve('@zerynex/sdk/wasm/zerynex_bg.wasm')
)))
assert.ok(wasm.length > 1000, 'Bundled real wasm binary expected')
const client = createBrowserZerynexClient({ wasm })
const clean = new Uint8Array(await readFile('clean-v6.bin'))
const transparent = new Uint8Array(await readFile('transparent-v6.bin'))
const flagged = new Uint8Array(await readFile('flagged-v6.bin'))
const policy = { deny_transparent: true }
const passed = await client.analyzeBytes(clean, policy)
assert.equal(passed.findings.length, 0)
const report = await client.analyzeBytes(transparent, policy)
assert.ok(report.findings.some(item =>
  item.rule === 'PCZT-TRANSPARENT-OUTPUTS' && item.field === 'transparent.outputs'
))
const comparison = await client.compareStages(clean, flagged, policy)
assert.equal(comparison.no_new_findings, false)
assert.ok(comparison.added_findings.some(item => item.rule === 'PCZT-GLOBAL-METADATA'))
await assert.rejects(client.analyzeBytes(Uint8Array.of(1,2,3)), error =>
  error.code === 'ANALYSIS_FAILED' && !error.message.includes('secret-spending-key'))
console.log('PACKED SDK CONSUMER PASS: real Rust/WASM scanner and stage comparison, no monorepo')
