'use client'

import Link from 'next/link'
import {useState} from 'react'
import {LuArrowLeft,LuArrowUpRight,LuShieldCheck,LuLockKeyhole,LuCircleAlert,LuCheck,LuCopy} from 'react-icons/lu'
import {auditRefundPrivacy,compareRefundPrivacy,parseRefundPrivacyJson,refundSarifReport,type RefundAuditReport,type RefundRegressionReport} from '@zerynex/sdk'
import styles from './NodeWorkbench.module.css'

const isolated={schema_version:1,flows:[
 {flow_ref:'1'.repeat(32),refund_address_ref:'2'.repeat(32),viewing_scope_ref:'3'.repeat(32),published_publicly:true,lookup_mode:'private_claimed',spending_key_custody:'wallet_claimed'},
 {flow_ref:'4'.repeat(32),refund_address_ref:'5'.repeat(32),viewing_scope_ref:'6'.repeat(32),published_publicly:true,lookup_mode:'private_claimed',spending_key_custody:'wallet_claimed'},
]}
const risky={schema_version:1,flows:[
 isolated.flows[0],
 {flow_ref:'4'.repeat(32),refund_address_ref:'2'.repeat(32),viewing_scope_ref:'3'.repeat(32),published_publicly:true,lookup_mode:'direct',spending_key_custody:'external'},
]}
const expanded={schema_version:1,flows:[...risky.flows,
 {flow_ref:'7'.repeat(32),refund_address_ref:'8'.repeat(32),viewing_scope_ref:'9'.repeat(32),published_publicly:false,lookup_mode:'direct',spending_key_custody:'wallet_claimed'},
]}
const presets={isolated,risky,expanded} as const
const MAX_INPUT=65536
const asJson=(input:unknown)=>JSON.stringify(input,null,2)
type Result=RefundAuditReport|RefundRegressionReport

