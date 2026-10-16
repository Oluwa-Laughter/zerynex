'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import {
  LuArrowLeft, LuArrowRight, LuArrowUpRight, LuCheck, LuCircleAlert,
  LuCopy, LuDownload, LuFileCode2, LuGitCompare, LuLockKeyhole,
  LuRefreshCw, LuShieldCheck, LuUpload, LuWaypoints,
} from 'react-icons/lu'
import {
  comparePcztFiles, loadEngine, type Profile, type StageComparison,
} from '../analyzer'

const MAX_FILE = 8 * 1024 * 1024
type Preset = 'metadata' | 'transparent' | 'resolved'
const presetOptions: {id: Preset; name: string; hint: string; baseline: string; candidate: string}[] = [
  {id:'metadata',name:'New metadata',hint:'New proprietary disclosure',baseline:'clean',candidate:'flagged'},
  {id:'transparent',name:'Pool topology',hint:'Transparent output appears',baseline:'clean',candidate:'transparent'},
  {id:'resolved',name:'Resolved finding',hint:'Sensitive metadata cleared',baseline:'flagged',candidate:'clean'},
]

function localFile(file: File | null) {
  return file ? <span className="wb-file-active"><LuFileCode2 size={18}/><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(2)} KiB</small></span> :
    <span className="wb-file-empty"><LuUpload size={24}/><strong>Choose local PCZT</strong><small>Binary / Max 8 MiB</small></span>
}

