import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateZcashNodeStatus } from '../dist/index.js'
import { evaluateZcashNodeStatus as sourceEvaluator } from '../src/network.js'
const vectors = JSON.parse(readFileSync(new URL('../../../tests/fixtures/node/chain-readiness.json', import.meta.url)))

test('shared Zebra/zcashd normalization vectors reject mismatched or incomplete nodes', () => {
  assert.equal(vectors.schema_version, 1)
  for (const vector of vectors.cases) {
    const result = evaluateZcashNodeStatus(vector.result, {expectedNetwork: vector.expected_network})
    assert.deepEqual(sourceEvaluator(vector.result, {expectedNetwork: vector.expected_network}), result,
      'Source-level and published SDK must agree: ' + vector.name)
    assert.equal(result.ready, vector.ready, vector.name)
    assert.deepEqual(result.checks.map(x=>x.status), vector.codes, vector.name)
    assert.equal(result.expected_network, vector.expected_network, vector.name)
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LEAK_PRIVATE_MARKER|bestblockhash|valuePools|Authorization/)
  }
})

test('node normalizer is local and rejects malicious options or invalid RPC result', () => {
  for (const value of [null, [], 'wallet-secret', false, 10])
    assert.throws(() => evaluateZcashNodeStatus(value), TypeError)
  for (const options of [{expectedNetwork:'unknown'}, {maxHeaderLag:-1}, {maxHeaderLag:Infinity},
    {maxHeaderLag:1.5}, {minVerificationProgress:NaN}, {minVerificationProgress:2}])
    assert.throws(() => evaluateZcashNodeStatus({}, options), TypeError)
})
