'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { LuAsterisk as Asterisk, LuArrowLeft as ArrowLeft, LuArrowRight as ArrowRight, LuArrowUpRight as ArrowUpRight, LuCheck as Check, LuCheckCheck as CheckCheck, LuCircleAlert as CircleAlert, LuCopy as Copy, LuDownload as Download, LuUpload as Upload, LuFileCode2 as FileCode2, LuFingerprint as Fingerprint, LuLockKeyhole as LockKeyhole, LuScanLine as ScanLine, LuTerminal as Terminal } from 'react-icons/lu'
import { inspectPczt, loadEngine } from './analyzer'
import Ecosystem from './Ecosystem'
import HomeExperience from './HomeExperience'
import ToolingIntegrations from './ToolingIntegrations'
import { exportPolicyJson, parsePolicyJson, type Policy as SdkPolicy } from '@zerynex/sdk'
import type { Profile, Report } from './analyzer'


type View = 'home' | 'tools' | 'ecosystem'
type EngineStatus = 'loading' | 'ready' | 'unavailable'

function Kicker({ children, number }: { children: React.ReactNode; number?: string }) {
  return <div className="kicker"><Asterisk className="kicker-cross" size={15} strokeWidth={2}/>{number && <span className="kicker-index">{number} /</span>} {children}</div>
}
const synthetic = [
  { name:'External signer', message:'A recipient sees only the metadata your policy explicitly allows.', fields:[{ name:'spend.dummy_sk', status:'blocked' },{name:'output.proprietary', status:'review'},{name:'output.recipient',status:'permitted'}]},
  { name:'Restricted handoff', message:'A more restrictive policy will flag recipient, value, and seed randomness when they are present.', fields:[{name:'output.recipient',status:'blocked'},{name:'output.value',status:'blocked'},{name:'output.rseed',status:'blocked'}]},
]
function PolicyIllustration({ restricted }: { restricted: boolean }) {
  const data = synthetic[restricted ? 1 : 0]
  return <div className="policy-illustration">
    <div className="policy-illustration-top"><span><span className="live-led"/> EXAMPLE POLICY MAP</span><span>ILLUSTRATIVE · NOT A SCAN</span></div>
    <div className="sample-bars">
      {data.fields.map((item,i)=><div key={item.name} className="sample-bar"><div className="sample-num">0{i+1}</div><div className="sample-field">{item.name}</div><div className={'sample-state '+item.status}>{item.status==='permitted'?'PERMITTED':item.status==='review'?'REVIEW':'BLOCKED'} {item.status==='permitted'?<Check size={14}/>:<CircleAlert size={14}/>}</div></div>)}
    </div>
    <p>{data.message}</p>
  </div>
}
function DeveloperTools({ navigate }: { navigate: (v: View) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const policyInput = useRef<HTMLInputElement>(null)
  const [policyNotice, setPolicyNotice] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [profile, setProfile] = useState<Profile>('external-signer')
  const [denyTransparent, setDenyTransparent] = useState(false)
  const [denySapling, setDenySapling] = useState(false)
  const [engine, setEngine] = useState<EngineStatus>('loading')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'result'|'example'>('result')
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    let alive = true
    loadEngine().then(() => { if(alive) setEngine('ready') }).catch(() => { if(alive) setEngine('unavailable') })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      gsap.from('.studio-top, .studio-heading', { y: 22, opacity: 0, filter: 'blur(7px)', stagger: .13, duration: .8, ease:'power3.out' })
      gsap.utils.toArray<HTMLElement>('.studio-box, .studio-help, .console-reveal').forEach(element => {
        gsap.from(element, {y: 22, opacity: 0, filter: 'blur(6px)', duration: .75, ease: 'power3.out',
          scrollTrigger: {trigger: element, start:'top 92%', once:true} })
      })
    }, root)
    return () => ctx.revert()
  }, [])
  useEffect(() => {
    if (!report || !root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from('.report-status, .report-details, .finding', {
        y: 16, opacity: 0, filter: 'blur(3px)', duration: .55, stagger: .08, ease: 'power3.out',
      })
    }, root)
    return () => ctx.revert()
  }, [report])
  const choose = (candidate?: File | null) => {
    if(!candidate) return
    setFile(candidate)
    setReport(null)
    setError(null)
    setTab('result')
    if(candidate.size > 8 * 1024 * 1024) setError('File exceeds the 8 MiB maximum.')
  }
  const loadSynthetic = async (which: 'clean' | 'flagged' | 'transparent') => {
    try {
      const response = await fetch('/examples/' + which + '-v6.bin')
      if (!response.ok) throw new Error('Synthetic test fixture is missing from this build.')
      const bytes = await response.arrayBuffer()
      choose(new File([bytes], which + '-synthetic-v6.pczt', { type: 'application/octet-stream' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load test fixture.')
    }
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    choose(e.dataTransfer.files[0])
  }
  const run = async () => {
    if (!file || busy) return
    setBusy(true)
    setError(null)
    setReport(null)
    try {
      const result = await inspectPczt(file, profile, { denyTransparent, denySapling })
      setReport(result)
      setTab('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to analyze this file.'
      setError(msg.includes('fetch') || msg.includes('import') ? 'The browser Rust engine is not available in this build. Use the Rust CLI locally instead.' : msg)
    } finally {
      setBusy(false)
    }
  }
  const importPolicy = async (selected?: File | null) => {
    if (!selected) return
    setPolicyNotice(null)
    if (selected.size > 4096) {
      setPolicyNotice('Invalid policy: maximum file size is 4 KiB.')
      return
    }
    try {
      const imported = parsePolicyJson(await selected.text())
      setProfile(imported.profile === 'restricted_handoff' ? 'restricted-handoff' : 'external-signer')
      setDenyTransparent(imported.deny_transparent)
      setDenySapling(imported.deny_sapling)
      setReport(null)
      setError(null)
      setPolicyNotice('Policy loaded locally. Review the settings before analyzing.')
    } catch {
      setPolicyNotice('Invalid policy file. Use the documented JSON schema.')
    }
  }
  const downloadPolicy = () => {
    const policy: SdkPolicy = {
      profile: profile === 'restricted-handoff' ? 'restricted_handoff' : 'external_signer',
      deny_transparent: denyTransparent,
      deny_sapling: denySapling,
    }
    const url = URL.createObjectURL(new Blob([exportPolicyJson(policy)], { type:'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'zerynex-policy.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const download = () => {
    if (!report) return
    const output = new Blob([JSON.stringify(report,null,2)], {type:'application/json'})
    const url = URL.createObjectURL(output)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zerynex-report.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const copy = async () => {
    if(!report) return
    await navigator.clipboard.writeText(JSON.stringify(report,null,2))
    setCopied(true)
  }
  return <main ref={root} className="studio-page">
    <div className="studio-top studio-reveal"><button className="back-button" onClick={() => navigate('home')}><ArrowLeft size={17}/> BACK TO OVERVIEW</button><span className="studio-code">ZERYNEX / DEVELOPER TOOLS <span>001</span></span></div>
    <div className="studio-heading studio-reveal"><div><Kicker>ZERYNEX TOOLING / LOCAL FIRST</Kicker><h1>Inspect Zcash transaction <em>privacy.</em></h1><p>Run Rust-powered PCZT privacy-policy checks, investigate disclosure findings and test transaction-stage changes locally before integrating them into wallets and infrastructure.</p></div><div className={'engine-pill '+engine}><span className="live-led"/>{engine === 'ready' ? 'RUST ENGINE READY' : engine === 'loading' ? 'ENGINE INITIALIZING' : 'ENGINE UNAVAILABLE'}</div></div>
    <section className="wb-entry-links studio-reveal" aria-label="Other interactive developer tools">
      <Link href="/tools/stages">
        <span>EXPERIMENT 02 / RUST + WASM</span><strong>PCZT Stage Comparator</strong>
        <small>Compare two real local PCZTs for policy and pool-structure changes.</small>
        <ArrowUpRight size={21}/>
      </Link>
      <Link href="/tools/handoff">
        <span>EXPERIMENT 03 / SYNTHETIC ROLES</span><strong>Role Handoff Tests</strong>
        <small>Run four upstream role-fixture regressions and export the results.</small>
        <ArrowUpRight size={21}/>
      </Link>
    </section>
    <div className="studio-grid">
      <div className="studio-left">
        <section className="studio-box studio-reveal">
          <div className="studio-box-head"><div><span>01 /</span> INPUT SOURCE</div><span>LOCAL DEVICE ONLY</span></div>
          <div className={'dropzone'+(dragging?' drag-active':'')+(file?' drop-selected':'')} role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={e => { if(e.key==='Enter' || e.key===' ') {e.preventDefault();input.current?.click()} }} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={onDrop}>
            <input ref={input} type="file" hidden onChange={(e:ChangeEvent<HTMLInputElement>)=>choose(e.target.files?.[0])}/>
            <div className="drop-icon">{file ? <FileCode2 size={29} strokeWidth={1.3}/> : <ScanLine size={32} strokeWidth={1.3}/>}</div>
            <strong>{file ? file.name : 'Drop a PCZT into the field'}</strong>
            <span>{file ? (file.size/1024).toFixed(1)+' KiB · stored only in local browser memory' : 'Or click to select a binary Zcash transaction file'}</span>
            <span className="file-tag">PCZT / MAX 8 MiB</span>
          </div>
          <div className="fixture-row"><span>TRY A SYNTHETIC PCZT</span><div><button onClick={() => loadSynthetic('clean')}>Clean v6 <ArrowUpRight size={14}/></button><button onClick={() => loadSynthetic('flagged')}>Flagged v6 <ArrowUpRight size={14}/></button><button onClick={() => loadSynthetic('transparent')}>Transparent v6 <ArrowUpRight size={14}/></button></div></div>
          <div className="privacy-line"><LockKeyhole size={16}/><span>Files are parsed in this browser using WebAssembly. No upload. No account. No telemetry.</span></div>
        </section>
        <section className="studio-box studio-reveal">
          <div className="studio-box-head"><div><span>02 /</span> DISCLOSURE POLICY</div><span>SELECT A PROFILE</span></div>
          <div className="profile-options">
            <button className={'profile-option'+(profile==='external-signer'?' chosen':'')} onClick={()=>{setProfile('external-signer');setReport(null)}}>
              <span className="radio-ring"><i/></span><span><strong>External signer</strong><small>Flag dummy keys and unreviewed proprietary fields.</small></span><ArrowUpRight size={17}/>
            </button>
            <button className={'profile-option'+(profile==='restricted-handoff'?' chosen':'')} onClick={()=>{setProfile('restricted-handoff');setReport(null)}}>
              <span className="radio-ring"><i/></span><span><strong>Restricted handoff</strong><small>Also flag selected recipient, value and randomness fields.</small></span><ArrowUpRight size={17}/>
            </button>
          </div>
          <div className="policy-controls">
            <span className="policy-controls-title">ADDITIONAL PRIVACY INVARIANTS</span>
            <label className="policy-check"><input type="checkbox" checked={denyTransparent} onChange={e=>{setDenyTransparent(e.target.checked);setReport(null)}}/><span><strong>Deny transparent components</strong><small>Flag transparent inputs and outputs in a PCZT.</small></span></label>
            <label className="policy-check"><input type="checkbox" checked={denySapling} onChange={e=>{setDenySapling(e.target.checked);setReport(null)}}/><span><strong>Deny Sapling components</strong><small>Require no Sapling spends or outputs in the workflow.</small></span></label>
            <div className="policy-file-actions">
              <input ref={policyInput} type="file" accept=".json,application/json" aria-label="Select JSON policy file" hidden onChange={e=>{void importPolicy(e.target.files?.[0]);e.target.value=''}}/>
              <button type="button" className="download-policy" onClick={() => policyInput.current?.click()}><Upload size={14}/> IMPORT JSON POLICY</button>
              <button type="button" className="download-policy" onClick={downloadPolicy}><Download size={14}/> EXPORT JSON POLICY</button>
            </div>
            {policyNotice && <p role="status" className="policy-notice">{policyNotice}</p>}
          </div>
          <div className="policy-warning"><CircleAlert size={16}/> These profiles are early checks. A passing report is not proof of anonymity, and restrictive policies may reject data a real signer needs.</div>
          <button className="run-analysis" disabled={!file || engine!=='ready' || busy || file.size>8*1024*1024} onClick={run}>{busy?'ANALYZING ON DEVICE':'RUN PRIVACY ANALYSIS'}{busy?<span className="spinner"/>:<ArrowRight size={20}/>}</button>
        </section>
      </div>
      <section className="studio-box studio-results studio-reveal">
        <div className="studio-box-head"><div><span>03 /</span> ANALYSIS CONSOLE</div><span>NO REMOTE PROCESSING</span></div>
        <div className="result-tabs"><button className={tab==='result'?'tab-active':''} onClick={()=>setTab('result')}>Your results</button><button className={tab==='example'?'tab-active':''} onClick={()=>setTab('example')}>Policy example</button></div>
        {tab==='example' ? <PolicyIllustration restricted={profile==='restricted-handoff'}/> : (
          report ? <div className="real-report">
            <div className={'report-status '+(report.findings.length?'report-issues':'report-clear')}><span className="report-status-icon">{report.findings.length?<CircleAlert size={29}/>:<CheckCheck size={29}/>}</span><div><span className="report-small">{report.findings.length?'POLICY FINDINGS DETECTED':'NO POLICY FINDINGS DETECTED'}</span><strong>{report.findings.length ? report.findings.length+' finding'+(report.findings.length===1?'':'s') : 'Policy checks passed'}</strong></div></div>
            <div className="report-details"><span>PROFILE</span><strong>{report.profile.replaceAll('_',' ')}</strong><span>CHECKED POOLS</span><strong>{report.checked_pools.join(' / ')}</strong><span>TRANSPARENT COMPONENTS</span><strong>{report.deny_transparent ? 'DENIED' : 'ALLOWED BY POLICY'}</strong><span>SAPLING COMPONENTS</span><strong>{report.deny_sapling ? 'DENIED' : 'ALLOWED BY POLICY'}</strong></div>
            {report.findings.length>0 && <div className="findings-list">{report.findings.map((f,i)=><div className="finding" key={i}><span>{f.rule}</span><strong>{f.field}</strong><p>{f.explanation}</p></div>)}</div>}
            <p className="disclaimer">{report.disclaimer}</p>
            <div className="report-actions"><button onClick={download}><Download size={16}/> Export JSON</button><button onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied':'Copy report'}</button></div>
          </div>
          : <div className="empty-report">{error?<div className="analysis-error"><CircleAlert size={30}/><strong>Unable to analyze</strong><p>{error}</p></div>:<><div className="scan-emblem"><Fingerprint size={66} strokeWidth={.75}/></div><span className="console-counter">AWAITING SOURCE / 000</span><h3>Your privacy report<br/><em>starts here.</em></h3><p>Load a real binary PCZT, choose a disclosure profile, and run the Rust engine. Results appear here.</p><div className="console-coordinate">IN / BROWSER ONLY · 127.0.0.1 PRINCIPLE</div></>}</div>
        )}
        <div className="results-bottom"><span><span className="live-led"/> ZERO UPLOAD ARCHITECTURE</span><span>EARLY ACCESS / V0.1</span></div>
      </section>
    </div>
    <section className="studio-help studio-reveal"><div><Terminal size={19}/><strong>Prefer your terminal?</strong><p>Run the same engine as a local Rust CLI. No service dependency.</p></div><code>cargo run -- path/to/file.pczt --profile external-signer --json</code><Link href="/docs/installation">Read installation guide <ArrowUpRight size={16}/></Link></section>
    <ToolingIntegrations/>
    <div className="studio-bottom-note"><span>NOT A CONSENSUS VALIDATOR OR SECURITY AUDIT</span><a href="https://zips.z.cash/zip-0374" target="_blank" rel="noopener noreferrer">ZIP-374 REFERENCE <ArrowUpRight size={13}/></a></div>
  </main>
}
export default function App({ page }: { page: View }) {
  const router = useRouter()
  const view: View = page
  const navigate = (next: View) => {
    router.push(next === 'tools' ? '/tools' : next === 'ecosystem' ? '/ecosystem' : '/')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  return <>
    <div>
      {view === 'home' ? <HomeExperience/> : view === 'ecosystem' ? <Ecosystem/> : <DeveloperTools navigate={navigate}/>}
    </div>

  </>
}
