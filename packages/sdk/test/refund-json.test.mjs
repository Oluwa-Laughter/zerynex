import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {parseRefundPrivacyJson,auditRefundPrivacyJson,compareRefundPrivacyJson} from '../dist/index.js'
const fixture=name=>readFileSync(new URL('../../../tests/fixtures/swap-refund/'+name+'.json',import.meta.url),'utf8')
const cli=new URL('../bin/refund-check.mjs',import.meta.url)
const isolated=fixture('isolated'),risky=fixture('risky'),expanded=fixture('regression-expanded')

test('strict JSON input matches Python-vetted synthetic fixtures and their regression events',()=>{
 assert.equal(parseRefundPrivacyJson(isolated).flows.length,2)
 assert.equal(auditRefundPrivacyJson(isolated).passed,true)
 assert.deepEqual(auditRefundPrivacyJson(risky).rule_ids,[
  'SWAP-PUBLIC-REFUND-UNSCOPED','SWAP-REFUND-ADDRESS-REUSE',
  'SWAP-REFUND-LOOKUP-DISCLOSURE','SWAP-SPENDING-KEY-CUSTODY-UNVERIFIED','SWAP-VIEWING-SCOPE-REUSE'])
 assert.equal(compareRefundPrivacyJson(isolated,risky).new_risk_events,8)
 assert.equal(compareRefundPrivacyJson(risky,expanded).new_risk_events,1)
 assert.equal(compareRefundPrivacyJson(risky,isolated).resolved_risk_events,8)
})

test('duplicate raw JSON members, even escaped-equivalent keys, fail closed at all depths',()=>{
 const insert=(value,find,replacement)=>value.replace(find,replacement)
 const samples=[
  '{"schema_version":1,"schema_version":1,"flows":[]}',
  '{"schema_version":1,"\\u0066lows":[],"flows":[]}',
  insert(isolated,'"flow_ref":','"flow_ref":"00000000000000000000000000000000","flow_ref":'),
  insert(isolated,'"flow_ref":','"\\u0066low_ref":"00000000000000000000000000000000","flow_ref":'),
  insert(isolated,'"lookup_mode":','"lookup_mode":"unknown","lookup_mode":'),
  insert(isolated,'"flows": [','"flows": [ {"x":1,"x":2},'),
 ]
 for(const raw of samples){
  assert.throws(()=>parseRefundPrivacyJson(raw),TypeError)
  assert.throws(()=>compareRefundPrivacyJson(isolated,raw),TypeError)
 }
})

test('malformed unicode, non-JSON tokens, depth attacks and oversized UTF-8 are rejected',()=>{
 const inputs=['',null,'{}','{"flows":[',isolated+',',isolated+'{}',
  '{"a":NaN}', '{"a":"\\x01"}', '{"a":"\\u00ZZ"}', '{"a":01}',
  '{"a":true,}', '{"a":}', '{"a":[,]}', '{"a":"line\nfeed"}',
  '['.repeat(30)+'0'+']'.repeat(30),
  isolated+' '.repeat(65536),
  isolated+'é'.repeat(32768),
  JSON.stringify({schema_version:1,flows:[{spending_key:'private'}]}),
 ]
 for(const raw of inputs)assert.throws(()=>parseRefundPrivacyJson(raw),TypeError)
})

test('CLI runs the actual shipped Node implementation and preserves sanitized exit statuses',()=>{
 const run=(args)=>spawnSync(process.execPath,[cli.pathname,...args],{encoding:'utf8',timeout:10000})
 const root=mkdtempSync(join(tmpdir(),'zcash-refund-test-'))
 try{
  for(const [name,contents] of [['safe',isolated],['risky',risky],['expanded',expanded]])writeFileSync(join(root,name+'.json'),contents)
  const safe=run(['--manifest',join(root,'safe.json'),'--json'])
  assert.equal(safe.status,0,safe.stderr)
  assert.equal(JSON.parse(safe.stdout).passed,true)
  const flagged=run(['--manifest',join(root,'risky.json'),'--json'])
  assert.equal(flagged.status,2,flagged.stderr)
  assert.equal(JSON.parse(flagged.stdout).finding_count,5)
  const added=run(['--baseline',join(root,'risky.json'),'--manifest',join(root,'expanded.json'),'--json'])
  assert.equal(added.status,2,added.stderr)
  assert.deepEqual(JSON.parse(added.stdout).new_rule_ids,['SWAP-REFUND-LOOKUP-DISCLOSURE'])
  const sarif=run(['--baseline',join(root,'risky.json'),'--manifest',join(root,'expanded.json'),'--sarif'])
  assert.equal(sarif.status,2,sarif.stderr)
  assert.equal(JSON.parse(sarif.stdout).runs[0].results.length,1)
  assert.doesNotMatch(sarif.stdout,/33333333333333333333333333333333|flow_ref|risky.json/)
  const fixes=run(['--baseline',join(root,'risky.json'),'--manifest',join(root,'safe.json')])
  assert.equal(fixes.status,0,fixes.stderr)
  assert.equal(JSON.parse(fixes.stdout).resolved_risk_events,8)
  const invalid=join(root,'secret.json')
  writeFileSync(invalid,'{"schema_version":1,"schema_version":1,"password":"NEVER_LEAK_ME"}')
  const rejected=run(['--manifest',invalid,'--json'])
  assert.equal(rejected.status,1)
  assert.doesNotMatch(rejected.stderr+rejected.stdout,/NEVER_LEAK_ME|secret.json|zcash-refund-test/)
  const linked=join(root,'alias.json')
  symlinkSync(join(root,'risky.json'),linked)
  const denied=run(['--manifest',linked])
  assert.equal(denied.status,1)
  assert.doesNotMatch(denied.stdout+denied.stderr,/alias.json/)
  const huge=join(root,'large.json')
  writeFileSync(huge,Buffer.alloc(65537,32))
  assert.equal(run(['--manifest',huge]).status,1)
  assert.equal(run(['--manifest',join(root,'risky.json'),'--sarif','--json']).status,1)
 }finally{rmSync(root,{recursive:true,force:true})}
})
