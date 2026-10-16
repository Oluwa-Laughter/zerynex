import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createZerynexClient,
  exportPolicyJson,
  MAX_PCZT_BYTES,
  normalizePolicy,
  parsePolicyJson,
  ZerynexSdkError,
} from '../dist/index.js'

function fakeReport(policy) {
  return JSON.stringify({
    ...policy,
    findings: [],
    checked_pools: ['transparent', 'sapling', 'orchard', 'ironwood'],
    disclaimer: 'Limited policy checks',
  })
}

test('normalize policy rejects unknown or unsafe options', () => {
  assert.deepEqual(normalizePolicy(), {
    profile: 'external_signer',
    deny_transparent: false,
    deny_sapling: false,
  })
  assert.throws(() => normalizePolicy({ unknown_setting: true }), err => err.code === 'POLICY_INVALID')
  assert.throws(() => normalizePolicy({ deny_transparent: 'false' }), err => err.code === 'POLICY_INVALID')
  assert.match(exportPolicyJson({ deny_transparent: true }), /"deny_transparent": true/)
})

test('client is lazy, single-flight, and passes canonical policy to engine', async () => {
  let loads = 0
  let calls = 0
  const client = createZerynexClient({
    loadEngine: async () => {
      loads++
      return {
        analyze_pczt_policy(bytes, json) {
          calls++
          assert.equal(bytes.length, 4)
          const policy = JSON.parse(json)
          assert.equal(policy.deny_transparent, true)
          return fakeReport(policy)
        },
      }
    },
  })
  assert.equal(loads, 0)
  const [a, b] = await Promise.all([
    client.analyzeBytes(new Uint8Array([1, 2, 3, 4]), { deny_transparent: true }),
    client.analyzeBytes(new Uint8Array([1, 2, 3, 4]), { deny_transparent: true }),
  ])
  assert.equal(loads, 1)
  assert.equal(calls, 2)
  assert.equal(a.profile, 'external_signer')
  assert.deepEqual(a, b)
})

test('analyzeBlob processes data locally and preserves flags', async () => {
  const client = createZerynexClient({
    loadEngine: async () => ({ analyze_pczt_policy: (_, json) => fakeReport(JSON.parse(json)) }),
  })
  const report = await client.analyzeBlob(new Blob([Uint8Array.of(1, 2, 3)]), { deny_sapling: true })
  assert.equal(report.deny_sapling, true)
})

test('rejects empty and oversized PCZTs without initializing WASM', async () => {
  let count = 0
  const client = createZerynexClient({
    loadEngine: async () => {
      count++
      return { analyze_pczt_policy: () => '{}' }
    },
  })
  await assert.rejects(client.analyzeBytes(new Uint8Array()), err => err.code === 'INPUT_INVALID')
  await assert.rejects(client.analyzeBlob(new Blob([new Uint8Array(MAX_PCZT_BYTES + 1)])),
    err => err.code === 'INPUT_INVALID')
  assert.equal(count, 0)
})

test('never propagates WASM errors containing transaction secrets', async () => {
  const client = createZerynexClient({
    loadEngine: async () => ({
      analyze_pczt_policy: () => { throw new Error('private-spending-key-secret') },
    }),
  })
  await assert.rejects(client.analyzeBytes(Uint8Array.of(1)),
    err => err.code === 'ANALYSIS_FAILED' && !err.message.includes('private-spending-key-secret'))
})

test('invalid reports and failed loaders fail closed', async () => {
  const invalid = createZerynexClient({
    loadEngine: async () => ({ analyze_pczt_policy: () => '{"findings":"not-array"}' }),
  })
  await assert.rejects(invalid.analyzeBytes(Uint8Array.of(1)), err => err.code === 'REPORT_INVALID')

  let attempts = 0
  const retry = createZerynexClient({
    loadEngine: async () => {
      attempts++
      if (attempts === 1) throw new Error('temporary')
      return { analyze_pczt_policy: (_, json) => fakeReport(JSON.parse(json)) }
    },
  })
  await assert.rejects(retry.ready(), err => err.code === 'ENGINE_UNAVAILABLE')
  await retry.ready()
  assert.equal(attempts, 2)
})

