'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { LuArrowLeft, LuArrowRight, LuArrowUpRight, LuCheck, LuCircleAlert,
  LuDownload, LuGitMerge, LuLockKeyhole, LuRefreshCw, LuShieldCheck } from 'react-icons/lu'
import { comparePcztFiles, loadEngine, type StageComparison } from '../analyzer'

type Transition = {
  name:string;before:string;after:string
  expect:{passed:boolean;added_rules:string[];resolved_rules:string[];changed_components:string[]}
}
type Manifest = { version:number; policy:{profile:string;deny_transparent:boolean;deny_sapling:boolean};transitions:Transition[] }
type Case = {name:string;matched:boolean;policyPassed:boolean;added:string[];resolved:string[];structure:string[];report:StageComparison}
type ScenarioReport = {passed:boolean;cases:Case[];limitation:string}
const BASE='/examples/role-handoff/'
const FIXTURES=new Set(['00-created.bin','01-updated.bin','02-combined.bin','03-redacted.bin'])
const safeName=/^[a-z0-9][a-z0-9-]{0,79}$/

async function getFixture(name:string):Promise<File> {
  if (!FIXTURES.has(name)) throw new Error('Fixture not in the approved synthetic suite.')
  const response=await fetch(BASE+name)
  if (!response.ok) throw new Error('Synthetic fixture unavailable.')
  const bytes=await response.arrayBuffer()
  if (!bytes.byteLength || bytes.byteLength>8*1024*1024) throw new Error('Invalid fixture size.')
  return new File([bytes],name,{type:'application/octet-stream'})
}

async function runManifest():Promise<ScenarioReport> {
  const response=await fetch(BASE+'scenario.json')
  if (!response.ok) throw new Error('Scenario manifest missing.')
  const manifest=await response.json() as Manifest
  if (manifest.version!==1||!Array.isArray(manifest.transitions)||
    manifest.transitions.length!==4||manifest.policy.profile!=='external_signer'||
    typeof manifest.policy.deny_transparent!=='boolean'||
    typeof manifest.policy.deny_sapling!=='boolean') throw new Error('Unexpected synthetic scenario format.')
  const files=new Map<string,File>()
  for (const name of FIXTURES) files.set(name,await getFixture(name))
  const cases:Case[]=[]
  for (const transition of manifest.transitions) {
    if (!safeName.test(transition.name)||!FIXTURES.has(transition.before)||!FIXTURES.has(transition.after)||
      !transition.expect||typeof transition.expect.passed!=='boolean'||
      !Array.isArray(transition.expect.added_rules)||
      !Array.isArray(transition.expect.resolved_rules)||
      !Array.isArray(transition.expect.changed_components)) {
      throw new Error('Unexpected synthetic scenario expectation.')
    }
    const report=await comparePcztFiles(files.get(transition.before)!,files.get(transition.after)!,
      'external-signer',{denyTransparent:manifest.policy.deny_transparent,denySapling:manifest.policy.deny_sapling})
    const added=report.added_findings.map(f=>f.rule)
    const resolved=report.resolved_findings.map(f=>f.rule)
    const structure=report.component_deltas.map(d=>d.component)
    const equal=(actual:string[],expected:string[])=>JSON.stringify([...actual].sort())===JSON.stringify([...expected].sort())
    cases.push({
      name:transition.name,
      matched:report.passed===transition.expect.passed &&
        equal(added,transition.expect.added_rules) &&
        equal(resolved,transition.expect.resolved_rules) &&
        equal(structure,transition.expect.changed_components),
      policyPassed:report.passed,added,resolved,structure,report,
    })
  }
  return {
    passed:cases.every(item=>item.matched),
    cases,
    limitation:'Synthetic, deterministic PCZT fixtures generated with upstream Creator, Updater, Combiner and Redactor. No real Zallet RPC, proving, signing, transaction equivalence or consensus verification.',
  }
}

