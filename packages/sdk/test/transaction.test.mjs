import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateZcashTransaction, createZcashTransactionObserver } from '../dist/index.js'
import { evaluateZcashTransaction as evaluateSourceTransaction } from '../src/transaction.js'
const vectors=JSON.parse(readFileSync(new URL('../../../tests/fixtures/transactions/rpc-observations.json',import.meta.url)))
const hex=c=>c.repeat(64)

test('read-only transaction observer matches shared public-RPC synthetic cases, excluding sensitive fields',()=>{
  assert.equal(vectors.schema_version,1)
  for(const v of vectors.cases){
    const observation=evaluateZcashTransaction(v.transaction,v.chain,v.policy??vectors.policy)
    assert.equal(observation.state,v.expected_state,v.name)
    assert.deepEqual(evaluateSourceTransaction(v.transaction,v.chain,v.policy??vectors.policy),observation,'Vercel source and packaged npm output differ: '+v.name)
    assert.equal(observation.confirmation_target_met,v.expected_state==='confirmation_target_met',v.name)
    assert.deepEqual(observation.checks.map(x=>x.code),[
      'NETWORK_MATCH','TRANSACTION_ID','CHAIN_HEIGHT','CONFIRMATION_CONSISTENCY','ACTIVE_CHAIN','CONFIRMATION_TARGET'])
    assert.doesNotMatch(JSON.stringify(observation),/DO_NOT_LEAK_PRIVATE_MARKER|bestblockhash|blockhash|txid|address|vin|vout|nonce/i,v.name)
  }
})

test('wrong policy types never silently select a network, transaction ID, or confirmation threshold',()=>{
  const cases=[null,{},[],{...vectors.policy,expectedNetwork:'unknown'},
    {...vectors.policy,expectedTxid:'invalid'}, {...vectors.policy,requiredConfirmations:0},
    {...vectors.policy,requiredConfirmations:'6'}, {...vectors.policy,requiredConfirmations:10001},
    {...vectors.policy,requiredConfirmations:1.5}, {...vectors.policy,unexpectedFlag:true},
    {...vectors.policy,requiredConfirmations:Infinity}]
  for(const policy of cases)assert.throws(()=>evaluateZcashTransaction(null,{},policy),TypeError)
  for(const value of ['serialized-hex',[],false])
    assert.throws(()=>evaluateZcashTransaction(value,{},vectors.policy),TypeError)
  for(const value of [null,0,'not an object',[]])
    assert.throws(()=>evaluateZcashTransaction(null,value,vectors.policy),TypeError)
})

test('transaction identity and confirmation target are both required',()=>{
  const chain={chain:'test',blocks:30}
  const tx={txid:hex('a'),confirmations:1,height:30,blockhash:hex('b')}
  const opts={expectedNetwork:'test',expectedTxid:hex('a'),requiredConfirmations:3}
  assert.equal(evaluateZcashTransaction(tx,chain,opts).state,'confirming')
  assert.equal(evaluateZcashTransaction({...tx,confirmations:3}, {...chain,blocks:32},opts).state,'confirmation_target_met')
  assert.equal(evaluateZcashTransaction({...tx,confirmations:3,txid:hex('c')}, {...chain,blocks:32},opts).state,'inconsistent')
})

test('reorg hints flag disappearance, reduced confirmations, or changed inclusion block',()=>{
  const observer=createZcashTransactionObserver({...vectors.policy,requiredConfirmations:2})
  const tx={txid:hex('a'),confirmations:2,blockhash:hex('b'),height:101}
  const chain={chain:'test',blocks:102}
  const first=observer.observe(tx,chain)
  assert.equal(first.observation.confirmation_target_met,true)
  assert.equal(first.possible_reorg,false)
  const next=observer.observe({...tx,confirmations:3}, {...chain,blocks:103})
  assert.equal(next.state_changed,false)
  assert.equal(next.possible_reorg,false)
  const moved=observer.observe({...tx,blockhash:hex('c')},chain)
  assert.equal(moved.possible_reorg,true)
  assert.equal(moved.state_changed,false)
  assert.doesNotMatch(JSON.stringify(moved),/[a-f0-9]{64}|blockhash|txid|DO_NOT_LEAK/i)
  const orphan=observer.observe({txid:hex('a'),confirmations:-1,blockhash:hex('c'),in_active_chain:false},chain)
  assert.equal(orphan.possible_reorg,true)
  assert.equal(orphan.state_changed,true)
  assert.equal(orphan.observation.state,'orphaned')
  observer.reset()
  assert.equal(observer.observe(tx,chain).previous_state,null)
})

test('missing historical lookup is unavailable, never proof of absence or payment failure',()=>{
  const value=evaluateZcashTransaction(null,{chain:'test',blocks:200},vectors.policy)
  assert.equal(value.state,'unavailable')
  assert.equal(value.confirmation_target_met,false)
  assert.match(value.limitation,/txindex/i)
})
