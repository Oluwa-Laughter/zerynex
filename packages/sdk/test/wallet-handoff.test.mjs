import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWalletHandoffCoordinator, createZip321UriProvider, WalletHandoffError,
} from '../dist/index.js'

const URI = 'zcash:private-wallet-request-marker'
const capabilities = {
  schema_version: 1, provider_id: 'local-wallet',
  networks: ['test'], accepts_zip321: true,
  max_payments: 1, supports_memos: false, supports_multi_payment: false,
}
const safeReport = {
  schema_version: 1, network: 'test', total_zat: 100_000_000,
  payments: [{ index: 0, address_type: 'shielded_or_unified',
    amount_zat: 100_000_000, memo_present: false,
    label_present: false, message_present: false }],
  limitation: 'Test fixture only',
}
const policy = { expected_network: 'test', expected_total_zat: 100_000_000 }

function setup({
  report = safeReport, caps = capabilities, response = {status: 'presented'},
} = {}) {
  let displayed = 0
  let inspected = 0
  const calls = []
  const provider = {
    async getCapabilities() { return caps },
    async presentZip321Request(uri, network) {
      calls.push({uri,network})
      return response
    },
  }
  const inspector = async (uri, network) => {
    assert.equal(uri, URI)
    assert.equal(network, 'test')
    inspected++
    return report
  }
  const coordinator = createWalletHandoffCoordinator(provider, inspector)
  return {coordinator, calls, display: () => displayed, inspected: () => inspected}
}

function error(code) {
  return e => e instanceof WalletHandoffError &&
    e.code === code && !e.message.includes(URI) && !e.message.includes('private-wallet-request')
}

test('valid handoff is one-use, opt-in, redacted and cannot claim settlement', async () => {
  const {coordinator, calls} = setup()
  const review = await coordinator.prepare(URI, policy)
  assert.equal(review.provider_id,'local-wallet')
  assert.equal(review.payment_count,1)
  assert.equal(review.total_zat,100_000_000)
  assert.equal(review.requires_wallet_confirmation,true)
  assert.doesNotMatch(JSON.stringify(review),/private-wallet-request|zcash:/)
  assert.equal(calls.length,0)
  assert(Object.isFrozen(review))
  assert(Object.isFrozen(review.payments))
  let shown = 0
  const pending = coordinator.handoff(review,async summary => {
    shown++
    assert.equal(summary,review)
    assert.equal(calls.length,0)
    return true
  })
  await assert.rejects(coordinator.handoff(review, async()=>true),error('TICKET_INVALID'))
  const result = await pending
  assert.equal(shown,1)
  assert.equal(result.status,'presented')
  assert.match(result.limitation,/not transaction submission/)
  assert.deepEqual(calls,[{uri:URI,network:'test'}])
  assert.doesNotMatch(JSON.stringify(result),/private-wallet-request|zcash:/)
  assert.equal(coordinator.cancel(review),false)
})

test('declined consent or cancel never invokes wallet provider', async () => {
  const {coordinator,calls}=setup()
  const review=await coordinator.prepare(URI,policy)
  assert.equal((await coordinator.handoff(review,async()=>false)).status,'cancelled')
  assert.equal(calls.length,0)
  await assert.rejects(coordinator.handoff(review,async()=>true),error('TICKET_INVALID'))
  const another=await coordinator.prepare(URI,policy)
  assert.equal(coordinator.cancel(another),true)
  assert.equal(coordinator.cancel(another),false)
  await assert.rejects(coordinator.handoff(another,async()=>true),error('TICKET_INVALID'))
  await assert.rejects(coordinator.handoff({...another},async()=>true),error('TICKET_INVALID'))
  assert.equal(calls.length,0)
})

test('missing or rejected host confirmation fails closed', async () => {
  const {coordinator,calls}=setup()
  const review=await coordinator.prepare(URI,policy)
  await assert.rejects(coordinator.handoff(review,undefined),error('CONSENT_FAILED'))
  const next=await coordinator.prepare(URI,policy)
  await assert.rejects(coordinator.handoff(next,async()=>{throw Error('SECRET_URI')}),
    error('CONSENT_FAILED'))
  const third=await coordinator.prepare(URI,policy)
  await assert.rejects(coordinator.handoff(third,async()=> 'true'),error('CONSENT_FAILED'))
  assert.equal(calls.length,0)
})

test('capability discovery rejects unsupported networks, invalid and deceptive wallet data', async () => {
  const variants=[
    null,[],{...capabilities,schema_version:2},
    {...capabilities,provider_id:'javascript:alert(1)'},
    {...capabilities,networks:['main','main']},
    {...capabilities,networks:['other']},
    {...capabilities,max_payments:33},
    {...capabilities,max_payments:2},
    {...capabilities,supports_memos:'yes'},
    {...capabilities,accepts_zip321:false},
  ]
  for(const caps of variants) {
    const {coordinator,calls}=setup({caps})
    await assert.rejects(coordinator.prepare(URI,policy),error('CAPABILITY_INVALID'))
    assert.equal(calls.length,0)
  }
  const {coordinator}=setup({caps:{...capabilities,networks:['main']}})
  await assert.rejects(coordinator.prepare(URI,policy),error('CAPABILITY_INVALID'))
})

