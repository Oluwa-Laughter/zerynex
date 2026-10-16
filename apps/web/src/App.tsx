import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, CircleAlert, CircleCheck, Copy, Download, FileCode2, Fingerprint, Layers3, LockKeyhole, Menu, MoveUpRight, ScanLine, Terminal, X, } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { inspectPczt, loadEngine } from './analyzer'
import type { Profile, Report } from './analyzer'

gsap.registerPlugin(ScrollTrigger)
const repository = 'https://github.com/Oluwa-Laughter/zerynex'
type View = 'home' | 'studio'
type EngineStatus = 'loading' | 'ready' | 'unavailable'

function Mark({ small = false }: { small?: boolean }) {
  return <span className={'brand-mark' + (small ? ' brand-mark-small' : '')} aria-hidden="true">
    <svg viewBox="0 0 96 96" fill="none">
      <path d="M20 29H70L25 69H74" stroke="currentColor" strokeWidth="10" strokeLinecap="square" strokeLinejoin="miter"/>
      <path d="M66 15V35M56 25H76" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  </span>
}
function Brand({ onClick }: { onClick: () => void }) {
  return <button type="button" className="brand" onClick={onClick} aria-label="Zerynex home">
    <Mark />
    <span>ZERYNEX<span className="brand-dot">.</span></span>
  </button>
}
function LinkArrow({ label, onClick, light = false }: { label: string; onClick: () => void; light?: boolean }) {
  return <button type="button" className={'action-button' + (light ? ' action-light' : '')} onClick={onClick}>
    {label}<span className="action-arrow"><ArrowUpRight size={17}/></span>
  </button>
}
function Kicker({ children, number }: { children: React.ReactNode; number?: string }) {
  return <div className="kicker"><span className="kicker-cross">✳</span>{number && <span className="kicker-index">{number} /</span>} {children}</div>
}
function Header({ current, navigate }: { current: View; navigate: (v: View) => void }) {
  const [menu, setMenu] = useState(false)
  const toHomeSection = (id: string) => {
    setMenu(false)
    navigate('home')
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 50)
  }
  return <header className="topbar">
    <Brand onClick={() => { setMenu(false); navigate('home') }} />
    <nav className={'desktop-nav' + (menu ? ' nav-open' : '')} aria-label="Primary">
      <button className={current === 'home' ? 'nav-active' : ''} onClick={() => {setMenu(false);navigate('home')}}>Overview</button>
      <button onClick={() => toHomeSection('protocol')}>Protocol</button>
      <button onClick={() => toHomeSection('principles')}>Principles</button>
      <a href={repository + '#readme'} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(false)}>Documentation <ArrowUpRight size={12}/></a>
    </nav>
    <div className="nav-actions">
      <span className="topbar-network"><span className="pulse-dot"/> CORE / TOOLING</span>
      <button className="nav-console" onClick={() => {setMenu(false);navigate('studio')}}>Launch studio <ArrowUpRight size={15}/></button>
      <button className="mobile-toggle" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => setMenu(v => !v)}>{menu ? <X size={23}/> : <Menu size={23}/>}</button>
    </div>
  </header>
}
function Lens() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.to('.iris-ring-a', { rotate: 360, duration: 48, repeat: -1, ease: 'none' })
      gsap.to('.iris-ring-b', { rotate: -360, duration: 35, repeat: -1, ease: 'none' })
      gsap.to('.iris-ring-c', { rotate: 360, duration: 70, repeat: -1, ease: 'none' })
      gsap.to('.lens-core', { scale: 1.04, opacity: .9, yoyo: true, repeat: -1, duration: 3.2, ease: 'sine.inOut' })
      gsap.from('.lens-label', { y: 18, opacity: 0, duration: 1, stagger: .16, delay: .45 })
    }, root)
    return () => ctx.revert()
  }, [])
  return <div className="lens-visual" ref={root} aria-label="Animated illustration of an encrypted privacy boundary" role="img">
    <div className="lens-grid" aria-hidden="true"/>
    <div className="lens-ring iris-ring-c"><span className="radial-notch notch-one"/><span className="radial-notch notch-two"/></div>
    <div className="lens-ring iris-ring-a"><span className="ring-label">DATA MINIMIZATION · ZERO TRUST ·</span></div>
    <div className="lens-ring iris-ring-b"><span className="notch-chip"/></div>
    <div className="lens-core"><svg viewBox="0 0 96 96" fill="none"><path d="M20 29H70L25 69H74" stroke="currentColor" strokeWidth="7"/><path d="M65 17v18M56 26h18" stroke="currentColor" strokeWidth="2"/></svg></div>
    <div className="lens-label lens-label-one"><span className="signal-on"/> ACTIVE SIGNAL <span>01/04</span></div>
    <div className="lens-label lens-label-two">FIELD / ZERO-KNOWLEDGE</div>
    <div className="lens-label lens-label-three">ENFORCE THE BOUNDARY <ArrowUpRight size={14}/></div>
    <div className="lens-reticle reticle-a"/><div className="lens-reticle reticle-b"/>
  </div>
}
const records = [
  {key:'01', title:'Transaction handoffs', text:'Inspect intermediate PCZT fields before information crosses a signing boundary.', icon:Layers3},
  {key:'02', title:'Policy-driven checks', text:'Choose a disclosure profile and identify unwanted metadata at the field level.', icon:ScanLine},
  {key:'03', title:'Local by design', text:'Your transaction data stays in your browser or on your machine. No hosted analysis API.', icon:LockKeyhole},
  {key:'04', title:'Developer-native output', text:'Structured findings, machine-readable reports and deterministic exit codes for CI.', icon:Terminal},
]
function Home({ navigate }: { navigate: (v: View) => void }) {
  const scope = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!scope.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.from('.hero-eyebrow', { opacity: 0, y: 25, duration: .75 })
        .from('.hero-title .title-row', { opacity: 0, yPercent: 85, rotateX: -7, stagger: .13, duration: 1.05, ease: 'power4.out' }, '-=.48')
        .from('.hero-desc, .hero-controls, .hero-footnote', { opacity: 0, y: 28, duration: .8, stagger: .1 }, '-=.5')
      gsap.utils.toArray<HTMLElement>('.reveal').forEach(node => {
        gsap.from(node, { y: 54, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: node, start: 'top 88%', once: true } })
      })
    }, scope)
    return () => ctx.revert()
  }, [])
  return <main ref={scope}>
    <section className="hero screen-grid" aria-label="Zerynex introduction">
      <div className="hero-copy">
        <div className="hero-eyebrow"><span className="micro-diamond"/> A NEW STANDARD FOR ZCASH PRIVACY INFRASTRUCTURE <span className="line-fade"/></div>
        <h1 className="hero-title">
          <span className="title-clip"><span className="title-row">Privacy is</span></span>
          <span className="title-clip"><span className="title-row title-italic">a property<span className="green-stop">.</span></span></span>
          <span className="title-clip"><span className="title-row title-outline">Not a promise.</span></span>
        </h1>
        <p className="hero-desc">Meet Zerynex. A developer-first toolkit that turns invisible privacy assumptions into explicit, testable rules for Zcash transaction workflows.</p>
        <div className="hero-controls"><LinkArrow label="Enter privacy studio" onClick={() => navigate('studio')}/><a className="secondary-link" href={repository} target="_blank" rel="noopener noreferrer">Explore the source <ArrowUpRight size={17}/></a></div>
        <div className="hero-footnote"><span><i/> RUST × WEBASSEMBLY</span><span>001 — INDEPENDENT INFRASTRUCTURE</span></div>
      </div>
      <div className="hero-art"><Lens/></div>
      <div className="hero-side-label">SCROLL TO DECODE <ArrowDown size={14}/></div>
    </section>
    <div className="ticker" aria-label="Zerynex technologies"><div className="ticker-track">{Array.from({length:4}).map((_,i)=><span key={i}> ZCASH <span className="ticker-star">✳</span> ORCHARD <span className="ticker-star">✳</span> IRONWOOD <span className="ticker-star">✳</span> PCZT <span className="ticker-star">✳</span> PRIVACY BY CONSTRUCTION <span className="ticker-star">✳</span></span>)}</div></div>
    <section className="section protocol-section" id="protocol">
      <div className="section-meta reveal"><Kicker number="01">THE PROBLEM</Kicker><span className="section-hairline"/></div>
      <div className="problem-grid">
        <div className="problem-title reveal"><h2>A shielded transaction can still have an <em>exposed journey.</em></h2></div>
        <div className="problem-copy reveal"><p>Zcash protects on-chain transaction details. But a partially constructed transaction can carry sensitive metadata between creators, provers, signers, and other components.</p><p>Zerynex checks that boundary before it becomes someone else's problem.</p><a className="text-link" href="https://zips.z.cash/zip-0374" target="_blank" rel="noopener noreferrer">READ ZIP-374 <ArrowUpRight size={15}/></a></div>
      </div>
      <div className="journey reveal" aria-label="Transaction lifecycle">
        {['CREATE', 'INSPECT', 'AUTHORIZE', 'HANDOFF'].map((label,i)=><div className={'journey-step' + (i===1?' journey-selected':'')} key={label}>
          <div className="journey-top"><span>0{i+1}</span><span>{i===1?<ScanLine size={24}/>:<MoveUpRight size={21}/>}</span></div>
          <div className="journey-bottom"><strong>{label}</strong><span>{i===1?'POLICY CHECK':'TRANSACTION STAGE'}</span></div>
          {i<3 && <ArrowRight className="journey-arrow" size={22}/>}
        </div>)}
      </div>
      <div className="journey-caption reveal"><span>THE POINT OF INTERVENTION</span><p>Not another wallet. A check at the precise moment private data changes hands.</p></div>
    </section>
    <section className="section capabilities-section" id="capabilities">
      <div className="section-meta reveal"><Kicker number="02">CAPABILITIES</Kicker><span className="section-hairline"/></div>
      <div className="cap-head reveal"><h2>Built for the <em>unseen.</em></h2><p>Substance over spectacle. Engineering you can reproduce, inspect, and integrate.</p></div>
      <div className="cap-grid">{records.map(record=><article className="cap-card reveal" key={record.key}><div className="cap-card-top"><span>[ {record.key} ]</span><record.icon size={26} strokeWidth={1.4}/></div><div><h3>{record.title}</h3><p>{record.text}</p></div><div className="cap-corner"><ArrowUpRight size={18}/></div></article>)}</div>
    </section>
    <section className="statement-section" id="principles">
      <div className="statement-panel reveal">
        <div className="statement-left"><Kicker number="03">OUR PRINCIPLE</Kicker><span className="statement-glyph">✳</span><span className="statement-foot">DESIGNED FOR HUMAN TRUST.<br/>BUILT FOR MACHINE VERIFICATION.</span></div>
        <div className="statement-right"><h2>Less disclosure.<br/><em>More certainty.</em></h2><p>Privacy is not a visual effect or a checkbox. It is a concrete engineering constraint. We make those constraints visible.</p><LinkArrow light label="Test a handoff" onClick={() => navigate('studio')}/></div>
      </div>
    </section>
    <section className="section section-open">
      <div className="section-meta reveal"><Kicker number="04">OPEN INFRASTRUCTURE</Kicker><span className="section-hairline"/></div>
      <div className="open-grid">
        <div className="reveal"><span className="open-kicker">START WHERE YOU ARE</span><h2>Production-minded.<br/><em>Open from day one.</em></h2><p>A real Rust core, the same analysis engine in a local-first browser workspace, documented limitations, and a GitHub CI baseline. No wallet secrets. No hidden server.</p><div className="open-actions"><LinkArrow label="Open the studio" onClick={() => navigate('studio')}/></div></div>
        <div className="terminal-card reveal"><div className="terminal-top"><span><i/><i/><i/></span><span>TERMINAL · ZERYNEX CLI</span></div><div className="terminal-lines"><div><span className="terminal-prompt">➜</span> cargo run -- ./handoff.pczt --json</div><div className="terminal-muted"># Local policy analysis</div><div className="terminal-muted"># Check Orchard & Ironwood handoffs</div><div className="terminal-ok"><CircleCheck size={15}/> Reports emit field paths, never values.</div></div><div className="terminal-bottom">RUST CORE <span>MIT LICENSE</span></div></div>
      </div>
    </section>
    <footer className="footer">
      <div className="footer-upper"><div><Mark small/><h2>Make privacy <em>provable.</em></h2></div><button onClick={() => navigate('studio')} className="footer-cta">OPEN STUDIO <ArrowUpRight size={28}/></button></div>
      <div className="footer-lower"><span>© {new Date().getFullYear()} ZERYNEX · BUILT FOR ZCASH</span><span>OPEN SOURCE · RUST · PCZT</span><a href={repository} target="_blank" rel="noopener noreferrer">GITHUB <ArrowUpRight size={13}/></a></div>
    </footer>
  </main>
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
function Studio({ navigate }: { navigate: (v: View) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [profile, setProfile] = useState<Profile>('external-signer')
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
    const ctx = gsap.context(() => {
      gsap.from('.studio-reveal', { y: 20, opacity: 0, stagger: .09, duration: .7, ease:'power3.out' })
    }, root)
    return () => ctx.revert()
  }, [])
  const choose = (candidate?: File | null) => {
    if(!candidate) return
    setFile(candidate)
    setReport(null)
    setError(null)
    setTab('result')
    if(candidate.size > 8 * 1024 * 1024) setError('File exceeds the 8 MiB maximum.')
  }
  const loadSynthetic = async (which: 'clean' | 'flagged') => {
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
      const result = await inspectPczt(file, profile)
      setReport(result)
      setTab('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to analyze this file.'
      setError(msg.includes('fetch') || msg.includes('import') ? 'The browser Rust engine is not available in this build. Use the Rust CLI locally instead.' : msg)
    } finally {
      setBusy(false)
    }
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
    <div className="studio-top studio-reveal"><button className="back-button" onClick={() => navigate('home')}><ArrowLeft size={17}/> BACK TO OVERVIEW</button><span className="studio-code">ZERYNEX / WORKSPACE <span>001</span></span></div>
    <div className="studio-heading studio-reveal"><div><Kicker>YOUR PRIVATE WORKSPACE</Kicker><h1>Inspect the <em>invisible.</em></h1><p>One local file. Explicit policies. No secrets leave this device.</p></div><div className={'engine-pill '+engine}><span className="live-led"/>{engine === 'ready' ? 'RUST ENGINE READY' : engine === 'loading' ? 'ENGINE INITIALIZING' : 'ENGINE UNAVAILABLE'}</div></div>
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
          <div className="fixture-row"><span>TRY A SYNTHETIC PCZT</span><div><button onClick={() => loadSynthetic('clean')}>Clean v6 <ArrowUpRight size={14}/></button><button onClick={() => loadSynthetic('flagged')}>Flagged v6 <ArrowUpRight size={14}/></button></div></div>
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
            <div className="report-details"><span>PROFILE</span><strong>{report.profile.replaceAll('_',' ')}</strong><span>CHECKED POOLS</span><strong>{report.checked_pools.join(' / ')}</strong></div>
            {report.findings.length>0 && <div className="findings-list">{report.findings.map((f,i)=><div className="finding" key={i}><span>{f.rule}</span><strong>{f.field}</strong><p>{f.explanation}</p></div>)}</div>}
            <p className="disclaimer">{report.disclaimer}</p>
            <div className="report-actions"><button onClick={download}><Download size={16}/> Export JSON</button><button onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied':'Copy report'}</button></div>
          </div>
          : <div className="empty-report">{error?<div className="analysis-error"><CircleAlert size={30}/><strong>Unable to analyze</strong><p>{error}</p></div>:<><div className="scan-emblem"><Fingerprint size={66} strokeWidth={.75}/></div><span className="console-counter">AWAITING SOURCE / 000</span><h3>Your privacy report<br/><em>starts here.</em></h3><p>Load a real binary PCZT, choose a disclosure profile, and run the Rust engine. Results appear here.</p><div className="console-coordinate">IN / BROWSER ONLY · 127.0.0.1 PRINCIPLE</div></>}</div>
        )}
        <div className="results-bottom"><span><span className="live-led"/> ZERO UPLOAD ARCHITECTURE</span><span>EARLY ACCESS / V0.1</span></div>
      </section>
    </div>
    <section className="studio-help studio-reveal"><div><Terminal size={19}/><strong>Prefer your terminal?</strong><p>Run the same engine as a local Rust CLI. No service dependency.</p></div><code>cargo run -- path/to/file.pczt --profile external-signer --json</code><a href={repository} target="_blank" rel="noopener noreferrer">View the repository <ArrowUpRight size={16}/></a></section>
    <div className="studio-bottom-note"><span>NOT A CONSENSUS VALIDATOR OR SECURITY AUDIT</span><a href="https://zips.z.cash/zip-0374" target="_blank" rel="noopener noreferrer">ZIP-374 REFERENCE <ArrowUpRight size={13}/></a></div>
  </main>
}
export default function App() {
  const viewFromHash = (): View => window.location.hash.startsWith('#/studio') ? 'studio' : 'home'
  const [view,setView] = useState<View>(viewFromHash)
  useEffect(() => { const onHash = () => setView(viewFromHash()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange',onHash) },[])
  const navigate = (next: View) => {
    window.location.hash = next==='studio' ? '/studio' : '/'
    setView(next)
    window.scrollTo({top:0,behavior:'instant'})
  }
  return <>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <div id="main-content">
      <Header current={view} navigate={navigate}/>
      {view === 'home' ? <Home navigate={navigate}/> : <Studio navigate={navigate}/>}
    </div>
    <div className="floating-index" aria-hidden="true"><span>ZNX</span><span>{view==='home'?'01 / 02':'02 / 02'}</span><ChevronDown size={14}/></div>
  </>
}
