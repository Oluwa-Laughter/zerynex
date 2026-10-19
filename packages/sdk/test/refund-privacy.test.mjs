import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {auditRefundPrivacy, compareRefundPrivacy, refundSarifReport, REFUND_RULE_IDS} from '../dist/index.js'
import {auditRefundPrivacy as sourceAudit,compareRefundPrivacy as sourceCompare} from '../src/refund-privacy.js'
const read = name => JSON.parse(readFileSync(new URL('../../../tests/fixtures/swap-refund/'+name+'.json',import.meta.url),'utf8'))
const safe=read('isolated'), risky=read('risky'), expanded=read('regression-expanded')

test('Zcash refund privacy audit matches the shared Python fixture expectations and source JS',()=>{
  const expected=[['isolated',safe,true,0,[]],['risky',risky,false,5,REFUND_RULE_IDS],
    ['regression-expanded',expanded,false,5,REFUND_RULE_IDS]]
  for(const [name,manifest,passed,count,rules] of expected){
    const result=auditRefundPrivacy(manifest)
    assert.equal(result.passed,passed,name)
    assert.equal(result.finding_count,count,name)
    assert.deepEqual(result.rule_ids,[...rules].sort(),name)
    assert.deepEqual(sourceAudit(manifest),result,name+' source')
    assert.equal(result.status,'declaration_review_only')
    assert.equal(result.schema_version,1)
    assert.doesNotMatch(JSON.stringify(result),/11111111111111111111111111111111|22222222222222222222222222222222|refund_address_ref/)
  }
})

test('new risk events are counted per stable synthetic flow even for existing rule IDs',()=>{
  const forward=compareRefundPrivacy(safe,risky)
  assert.equal(forward.new_risk_events,8)
  assert.equal(forward.resolved_risk_events,0)
  assert.equal(forward.passed,false)
  assert.deepEqual(sourceCompare(safe,risky),forward)
  const append=compareRefundPrivacy(risky,expanded)
  assert.equal(append.new_risk_events,1)
  assert.deepEqual(append.new_rule_ids,['SWAP-REFUND-LOOKUP-DISCLOSURE'])
  assert.equal(append.baseline_risk_events,8)
  assert.equal(append.current_risk_events,9)
  const fixed=compareRefundPrivacy(risky,safe)
  assert.equal(fixed.passed,true)
  assert.equal(fixed.new_risk_events,0)
  assert.equal(fixed.resolved_risk_events,8)
  assert.equal(compareRefundPrivacy(risky, {schema_version:1, flows:[...risky.flows].reverse()}).new_risk_events,0)
  assert.doesNotMatch(JSON.stringify(append),/44444444444444444444444444444444|viewing_scope_ref|refund_address_ref/)
})

test('raw Zcash addresses, unknown metadata, duplicate logical flows and invalid booleans fail closed',()=>{
  const copy = () => JSON.parse(JSON.stringify(safe))
  const invalid = [null,[],{},'private-key',23,{schema_version:1,flows:[]},
    {schema_version:true,flows:safe.flows},{schema_version:1,flows:Array(101).fill(safe.flows[0])}]
  for(const mutation of [
    m=>{m.flows[0].refund_address_ref='u1INVALID_ADDRESS'},
    m=>{m.flows[0].viewing_scope_ref='not-a-key'},
    m=>{m.flows[0].published_publicly=1},
    m=>{m.flows[0].lookup_mode='quantum_safe'},
    m=>{m.flows[0].spending_key_custody=null},
    m=>{m.flows[1].flow_ref=m.flows[0].flow_ref},
    m=>{m.flows[0].wallet_seed='NEVER_ECHO'},
    m=>{m.extra='NEVER_ECHO'},
  ]){const m=copy();mutation(m);invalid.push(m)}
  for(const value of invalid){
    assert.throws(()=>auditRefundPrivacy(value),TypeError)
    assert.throws(()=>compareRefundPrivacy(safe,value),TypeError)
  }
})

test('SARIF summaries never expose wallet references, file names or source locations',()=>{
  const single=refundSarifReport(auditRefundPrivacy(risky))
  assert.equal(single.version,'2.1.0')
  assert.equal(single.runs[0].results.length,5)
  const change=refundSarifReport(compareRefundPrivacy(risky,expanded))
  assert.deepEqual(change.runs[0].results.map(x=>x.ruleId),['SWAP-REFUND-LOOKUP-DISCLOSURE'])
  assert.equal(change.runs[0].properties.noInputLocations,true)
  assert.ok(change.runs[0].results.every(result=>!('locations' in result)))
  assert.equal(refundSarifReport(compareRefundPrivacy(risky,safe)).runs[0].results.length,0)
  assert.doesNotMatch(JSON.stringify(single)+JSON.stringify(change),/22222222222222222222222222222222|refund_address_ref|flow_ref|private-key/)
})
