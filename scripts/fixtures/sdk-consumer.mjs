import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createBrowserZerynexClient, inspectZip321Uri, createBrowserWalletHandoff, createZip321UriProvider } from '@zerynex/sdk/browser'
import { normalizePolicy, RULE_CATALOG, getRule, evaluateZcashNodeStatus } from '@zerynex/sdk'

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
// This is intentionally the same independent vector manifest as Rust CLI
// and Python SDK conformance; not a browser-local snapshot.
const vectors = JSON.parse(await readFile('rule-expectations.json', 'utf8'))
assert.equal(vectors.schema_version, 1)
assert.equal(vectors.rule_set_version, RULE_CATALOG.rule_set_version)
assert.equal(vectors.cases.length, 18)
const covered = new Set()
for (const scenario of vectors.cases) {
  const bytes = new Uint8Array(await readFile(scenario.fixture))
  const result = await client.analyzeBytes(bytes, {
    profile: scenario.profile,
    deny_transparent: scenario.deny_transparent,
    deny_sapling: scenario.deny_sapling,
  })
  assert.deepEqual(result.findings.map(item => ({rule: item.rule, field: item.field})),
    scenario.findings, 'Rule mismatch: ' + scenario.fixture)
  assert.equal(result.findings.length === 0, scenario.findings.length === 0)
  for (const item of result.findings) covered.add(item.rule)
  assert.doesNotMatch(JSON.stringify(result), /synthetic-marker|example-synthetic-not-a-real-address/)
}
assert.deepEqual([...covered].sort(), RULE_CATALOG.rules.filter(rule =>
  rule.applies_to.includes('analysis')).map(rule => rule.id).sort())
for (const scenario of vectors.stage_cases) {
  const before = new Uint8Array(await readFile(scenario.before))
  const after = new Uint8Array(await readFile(scenario.after))
  const outcome = await client.compareStages(before, after, {
    profile: scenario.profile,
    deny_transparent: scenario.deny_transparent,
    deny_sapling: scenario.deny_sapling,
  })
  for (const field of ['added_findings', 'resolved_findings', 'component_deltas', 'no_new_findings', 'passed']) {
    assert.deepEqual(outcome[field], scenario[field], 'Stage mismatch: ' + scenario.name + '/' + field)
  }
  assert.doesNotMatch(JSON.stringify(outcome), /synthetic-marker|example-synthetic-not-a-real-address/)
}
console.log('PACKED STAGE CONFORMANCE PASS: 7 stage regressions match canonical Rust and Python')
console.log('PACKED RULE CONFORMANCE PASS: 18 PCZT policy vectors match Rust CLI and Python contract')
const nodeVectors = JSON.parse(await readFile('node-readiness.json', 'utf8'))
for (const vector of nodeVectors.cases) {
  const readiness = evaluateZcashNodeStatus(vector.result, {expectedNetwork: vector.expected_network})
  assert.equal(readiness.ready, vector.ready, vector.name)
  assert.deepEqual(readiness.checks.map(x => x.status), vector.codes, vector.name)
  assert.doesNotMatch(JSON.stringify(readiness), /DO_NOT_LEAK_PRIVATE_MARKER|bestblockhash|valuePools/)
}
console.log('PACKED NODE READINESS PASS: all 9 Zebra/zcashd readiness vectors in a clean npm consumer')
// Official ZIP-321 testnet payment example, parsed by the same Rust/WASM core.
const payUri='zcash:ztestsapling10yy2ex5dcqkclhc7z7yrnjq2z6feyjad56ptwlfgmy77dmaqqrl9gyhprdx59qgmsnyfska2kez?amount=1&memo=VGhpcyBpcyBhIHNpbXBsZSBtZW1vLg&message=Thank%20you%20for%20your%20purchase'
const request=await inspectZip321Uri(payUri,'test',{wasm})
assert.equal(request.payments.length,1)
assert.equal(request.payments[0].amount_zat,100_000_000)
assert.equal(request.payments[0].memo_present,true)
assert.equal(request.total_zat,100_000_000)
assert.doesNotMatch(JSON.stringify(request), /ztestsapling|Thank%20you|VGhpcy|private/)
await assert.rejects(inspectZip321Uri(payUri,'main',{wasm}),/ZIP-321 input rejected/)
await assert.rejects(inspectZip321Uri(payUri+'&req-wallet-sign=1','test',{wasm}),/ZIP-321 input rejected/)

const openedWalletUris = []
const uriProvider = createZip321UriProvider({
  network: 'test',
  supports_memos: true,
  openUri: uri => { openedWalletUris.push(uri) },
})
const handoff = createBrowserWalletHandoff(uriProvider, {wasm})
const ticket = await handoff.prepare(payUri, {
  expected_network:'test', expected_total_zat:100_000_000,
  allow_memos:true,
})
assert.equal(ticket.payment_count,1)
assert.equal(openedWalletUris.length,0)
assert.doesNotMatch(JSON.stringify(ticket),/ztestsapling|Thank|VGhpcy/)
const presented = await handoff.handoff(ticket, async () => true)
assert.equal(presented.status, 'presented')
assert.deepEqual(openedWalletUris,[payUri])
assert.doesNotMatch(JSON.stringify(presented),/zcash:|ztestsapling|VGhpcy/)
await assert.rejects(handoff.handoff(ticket, async () => true), error => error.code === 'TICKET_INVALID')
console.log('PACKED WALLET HANDOFF PASS: canonical Rust/WASM preflight, policy, consent, and one-use ticket')
console.log('PACKED ZIP-321 PASS: real Rust/WASM payment-request checks, redacted output')
console.log('PACKED SDK CONSUMER PASS: real Rust/WASM scanner and stage comparison, no monorepo')