test('strict policy prevents mistaken checkout totals and weakens no restrictions silently',async()=>{
  const rejected=[
    {expected_network:'test',expected_total_zat:0},
    {expected_network:'test',expected_total_zat:1.2},
    {expected_network:'test',expected_total_zat:Infinity},
    {expected_network:'test',expected_total_zat:'100000000'},
    {expected_network:'other',expected_total_zat:100_000_000},
    {...policy,max_payments:0},
    {...policy,allow_transparent:'false'},
    {...policy,unrecognized_option:true},
    {...policy,expected_total_zat:100_000_001},
  ]
  for (const p of rejected) {
    const {coordinator,calls}=setup()
    await assert.rejects(coordinator.prepare(URI,p),error('POLICY_REJECTED'))
    assert.equal(calls.length,0)
  }
})

test('redacted parser reports are validated instead of trusted',async()=>{
  const variants=[
    {...safeReport,network:'main'},
    {...safeReport,total_zat:10},
    {...safeReport,payments:[]},
    {...safeReport,payments:[{...safeReport.payments[0],amount_zat:0}]},
    {...safeReport,payments:[{...safeReport.payments[0],amount_zat:NaN}]},
    {...safeReport,payments:[{...safeReport.payments[0],memo_present:true}]},
    {...safeReport,payments:[{...safeReport.payments[0],address_type:'other'}]},
    {...safeReport,payments:[{...safeReport.payments[0],address_type:'transparent'}]},
    {...safeReport,payments:[safeReport.payments[0],{...safeReport.payments[0]}]},
  ]
  for(const report of variants){
    const {coordinator,calls}=setup({report})
    await assert.rejects(coordinator.prepare(URI,policy),error('POLICY_REJECTED'))
    assert.equal(calls.length,0)
  }
})

test('provider capabilities are rechecked before presenting; no stale trust',async()=>{
  let capabilitiesNow={...capabilities}
  let calls=0
  const wallet={
    async getCapabilities(){return capabilitiesNow},
    async presentZip321Request(){calls++;return {status:'presented'}},
  }
  const coordinator=createWalletHandoffCoordinator(wallet,async()=>safeReport)
  const review=await coordinator.prepare(URI,policy)
  capabilitiesNow={...capabilitiesNow,networks:['main']}
  await assert.rejects(coordinator.handoff(review,async()=>true),error('CAPABILITY_INVALID'))
  assert.equal(calls,0)
})

test('invalid wallet responses and thrown errors are sanitized',async()=>{
  for(const response of [{status:'confirmed',txid:'private-txid'}, {status:'presented',txid:'private'}, null, 'presented']){
    const {coordinator}=setup({response})
    const review=await coordinator.prepare(URI,policy)
    await assert.rejects(coordinator.handoff(review,async()=>true),error('RESULT_INVALID'))
  }
  const provider={
    async getCapabilities(){return capabilities},
    async presentZip321Request(){throw Error('private-provider-secret')},
  }
  const coordinator=createWalletHandoffCoordinator(provider,async()=>safeReport)
  const review=await coordinator.prepare(URI,policy)
  await assert.rejects(coordinator.handoff(review,async()=>true),error('PROVIDER_FAILED'))
})

test('OS ZIP-321 URI adapter is host-initiated and never claims wallet acceptance',async()=>{
  const opened=[]
  const provider=createZip321UriProvider({
    network:'test',
    openUri:uri=>{opened.push(uri)},
  })
  const coordinator=createWalletHandoffCoordinator(provider,async()=>safeReport)
  const review=await coordinator.prepare(URI,policy)
  assert.deepEqual(opened,[])
  const status=await coordinator.handoff(review,async()=>true)
  assert.equal(status.status,'presented')
  assert.deepEqual(opened,[URI])
  await assert.rejects(provider.presentZip321Request(URI,'main'),error('INPUT_INVALID'))
})

test('multi-payment and memo require explicit wallet and application capability',async()=>{
  const report={...safeReport,total_zat:150_000_000,payments:[
    {...safeReport.payments[0],amount_zat:100_000_000},
    {...safeReport.payments[0],index:1,amount_zat:50_000_000,memo_present:true},
  ]}
  const caps={...capabilities,max_payments:2,supports_multi_payment:true,supports_memos:true}
  const {coordinator}=setup({caps,report})
  await assert.rejects(coordinator.prepare(URI,{
    expected_network:'test',expected_total_zat:150_000_000,max_payments:2
  }),error('POLICY_REJECTED'))
  const review=await coordinator.prepare(URI,{
    expected_network:'test',expected_total_zat:150_000_000,max_payments:2,allow_memos:true
  })
  assert.equal(review.payment_count,2)
  assert.deepEqual(review.payments.map(p=>p.amount_zat),[100_000_000,50_000_000])
})