export default function HandoffWorkbench(){
  const root=useRef<HTMLElement>(null)
  const [ready,setReady]=useState(false)
  const [busy,setBusy]=useState(false)
  const [result,setResult]=useState<ScenarioReport|null>(null)
  const [expanded,setExpanded]=useState<number|null>(null)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{
    let alive=true
    loadEngine().then(()=>{if(alive)setReady(true)}).catch(()=>{if(alive)setError('Local Rust engine unavailable. Run the CLI scenario harness instead.')})
    if(root.current&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      const ctx=gsap.context(()=>gsap.from('.wb-reveal',{opacity:0,y:24,stagger:.09,duration:.8,ease:'power3.out'}),root)
      return ()=>{alive=false;ctx.revert()}
    }
    return ()=>{alive=false}
  },[])
  async function run(){
    setBusy(true);setError(null);setResult(null);setExpanded(null)
    try {setResult(await runManifest())}
    catch {setError('The bundled role scenarios could not be verified. Check the browser Rust engine and fixture assets.')}
    finally {setBusy(false)}
  }
  function exportReport(){
    if(!result)return
    const safe={
      passed:result.passed,
      scenario_count:result.cases.length,
      matched:result.cases.filter(c=>c.matched).length,
      cases:result.cases.map(c=>({name:c.name,matched_expectation:c.matched,policy_passed:c.policyPassed,added_rules:c.added,resolved_rules:c.resolved,changed_components:c.structure})),
      limitation:result.limitation,
    }
    const url=URL.createObjectURL(new Blob([JSON.stringify(safe,null,2)],{type:'application/json'}))
    const link=document.createElement('a');link.href=url;link.download='zerynex-role-scenario-results.json';link.click();URL.revokeObjectURL(url)
  }
  return <main className="wb-page wb-handoff" ref={root}>
    <header className="wb-top wb-reveal">
      <Link href="/tools"><LuArrowLeft size={16}/> Developer Tools</Link>
      <span>UPSTREAM PCZT ROLES / NO NODE REQUIRED</span>
      <Link href="/docs/handoff-harness">Read guide <LuArrowUpRight size={16}/></Link>
    </header>
    <section className="wb-hero wb-reveal">
      <span className="wb-eyebrow"><LuGitMerge size={16}/> ZERYNEX / PCZT ROLE HARNESS</span>
      <h1>Test the <em>handoff.</em></h1>
      <p>Run four real Rust-generated synthetic PCZT role transitions against the same policy engine used by Zerynex CLI and SDKs. Reproduce expected disclosures before using the workflow in your own CI.</p>
      <div className="wb-hero-facts"><span><LuShieldCheck size={16}/> Creator / Updater / Combiner / Redactor</span><span><LuLockKeyhole size={16}/> No secrets, nodes or wallets</span></div>
    </section>
    <div className="wb-body wb-handoff-body">
      <section className="wb-panel wb-reveal">
        <div className="wb-section-head"><span>01 / REPRODUCIBLE EXPERIMENT</span><span>4 ROLE TRANSITIONS</span></div>
        <p className="wb-help">These fixtures were generated with the upstream Zcash PCZT Rust crate. The web runner executes actual WASM stage comparisons on the static synthetic snapshots; it does not run a wallet or a prover.</p>
        <div className="wb-timeline">
          {['Creator','Updater','Combiner','Redactor'].map((name,i)=><div key={name} className="wb-step"><span>{String(i+1).padStart(2,'0')}</span><div><strong>{name}</strong><small>{['Create synthetic v6 PCZT','Add proprietary disclosure','Merge matching role contributions','Clear metadata for the final handoff'][i]}</small></div>{i!==3&&<LuArrowRight size={17}/>}</div>)}
        </div>
        <button className="wb-run" disabled={!ready||busy} onClick={()=>void run()}>
          {busy?'EVALUATING FOUR STAGES':'RUN SYNTHETIC HANDOFF SUITE'}{busy?<LuRefreshCw className="wb-spin" size={18}/>:<LuArrowRight size={20}/>}
        </button>
        <p className="wb-confidential"><LuLockKeyhole size={15}/> Only publicly checked-in synthetic PCZTs are used. No upload, wallet approval, signing or proof generation.</p>
      </section>
      <section className="wb-panel wb-reveal" aria-label="Handoff scenario results">
        <div className="wb-section-head"><span>02 / TEST OBSERVATIONS</span><span>{ready?'RUST / WASM READY':'INITIALIZING'}</span></div>
        {error&&<p className="wb-error" role="alert"><LuCircleAlert size={18}/>{error}</p>}
        {!result?<div className="wb-placeholder"><LuGitMerge size={49} strokeWidth={1}/><h2>Ready for regression tests.</h2><p>Run the bundled suite to check four expected role transitions. A deliberately unsafe intermediate stage is a successful test if—and only if—the engine detects it as expected.</p></div>:
          <div className="wb-report" aria-live="polite">
            <div className={'wb-report-banner '+(result.passed?'wb-pass':'wb-fail')}>
              {result.passed?<LuCheck size={25}/>:<LuCircleAlert size={25}/>}
              <div><span>{result.passed?'ALL EXPECTATIONS MATCHED':'UNEXPECTED ROLE OBSERVATION'}</span>
                <strong>{result.cases.filter(c=>c.matched).length} / {result.cases.length} scenarios matched</strong></div>
            </div>
            <div className="wb-cases">
              {result.cases.map((item,index)=><div className="wb-case" key={item.name}>
                <button type="button" aria-expanded={expanded===index} onClick={()=>setExpanded(expanded===index?null:index)}>
                  <span>{String(index+1).padStart(2,'0')}</span><strong>{item.name.replaceAll('-',' ')}</strong><small>{item.matched?'EXPECTED':'MISMATCH'}</small><LuArrowRight size={16}/>
                </button>
                {expanded===index&&<div className="wb-case-details">
                  <p>Candidate policy: <strong>{item.policyPassed?'No current findings':'Policy findings present'}</strong></p>
                  <p>Added rules: {item.added.join(', ')||'none'}</p>
                  <p>Resolved rules: {item.resolved.join(', ')||'none'}</p>
                  <p>Structure changes: {item.structure.join(', ')||'none'}</p>
                </div>}
              </div>)}
            </div>
            <p className="wb-caution">{result.limitation}</p>
            <div className="wb-report-actions"><button onClick={exportReport}><LuDownload size={16}/> Export sanitized JSON</button></div>
          </div>}
      </section>
    </div>
    <div className="wb-bottom wb-reveal"><p>THIS SUITE TESTS REAL PCZT ROLE-FORMAT OPERATIONS, NOT ZALLET RPC, SIGNATURES OR PROOF VALIDITY.</p>
      <Link href="/docs/handoff-harness">Integrate the CLI harness <LuArrowUpRight size={15}/></Link>
    </div>
  </main>
}