export default function RefundWorkbench(){
 const [current,setCurrent]=useState('')
 const [baseline,setBaseline]=useState('')
 const [mode,setMode]=useState<'audit'|'compare'>('audit')
 const [report,setReport]=useState<Result|null>(null)
 const [error,setError]=useState<string|null>(null)
 const [copyState,setCopyState]=useState<'idle'|'copied'|'error'>('idle')
 const isComparison=report?.status==='declaration_regression_review_only'
 const ruleIds=isComparison?(report as RefundRegressionReport).new_rule_ids:(report as RefundAuditReport|null)?.rule_ids??[]
 const count=isComparison?(report as RefundRegressionReport).new_risk_events:(report as RefundAuditReport|null)?.finding_count??0
 function change(setter:(value:string)=>void,value:string){setter(value.slice(0,MAX_INPUT+1));setError(null);setReport(null);setCopyState('idle')}
 function select(name:keyof typeof presets){change(setCurrent,asJson(presets[name]))}
 function inspect(){
  setError(null);setReport(null);setCopyState('idle')
  try{
   if(!current.trim()||current.length>MAX_INPUT|| (mode==='compare'&&(!baseline.trim()||baseline.length>MAX_INPUT)))throw new Error()
   const candidate:unknown=parseRefundPrivacyJson(current)
   const result=mode==='compare'?compareRefundPrivacy(parseRefundPrivacyJson(baseline),candidate):auditRefundPrivacy(candidate)
   setReport(result)
  }catch{setError('Cannot evaluate this metadata. Use a strict version-1 manifest without duplicate keys and with 1–100 non-secret flows and opaque 128-bit references. Do not paste actual addresses or keys.')}
 }
 async function copySarif(){
  if(!report)return
  try{await navigator.clipboard.writeText(JSON.stringify(refundSarifReport(report),null,2));setCopyState('copied')}
  catch{setCopyState('error')}
 }
 return <main className={styles.page}>
  <header className={styles.top}>
   <Link href="/tools"><LuArrowLeft size={16}/> Developer Tools</Link>
   <span>METADATA DECLARATIONS / OFFLINE / TYPESCRIPT SDK</span>
   <Link href="/docs/refund-privacy-audit">Integration guide <LuArrowUpRight size={16}/></Link>
  </header>
  <section className={styles.hero}>
   <span className={styles.eyebrow}><LuShieldCheck size={17}/> ZCASH SWAP INTEGRATION / DECLARED PRIVACY EXPOSURE</span>
   <h1>Review refund <em>linkability.</em></h1>
   <p>Evaluate declared refund-address reuse, shared viewing-key scopes, and lookup exposure. Compare revisions to catch newly introduced risks. All checks run in this browser tab using the reusable TypeScript SDK.</p>
  </section>
  <div className={styles.layout}>
   <section className={styles.panel} aria-labelledby="refund-input-title">
    <div className={styles.panelHead}><h2 id="refund-input-title">01 / Non-secret metadata</h2><span>JSON / MAX 64 KiB</span></div>
    <p className={styles.description}>Use <strong>random, non-secret opaque identifiers</strong> to model logical reuse. Never paste real addresses, viewing keys, hashed addresses, wallet IDs or account details. Example values below are synthetic.</p>
    <div className={styles.presets} aria-label="Synthetic refund samples">
     <button type="button" onClick={()=>select('isolated')}>Isolated flows</button>
     <button type="button" onClick={()=>select('risky')}>Shared viewing scope</button>
     <button type="button" onClick={()=>select('expanded')}>Additional risk</button>
    </div>
    <div className={styles.controls}>
     <label>Review mode<select value={mode} onChange={e=>{setMode(e.target.value as 'audit'|'compare');setReport(null);setError(null)}}>
      <option value="audit">Single-manifest audit</option><option value="compare">Compare revisions</option>
     </select></label>
    </div>
    {mode==='compare'&&<>
      <label className={styles.label} htmlFor="refund-baseline">Earlier public-safe baseline JSON</label>
      <textarea id="refund-baseline" className={styles.editor} spellCheck={false} rows={7} value={baseline}
       onChange={e=>change(setBaseline,e.target.value)} placeholder="Paste non-secret baseline metadata"/>
      <div className={styles.presets}><button type="button" onClick={()=>change(setBaseline,asJson(isolated))}>Use isolated baseline</button><button type="button" onClick={()=>change(setBaseline,asJson(risky))}>Use risky baseline</button></div>
    </>}
    <label className={styles.label} htmlFor="refund-current">{mode==='compare'?'Candidate manifest JSON':'Manifest JSON'}</label>
    <textarea id="refund-current" className={styles.editor} spellCheck={false} rows={11} value={current}
     onChange={e=>change(setCurrent,e.target.value)} placeholder={asJson(isolated)}/>
    <button type="button" className={styles.run} onClick={inspect}><LuShieldCheck size={17}/>{mode==='compare'?'Compare privacy declarations':'Audit declared exposure'} <LuArrowUpRight size={17}/></button>
    {error&&<div role="alert" className={styles.error}><LuCircleAlert size={16}/>{error}</div>}
    <div className={styles.private}><LuLockKeyhole size={16}/> Runs locally. No network request, file upload, key derivation, PIR or wallet connection. JSON input is not persisted by Zerynex.</div>
   </section>
   <section className={styles.panel} aria-labelledby="refund-report-title" aria-live="polite">
    <div className={styles.panelHead}><h2 id="refund-report-title">02 / Risk declaration report</h2><span>REDACTED / SCHEMA V1</span></div>
    {!report?<div className={styles.empty}><LuShieldCheck size={38}/><h3>Run a metadata check.</h3><p>Choose a synthetic configuration or enter developer-owned public-safe declarations. Zerynex returns rule IDs and counts, never the input references.</p></div>:<>
     <div className={styles.outcome} data-ready={report.passed}>
      {report.passed?<LuCheck size={22}/>:<LuCircleAlert size={22}/>}
      <div><strong>{report.passed?(isComparison?'NO NEW DECLARED RISKS':'NO DECLARED RISKS'):(isComparison?'NEW RISK DECLARATIONS':'REVIEW DECLARED RISKS')}</strong>
      <p>{isComparison?'Comparison of declared per-flow rule occurrences.':'Static review of one declared metadata manifest.'}</p></div>
     </div>
     <div className={styles.metrics}>
      <div><span>{isComparison?'NEW RISK EVENTS':'ACTIVE RULE CATEGORIES'}</span><strong>{count}</strong></div>
      <div><span>{isComparison?'CANDIDATE FLOWS':'FLOWS REVIEWED'}</span><strong>{isComparison?(report as RefundRegressionReport).current_flows_checked:(report as RefundAuditReport).flows_checked}</strong></div>
      {isComparison&&<><div><span>RESOLVED EVENTS</span><strong>{(report as RefundRegressionReport).resolved_risk_events}</strong></div><div><span>BASELINE EVENTS</span><strong>{(report as RefundRegressionReport).baseline_risk_events}</strong></div></>}
     </div>
     <div className={styles.checks}>{ruleIds.map(rule=><div key={rule}><span>{rule.replaceAll('SWAP-','').replaceAll('-',' ')}</span><strong data-status="fail">{rule}</strong></div>)}</div>
     {ruleIds.length===0&&<p className={styles.description}>No rule categories were introduced by the selected comparison or audit.</p>}
     <p className={styles.caveat}>{report.limitation}</p>
     <button type="button" className={styles.run} onClick={()=>void copySarif()}><LuCopy size={16}/>{copyState==='copied'?'SARIF copied':copyState==='error'?'Clipboard denied — select report manually':'Copy redacted SARIF'}</button>
     <span role="status">{copyState==='copied'?'Location-free SARIF copied.':copyState==='error'?'Clipboard unavailable. Use the local SDK to export this result.':''}</span>
    </>}
    <Link className={styles.apiLink} href="/docs/refund-privacy-audit">Integrate refund-privacy checks <LuArrowUpRight size={17}/></Link>
   </section>
  </div>
 </main>
}