test('SDK validates loader contract and input limits', () => {
  assert.throws(() => createZerynexClient({ loadEngine: null }), ZerynexSdkError)
  assert.throws(() => createZerynexClient({ loadEngine: async () => ({}), maxInputBytes: Infinity }),
    err => err.code === 'INPUT_INVALID')
})

test('imports strict JSON policy files without silently ignoring unknown fields', () => {
  const policy = parsePolicyJson('{"profile":"restricted_handoff","deny_transparent":true}')
  assert.deepEqual(policy, {
    profile: 'restricted_handoff',
    deny_transparent: true,
    deny_sapling: false,
  })
  assert.throws(() => parsePolicyJson('{"deny_tranparent":true}'), err => err.code === 'POLICY_INVALID')
  assert.throws(() => parsePolicyJson('[]'), err => err.code === 'POLICY_INVALID')
  assert.throws(() => parsePolicyJson('{not-json'), err => err.code === 'POLICY_INVALID')
  assert.throws(() => parsePolicyJson(' '.repeat(4097)), err => err.code === 'POLICY_INVALID')
})

const cleanStage = () => JSON.stringify({
  profile: 'external_signer',
  deny_transparent: false,
  deny_sapling: false,
  before_findings_count: 0,
  after_findings_count: 0,
  added_findings: [],
  resolved_findings: [],
  component_deltas: [],
  no_new_findings: true,
  passed: true,
  disclaimer: 'Limited structural regression test only',
})

test('SDK compares two local files against a Rust-backed stage interface', async () => {
  let calls = 0
  const client = createZerynexClient({
    loadEngine: async () => ({
      analyze_pczt_policy: () => '{}',
      compare_pczt_stages(before, after, policyJson) {
        calls++
        assert.equal(before.length, 3)
        assert.equal(after.length, 4)
        assert.equal(JSON.parse(policyJson).profile, 'external_signer')
        return cleanStage()
      },
    }),
  })
  const result = await client.compareStageBlobs(
    new Blob([Uint8Array.of(1, 2, 3)]),new Blob([Uint8Array.of(1, 2, 3, 4)]),
  )
  assert.equal(result.passed,true)
  assert.equal(calls,1)
})

test('SDK stage comparison fails closed on incomplete engine or forged JSON reports', async () => {
  const incomplete = createZerynexClient({
    loadEngine: async () => ({ analyze_pczt_policy: () => '{}' }),
  })
  await assert.rejects(
    incomplete.compareStages(Uint8Array.of(1),Uint8Array.of(2)),
    err => err.code === 'ENGINE_UNAVAILABLE',
  )
  const forged = createZerynexClient({
    loadEngine: async () => ({
      analyze_pczt_policy:()=> '{}',
      compare_pczt_stages:()=> JSON.stringify({
        ...JSON.parse(cleanStage()), passed:true, after_findings_count:1,
      }),
    }),
  })
  await assert.rejects(
    forged.compareStages(Uint8Array.of(1),Uint8Array.of(2)),
    err => err.code === 'REPORT_INVALID',
  )
})

test('SDK stage comparison never propagates exceptions with transaction bytes', async () => {
  const client = createZerynexClient({
    loadEngine: async () => ({
      analyze_pczt_policy:()=> '{}',
      compare_pczt_stages:()=> {throw Error('FAKE_PRIVATE_PCZT_DATA')}
    }),
  })
  await assert.rejects(
    client.compareStages(Uint8Array.of(1),Uint8Array.of(2)),
    err => err.code === 'ANALYSIS_FAILED' && !err.message.includes('FAKE_PRIVATE_PCZT_DATA'),
  )
  await assert.rejects(
    client.compareStageBlobs(new Blob([]),new Blob([1])),
    err => err.code === 'INPUT_INVALID',
  )
})
