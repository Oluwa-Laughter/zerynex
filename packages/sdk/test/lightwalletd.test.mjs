import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateLightwalletdInfo, evaluateLightwalletdJson } from '../dist/index.js'
import { evaluateLightwalletdInfo as sourceEvaluator } from '../src/lightwalletd.js'

const base = Object.freeze({
  version: 'PRIVATE_SERVER_BUILD', vendor: 'PRIVATE_PROVIDER',
  chainName: 'test', blockHeight: '3100000', estimatedHeight: '3100002',
  saplingActivationHeight: '280000', consensusBranchId: 'c2d6d0b4',
  donationAddress: 'PRIVATE_ADDRESS', gitCommit: 'PRIVATE_COMMIT',
})

const cases = [
  {name:'ready at lag limit', data:base, ready:true, statuses:['pass','pass','pass','pass','pass']},
  {name:'network mismatch', data:{...base,chainName:'main'}, ready:false, statuses:['fail','pass','pass','pass','pass']},
  {name:'lag greater than policy', data:{...base,estimatedHeight:'3100003'}, ready:false, statuses:['pass','pass','pass','fail','pass']},
  {name:'missing estimate', data:{...base,estimatedHeight:undefined}, ready:false, statuses:['pass','pass','pass','unknown','pass']},
  {name:'proto3 zero estimate is unknown', data:{...base,estimatedHeight:'0'}, ready:false, statuses:['pass','pass','pass','unknown','pass']},
  {name:'below Sapling activation', data:{...base,blockHeight:'200000'}, ready:false, statuses:['pass','pass','fail','fail','pass']},
  {name:'missing branch ID', data:{...base,consensusBranchId:null}, ready:false, statuses:['pass','pass','pass','pass','unknown']},
  {name:'estimate lower than best chain', data:{...base,estimatedHeight:'3099999'}, ready:true, statuses:['pass','pass','pass','pass','pass']},
  {name:'unsafe uint64 string', data:{...base,blockHeight:'99999999999999999'}, ready:false, statuses:['pass','unknown','unknown','unknown','pass']},
]

test('lightwalletd metadata checks use the same pure code in source and installed SDK', () => {
  for(const item of cases) {
    const options={expectedNetwork:'test'}
    const result=evaluateLightwalletdInfo(item.data,options)
    assert.deepEqual(sourceEvaluator(item.data,options),result,item.name)
    assert.equal(result.ready,item.ready,item.name)
    assert.deepEqual(result.checks.map(check=>check.status),item.statuses,item.name)
    assert.doesNotMatch(JSON.stringify(result),/PRIVATE_SERVER_BUILD|PRIVATE_PROVIDER|PRIVATE_ADDRESS|PRIVATE_COMMIT|c2d6d0b4/)
  }
})
test('lightwalletd evaluator fails closed on malformed options and malicious getters', () => {
  for(const input of [null,[],0,'PRIVATE_ADDRESS']) assert.throws(()=>evaluateLightwalletdInfo(input),TypeError)
  for(const options of [{expectedNetwork:'wrong'},{maxHeightLag:-1},{maxHeightLag:NaN},
                         {maxHeightLag:1001},{maxHeightLag:1.1},null])
    assert.throws(()=>evaluateLightwalletdInfo(base,options),TypeError)
  const malicious=Object.defineProperty({...base},'chainName',{get(){throw new Error('PRIVATE_KEY')}})
  assert.throws(()=>evaluateLightwalletdInfo(malicious),
    error=>error instanceof TypeError&&!error.message.includes('PRIVATE_KEY'))
  assert.equal(evaluateLightwalletdInfo({...base,blockHeight:3100000,estimatedHeight:3100002}).ready,true)
})

test('raw GetLightdInfo JSON is bounded, duplicate-aware and never reflects secrets', () => {
  const clean = JSON.stringify({...base,donationAddress:'DO_NOT_DISCLOSE'})
  const result = evaluateLightwalletdJson(clean)
  assert.equal(result.ready, true)
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_DISCLOSE|PRIVATE/)
  for (const hostile of [
    '{"chainName":"test","chainName":"main"}',
    '{"chainName":"test","\\u0063hainName":"main"}',
    '{"chainName":"test","extra":{"secret":"a","secret":"b"}}',
    JSON.stringify({...base,consensusBranchId:'DO_NOT_DISCLOSE'}).repeat(5000),
    'not JSON',
  ]) {
    assert.throws(() => evaluateLightwalletdJson(hostile), error =>
      error instanceof TypeError && !error.message.includes(hostile))
  }
})