export default function StageWorkbench() {
  const stage = useRef<HTMLElement>(null)
  const presetRequest = useRef(0)
  const [ready,setReady] = useState(false)
  const [busy,setBusy] = useState(false)
  const [baseline,setBaseline] = useState<File | null>(null)
  const [candidate,setCandidate] = useState<File | null>(null)
  const [preset,setPreset] = useState<Preset | null>(null)
  const [profile,setProfile] = useState<Profile>('external-signer')
  const [denyTransparent,setDenyTransparent] = useState(false)
  const [denySapling,setDenySapling] = useState(false)
  const [result,setResult] = useState<StageComparison | null>(null)
  const [error,setError] = useState<string | null>(null)
  const [copied,setCopied] = useState(false)
  useEffect(() => {
    let alive = true
    loadEngine().then(() => {if (alive) setReady(true)}).catch(() => {
      if (alive) setError('The local Rust/WASM engine is unavailable. Build it from source to use the CLI.')
    })
    if (stage.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const ctx = gsap.context(() => {
        gsap.from('.wb-reveal', {y:26,opacity:0,stagger:.09,duration:.85,ease:'power3.out'})
      },stage)
      return () => {alive=false;ctx.revert()}
    }
    return () => {alive=false}
  }, [])
  async function selectPreset(value: Preset) {
    const entry = presetOptions.find(item=>item.id===value)
    if (!entry) return
    const request = ++presetRequest.current
    setBusy(true);setError(null);setResult(null);setPreset(value)
    try {
      const files = await Promise.all([entry.baseline, entry.candidate].map(async (name) => {
        const response = await fetch('/examples/'+name+'-v6.bin')
        if (!response.ok) throw new Error('Synthetic fixtures unavailable in this build.')
        const contents = await response.arrayBuffer()
        if (contents.byteLength === 0 || contents.byteLength > MAX_FILE)
          throw new Error('Synthetic fixture size is invalid.')
        return new File([contents],name+'-synthetic-v6.pczt')
      }))
      if (presetRequest.current !== request) return
      setBaseline(files[0]);setCandidate(files[1])
    } catch {
      if (presetRequest.current !== request) return
      setBaseline(null);setCandidate(null);setPreset(null)
      setError('Could not load the checked-in synthetic fixtures.')
    } finally {
      if (presetRequest.current === request) setBusy(false)
    }
  }
  function choose(which: 'baseline'|'candidate', file?: File) {
    if (!file) return
    // Manual files take precedence over pending synthetic sample downloads.
    ++presetRequest.current
    setBusy(false)
    setResult(null);setError(null);setCopied(false);setPreset(null)
    if (which==='baseline') setBaseline(file)
    else setCandidate(file)
    if (file.size === 0 || file.size > MAX_FILE)
      setError('Choose a nonempty binary PCZT no larger than 8 MiB.')
  }
  async function compare() {
    if (!baseline || !candidate || busy || !ready) return
    setBusy(true);setError(null);setResult(null);setCopied(false)
    try {
      const response = await comparePcztFiles(baseline,candidate,profile,{denyTransparent,denySapling})
      setResult(response)
    } catch {
      setError('Comparison failed. Check that both files contain supported binary PCZTs and try again.')
    } finally {setBusy(false)}
  }
  function exportReport() {
    if (!result) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}))
    const anchor = document.createElement('a')
    anchor.href=url;anchor.download='zerynex-stage-regression.json';anchor.click()
    URL.revokeObjectURL(url)
  }
  async function copyReport() {
    if (!result) return
    try {await navigator.clipboard.writeText(JSON.stringify(result,null,2));setCopied(true)} catch {setCopied(false)}
  }
  return <main className="wb-page" ref={stage}>
    <header className="wb-top wb-reveal">
      <Link href="/tools"><LuArrowLeft size={16}/> Developer Tools</Link>
      <span>LOCAL WEBASSEMBLY / NO TRANSACTION UPLOADS</span>
      <Link href="/docs/pczt-stage-regression">Read guide <LuArrowUpRight size={16}/></Link>
    </header>
    <section className="wb-hero wb-reveal">
      <span className="wb-eyebrow"><LuGitCompare size={16}/> PCZT / STAGE REGRESSION</span>
      <h1>See what <em>changed.</em></h1>
      <p>Compare two locally held Zcash PCZT snapshots with the canonical Rust engine. Detect newly disclosed policy fields and pool-component changes, without uploading either file.</p>
      <div className="wb-hero-facts">
        <span><LuLockKeyhole size={16}/> On-device Rust analysis</span>
        <span><LuShieldCheck size={16}/> Sanitized findings</span>
        <span><LuWaypoints size={16}/> Binary PCZT v6 fixtures</span>
      </div>
    </section>
    <div className="wb-body">
      <section className="wb-panel wb-reveal" aria-label="Compare PCZT files">
        <div className="wb-section-head"><span>01 / SELECT INPUTS</span><span>{ready?'ENGINE READY':'LOADING ENGINE'}</span></div>
        <p className="wb-help">Run a reproducible example, or bring two PCZT files from your own trusted local workflow.</p>
        <div className="wb-preset-list">
          {presetOptions.map(option=><button key={option.id} type="button" aria-pressed={preset===option.id}
            onClick={()=>void selectPreset(option.id)}><strong>{option.name}</strong><span>{option.hint}</span><LuArrowUpRight size={17}/></button>)}
        </div>
        <div className="wb-input-pair">
          <label className="wb-input-box"><span>BASELINE / BEFORE</span>{localFile(baseline)}
            <input type="file" aria-label="Baseline PCZT file" onChange={event=>choose('baseline',event.target.files?.[0])}/></label>
          <div className="wb-pair-arrow"><LuArrowRight size={22}/></div>
          <label className="wb-input-box"><span>CANDIDATE / AFTER</span>{localFile(candidate)}
            <input type="file" aria-label="Candidate PCZT file" onChange={event=>choose('candidate',event.target.files?.[0])}/></label>
        </div>
        <div className="wb-section-head wb-policy-title"><span>02 / POLICY SETTINGS</span><span>SAME POLICY FOR BOTH STAGES</span></div>
        <div className="wb-options">
          <label>Disclosure profile
            <select aria-label="Stage comparison profile" value={profile} onChange={event=>{setProfile(event.target.value as Profile);setResult(null)}}>
              <option value="external-signer">External signer</option><option value="restricted-handoff">Restricted handoff</option>
            </select>
          </label>
          <label><input type="checkbox" checked={denyTransparent} onChange={event=>{setDenyTransparent(event.target.checked);setResult(null)}}/> Deny transparent</label>
          <label><input type="checkbox" checked={denySapling} onChange={event=>{setDenySapling(event.target.checked);setResult(null)}}/> Deny Sapling</label>
        </div>
        <button className="wb-run" onClick={()=>void compare()}
          disabled={!ready||busy||!baseline||!candidate||!baseline.size||!candidate.size||baseline.size>MAX_FILE||candidate.size>MAX_FILE}>
          {busy?'RUNNING LOCALLY': 'COMPARE PCZT STAGES'} {busy?<LuRefreshCw className="wb-spin" size={18}/>:<LuArrowRight size={20}/>}
        </button>
        <p className="wb-confidential"><LuLockKeyhole size={15}/> Files stay in browser memory. No API requests to analyze private PCZTs.</p>
      </section>
      <section className="wb-panel wb-reveal" aria-label="Stage comparison results">
        <div className="wb-section-head"><span>03 / OBSERVATIONS</span><span>VALUE-FREE REPORT</span></div>
        {error && <p role="alert" className="wb-error"><LuCircleAlert size={19}/>{error}</p>}
        {!result ? <div className="wb-placeholder">
          <LuGitCompare size={52} strokeWidth={1}/>
          <h2>Ready to compare.</h2>
          <p>Choose a synthetic scenario or upload two local PCZTs. The Rust engine will flag changes covered by its current policy rules.</p>
        </div> : <div className="wb-report" aria-live="polite">
          <div className={'wb-report-banner '+(result.passed?'wb-pass':'wb-fail')}>
            {result.passed?<LuCheck size={25}/>:<LuCircleAlert size={25}/>}
            <div><span>{result.passed?'POLICY CHECKS PASSED':'POLICY OR STRUCTURE CHANGES'}</span><strong>{result.passed?'No remaining findings':'Review stage observations'}</strong></div>
          </div>
          <div className="wb-counts">
            <div><strong>{result.before_findings_count}</strong><span>BEFORE FINDINGS</span></div>
            <div><strong>{result.after_findings_count}</strong><span>AFTER FINDINGS</span></div>
            <div><strong>{result.component_deltas.length}</strong><span>STRUCTURE CHANGES</span></div>
          </div>
          <div className="wb-changes">
            <h2>Introduced findings <span>{result.added_findings.length}</span></h2>
            {result.added_findings.length===0?<p>No new policy fields detected.</p>:result.added_findings.map((f,i)=><div className="wb-change" key={i}><span>{f.rule}</span><strong>{f.field}</strong></div>)}
            <h2>Resolved findings <span>{result.resolved_findings.length}</span></h2>
            {result.resolved_findings.length===0?<p>No previously flagged fields were resolved.</p>:result.resolved_findings.map((f,i)=><div className="wb-change wb-resolved" key={i}><span>{f.rule}</span><strong>{f.field}</strong></div>)}
            <h2>Pool component changes <span>{result.component_deltas.length}</span></h2>
            {result.component_deltas.length===0?<p>No tracked pool-count changes.</p>:result.component_deltas.map((d,i)=><div className="wb-change" key={i}><span>{d.component}</span><strong>{d.before} → {d.after}</strong></div>)}
          </div>
          <p className="wb-caution">{result.disclaimer}</p>
          <div className="wb-report-actions"><button onClick={exportReport}><LuDownload size={16}/> Export JSON</button><button onClick={()=>void copyReport()}>{copied?<LuCheck size={16}/>:<LuCopy size={16}/>} {copied?'Copied':'Copy report'}</button></div>
        </div>}
      </section>
    </div>
    <div className="wb-bottom wb-reveal"><p>STRUCTURAL COMPARISON IS NOT CRYPTOGRAPHIC EQUIVALENCE. VERIFY SPENDING AUTHORITY AND PROOFS SEPARATELY.</p><Link href="/docs/pczt-stage-regression">View complete limitations <LuArrowUpRight size={15}/></Link></div>
  </main>
}
