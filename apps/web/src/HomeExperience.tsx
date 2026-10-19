'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { LuArrowUpRight, LuArrowRight, LuShieldCheck, LuGitCompare,
  LuLockKeyhole, LuTerminal, LuWorkflow, LuCheck, LuScanLine, LuCheckCheck, LuBookOpen,
  LuPlay, LuNetwork, LuChevronRight, LuFileCode2 } from 'react-icons/lu'
import { inspectPczt, loadEngine, type Report } from './analyzer'

const capabilities = [
  {n:'01', title:'Inspect a PCZT', desc:'Know which disclosure policy fields appear before signing or handoff.', icon:LuScanLine,href:'/tools',state:'LIVE IN BROWSER'},
  {n:'02', title:'Compare stages', desc:'Detect new metadata and changed shielded or transparent components.',icon:LuGitCompare,href:'/tools/stages',state:'LIVE IN BROWSER'},
  {n:'03', title:'Check node readiness',desc:'Review network and synchronization state before connecting Zcash applications.',icon:LuNetwork,href:'/tools/node',state:'LOCAL / READ ONLY'},
  {n:'04', title:'ZIP-321 requests',desc:'Inspect payment URIs with strict network and address validation before wallet approval.',icon:LuTerminal,href:'/tools/payment',state:'RUST / WASM'},
]
const ecosystemWorkflows = [
  {
    code: '01', type: 'SUPPORTED / LOCAL WASM',
    title: 'Transaction privacy policies',
    description: 'Inspect PCZT fields, detect transparent components and review disclosure rules before a transaction is handed off.',
    href: '/tools', cta: 'Run policy inspector',
  },
  {
    code: '02', type: 'SUPPORTED / SYNTHETIC REGRESSION',
    title: 'Wallets and signing handoffs',
    description: 'Compare PCZT stages and test upstream Creator, Updater, Combiner and Redactor fixtures without exposing wallet data.',
    href: '/tools/handoff', cta: 'Run handoff checks',
  },
  {
    code: '03', type: 'SUPPORTED / CI + SDK',
    title: 'Protocol and application CI',
    description: 'Catch new findings across transaction stages through the Rust CLI, SDKs and reproducible pull-request checks.',
    href: '/tools/stages', cta: 'Compare transaction stages',
  },
  {
    code: '04', type: 'PREVIEW / OFFLINE CONTRACTS',
    title: 'Zcash node and RPC integrations',
    description: 'Run read-only loopback node network/sync checks and verify pinned RPC method contracts. No wallet access, consensus audit, or arbitrary network RPC.',
    href: '/tools/node', cta: 'Check node readiness',
  },
  {
    code: '05', type: 'SUPPORTED / APPLICATION INTEGRATIONS',
    title: 'Payments, markets and cross-chain apps',
    description: 'Compose node readiness, policy checks and SDK interfaces into real applications; payment construction, wallet signing and settlement remain your app’s responsibility.',
    href: '/docs/zcash-app-recipes', cta: 'See Zcash app recipes',
  },
  {
    code: '06', type: 'SUPPORTED / APPROVED FIXTURES',
    title: 'Agent-assisted privacy reviews',
    description: 'Connect restricted local MCP tools, inspect synthetic fixtures and explain known privacy-policy findings.',
    href: '/agents', cta: 'Explore agent workflows',
  },
] as const

const code = "import { createBrowserZerynexClient } from '@zerynex/sdk/browser'\n\nconst client = createBrowserZerynexClient({ wasm: trustedWasmBytes })\n\nconst report = await client.analyzeBlob(file, { deny_transparent: true })\nconsole.log(report.findings)"

function MotionTitle({children,className=''}:{children:React.ReactNode,className?:string}) {
  return <motion.div className={className} initial={false}>{children}</motion.div>
}

function LivePreview() {
  const [state,setState]=useState<'idle'|'loading'|'complete'|'error'>('idle')
  const [ready,setReady]=useState(false)
  useEffect(()=>{let live=true;loadEngine().then(()=>{if(live)setReady(true)}).catch(()=>{if(live)setState('error')});return ()=>{live=false}},[])
  const [report,setReport]=useState<Report|null>(null)
  async function run(){
    setState('loading');setReport(null)
    try {
      const fetched=await fetch('/examples/transparent-v6.bin')
      if(!fetched.ok)throw new Error('Fixture missing')
      const bytes=await fetched.arrayBuffer()
      const result=await inspectPczt(new File([bytes],'transparent-synthetic.pczt'),'external-signer',{denyTransparent:true,denySapling:false})
      setReport(result);setState('complete')
    } catch {setState('error')}
  }
  return <div className="zn-preview" aria-label="Interactive PCZT analyzer preview">
    <div className="zn-preview-top"><span><i/><i/><i/></span><strong>privacy-check / synthetic.pczt</strong><span className="zn-preview-status">RUST / WASM</span></div>
    <div className="zn-preview-body">
      <div className="zn-preview-label"><LuFileCode2 size={16}/> SHIELDED-ONLY POLICY <span>v6 PCZT</span></div>
      <div className="zn-preview-track">
        <span><LuCheck size={14}/> {state==='complete'?'Input decoded':'Input queued'}</span>
        <span><LuShieldCheck size={14}/> {state==='complete'?'Policy loaded':'Policy selected'}</span>
        <span className={state==='complete'?'zn-preview-hot':''}><LuScanLine size={14}/> Findings</span>
      </div>
      <div className="zn-preview-rule"><span>policy.deny_transparent</span><strong>true</strong></div>
      <div className="zn-preview-rule"><span>input</span><strong>transparent-synthetic.pczt</strong></div>
      <AnimatePresence mode="wait">
        <motion.div key={state} className="zn-preview-result" initial={{opacity:0,y:9}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-7}} transition={{duration:.2}} aria-live="polite">
          {state==='idle'&&<><span className="zn-preview-empty">Ready to analyze synthetic fixture.</span><small>Click run to invoke the actual Rust engine.</small></>}
          {state==='loading'&&<span className="zn-preview-empty">Analyzing locally...</span>}
          {state==='error'&&<span role="alert" className="zn-preview-error">Unable to load the local Rust/WASM engine.</span>}
          {state==='complete'&&<><span className="zn-preview-result-head">DETECTED / {report?.findings.length??0} POLICY FINDING</span>{report?.findings.map((finding,i)=><div className="zn-preview-finding" key={i}><strong>{finding.rule}</strong><span>{finding.field}</span></div>)}</>}
        </motion.div>
      </AnimatePresence>
    </div>
    <p className="zn-preview-source">BUNDLED TEST VECTOR / NOT CONNECTED TO YOUR DEVICE</p>
    <div className="zn-preview-footer"><button type="button" disabled={!ready||state==='loading'} onClick={()=>void run()}><LuPlay size={16}/>{!ready?'Preparing local engine':state==='complete'?'Run again':'Run synthetic check'}</button><span><LuLockKeyhole size={14}/> Zero private uploads</span></div>
  </div>
}

export default function HomeExperience() {
  const scope=useRef<HTMLElement>(null)
  const reduced=useReducedMotion()
  useEffect(()=>{
    if(!scope.current||reduced)return
    gsap.registerPlugin(ScrollTrigger)
    const ctx=gsap.context(()=>{
      gsap.fromTo('.zn-hero-content > div',{opacity:0,y:30},{opacity:1,y:0,duration:.68,stagger:.1,ease:'power3.out'})
      gsap.utils.toArray<HTMLElement>('.zn-scroll-reveal').forEach(el=>{
        gsap.fromTo(el,{opacity:0,y:35},{opacity:1,y:0,duration:.85,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 90%',once:true}})
      })
      gsap.to('.zn-orbit-inner',{rotation:250,duration:38,ease:'none',repeat:-1,transformOrigin:'center center'})
      gsap.to('.zn-orbit-outer',{rotation:-250,duration:56,ease:'none',repeat:-1,transformOrigin:'center center'})
      gsap.to('.zn-hero-glow',{yPercent:13,ease:'none',scrollTrigger:{trigger:'.zn-hero',start:'top top',end:'bottom top',scrub:true}})
    },scope)
    return ()=>ctx.revert()
  },[reduced])
  return <main className="zn-home" ref={scope}>
    <section className="zn-hero">
      <div className="zn-hero-content">
        <MotionTitle className="zn-overline"><span className="zn-overline-dot"/> ZERYNEX / ZCASH DEVELOPER INFRASTRUCTURE</MotionTitle>
        <MotionTitle><h1>Build for Zcash. <em>Privacy comes first.</em></h1></MotionTitle>
        <MotionTitle><p className="zn-hero-text">Zerynex is a local-first developer toolkit for Zcash applications. Combine PCZT privacy-policy checks, node-readiness diagnostics, RPC compatibility testing, SDKs, CI and controlled agent workflows inside your own wallets, payments systems and protocol infrastructure.</p></MotionTitle>
        <MotionTitle className="zn-hero-actions"><Link href="/tools" className="zn-primary">Explore developer tools <LuArrowUpRight size={19}/></Link><Link href="/docs/zcash-app-recipes" className="zn-secondary">Integration recipes <LuArrowRight size={19}/></Link></MotionTitle>
        <MotionTitle className="zn-hero-foot"><span><LuShieldCheck size={15}/> OPEN SOURCE ENGINE</span><span><LuLockKeyhole size={15}/> BROWSER-LOCAL ANALYSIS</span><span><LuNetwork size={15}/> BUILT FOR ZCASH</span></MotionTitle>
      </div>
      <div className="zn-hero-visual" aria-hidden="true">
        <div className="zn-hero-glow"/>
        <svg className="zn-hero-geometry" viewBox="0 0 580 580" fill="none">
          <circle cx="290" cy="290" r="235" stroke="currentColor" opacity=".20" strokeDasharray="5 9" className="zn-orbit-outer"/>
          <circle cx="290" cy="290" r="180" stroke="currentColor" opacity=".38" strokeDasharray="2 11" className="zn-orbit-inner"/>
          <circle cx="290" cy="290" r="118" stroke="currentColor" opacity=".50"/>
          <circle cx="290" cy="55" r="7" fill="var(--zn-acid)"/>
          <circle cx="110" cy="290" r="5" fill="var(--zn-acid)"/>
          <path d="M224 231H366L224 351H364" stroke="var(--zn-acid)" strokeWidth="26" strokeLinejoin="round"/>
          <circle cx="390" cy="225" r="10" fill="var(--zn-acid)"/>
        </svg>
        <span className="zn-geometry-label zn-label-top">FIELD-LEVEL INSPECTION</span>
        <span className="zn-geometry-label zn-label-bottom">VERIFIABLE WORKFLOWS / 001</span>
      </div>
    </section>
    <section className="zn-proof-strip" aria-label="Zcash development workflows"><span>DEVELOPMENT SURFACES</span><div><strong>PCZT</strong><i/><strong>Wallet handoffs</strong><i/><strong>Regression CI</strong><i/><strong>RPC tooling</strong><i/><strong>Node readiness</strong><i/><strong>Local MCP</strong></div><Link href="/ecosystem">SDK interfaces <LuArrowUpRight size={17}/></Link></section>
    <section className="zn-entryways" aria-labelledby="zn-entryways-title">
      <div className="zn-entryways-heading">
        <span className="zn-section-tag">CHOOSE HOW TO START</span>
        <h2 id="zn-entryways-title">A demo is not <em>your project.</em></h2>
        <p>Explore a shipped synthetic fixture, choose a PCZT from your own device, or install the toolkit into your development workflow. Nothing automatically connects to your machine.</p>
      </div>
      <div className="zn-entryways-grid">
        <Link href="/#synthetic-demo" className="zn-entryway-card">
          <span>01 / NO INSTALLATION</span>
          <LuPlay size={27}/>
          <h3>Try demo</h3>
          <p>Run the actual Rust/WASM analyzer on a bundled, nonspendable PCZT. These results are deliberately reproducible, not from your computer.</p>
          <strong>Use example data <LuArrowUpRight size={17}/></strong>
        </Link>
        <Link href="/tools" className="zn-entryway-card">
          <span>02 / YOUR FILE · YOUR BROWSER</span>
          <LuFileCode2 size={27}/>
          <h3>Analyze your PCZT</h3>
          <p>Choose a local PCZT and policy in the web workbench. Your browser runs the analysis; the site does not automatically inspect your filesystem.</p>
          <strong>Open file workbench <LuArrowUpRight size={17}/></strong>
        </Link>
        <Link href="/integrate" className="zn-entryway-card">
          <span>03 / YOUR CODEBASE · YOUR TOOLCHAIN</span>
          <LuTerminal size={27}/>
          <h3>Integrate into your project</h3>
          <p>Install the CLI or SDK, configure policies, and connect reproducible CI or restricted MCP workflows in your own trusted environment.</p>
          <strong>Choose an integration <LuArrowUpRight size={17}/></strong>
        </Link>
      </div>
    </section>
    <section className="zn-ecosystem-workflows" aria-labelledby="zn-ecosystem-title">
      <div className="zn-workflows-heading zn-scroll-reveal">
        <span className="zn-section-tag">01 / BUILT FOR ZCASH DEVELOPMENT</span>
        <h2 id="zn-ecosystem-title">One toolkit. <em>Across the ecosystem.</em></h2>
        <p>Start with Zcash transaction privacy. Bring the same tested checks into application builds, wallet handoffs, protocol CI and approved local agent workflows. Each integration tells you exactly what is supported.</p>
      </div>
      <div className="zn-workflow-table">
        {ecosystemWorkflows.map(workflow=><Link className="zn-workflow-row zn-scroll-reveal" href={workflow.href} key={workflow.code}>
          <span className="zn-workflow-num">{workflow.code}</span>
          <div className="zn-workflow-info"><span>{workflow.type}</span><h3>{workflow.title}</h3><p>{workflow.description}</p></div>
          <span className="zn-workflow-action">{workflow.cta} <LuArrowUpRight size={19}/></span>
        </Link>)}
      </div>
    </section>
    <section className="zn-demonstration" id="synthetic-demo">
      <div className="zn-section-copy zn-scroll-reveal">
        <span className="zn-section-tag">02 / BUNDLED SYNTHETIC DEMO</span>
        <h2>From a question <em>to a finding.</em></h2>
        <p>This runs the real Rust/WebAssembly engine against a <strong>preloaded, nonspendable PCZT fixture</strong> shipped with the website. It is a demo—not a scan of your computer or Zcash project.</p>
        <div className="zn-signal-list">
          <div><LuCheck size={16}/> Parsed by the Rust PCZT engine</div>
          <div><LuCheck size={16}/> Clear rule IDs and component paths</div>
          <div><LuCheck size={16}/> No backend transaction processing</div>
        </div>
        <Link className="zn-inline-link" href="/tools">Analyze your own PCZT instead <LuArrowUpRight size={17}/></Link>
      </div>
      <div className="zn-scroll-reveal"><LivePreview/></div>
    </section>
    <section className="zn-capabilities">
      <div className="zn-section-header zn-scroll-reveal"><span className="zn-section-tag">03 / PRIVACY TESTING WORKBENCHES</span><h2>Test locally. <em>Build confidently.</em></h2><p>Real Rust-backed utilities—not showcase screens. Start with approved PCZT fixtures, examine findings and move directly into a working integration.</p></div>
      <div className="zn-capability-grid">{capabilities.map(cap=><motion.div key={cap.n} whileHover={reduced?{}:{y:-7}} transition={{type:'spring',stiffness:270,damping:23}} className="zn-scroll-reveal"><Link href={cap.href} className="zn-cap-card"><div><span>{cap.n} / {cap.state}</span><cap.icon size={25}/></div><h3>{cap.title}</h3><p>{cap.desc}</p><LuArrowUpRight size={21} className="zn-cap-arrow"/></Link></motion.div>)}</div>
    </section>
    <section className="zn-adoption">
      <div className="zn-scroll-reveal">
        <span className="zn-section-tag">04 / SDKs AND DEVELOPER AUTOMATION</span>
        <h2>Integrate checks <em>where you build.</em></h2>
        <p>The hosted workbench needs no installation. For Zcash applications, wallet software and CI, choose a language adapter, a bundled WebAssembly SDK or the standalone Rust CLI. Cloning the entire product repository is optional.</p>
        <div className="zn-adoption-actions"><Link className="zn-primary" href="/ecosystem">Choose a language <LuArrowUpRight size={17}/></Link><Link href="/integrate" className="zn-secondary">Integrate your project <LuBookOpen size={17}/></Link></div>
      </div>
      <div className="zn-code-surface zn-scroll-reveal">
        <div><span>TypeScript / packaged Rust WASM SDK</span><LuTerminal size={17}/></div>
        <pre><code>{code}</code></pre>
        <div><span>Local Rust/WASM · npm tarball tested, registry pending</span><LuCheckCheck size={17}/></div>
      </div>
    </section>
    <section className="zn-agent-feature zn-scroll-reveal">
      <div><span className="zn-section-tag">05 / RESTRICTED AGENT TOOLING</span><h2>Agent workflows. <em>Clear boundaries.</em></h2><p>A local MCP server, reusable agent skill, and CI gates. Agent workflows analyze approved synthetic fixtures and return sanitized findings—not unrestricted wallet access.</p><Link className="zn-inline-link" href="/agents">Explore agent tooling <LuArrowUpRight size={17}/></Link></div>
      <div className="zn-agent-path">
        <span><LuWorkflow size={19}/> AI assistant</span><LuChevronRight size={16}/><span><LuShieldCheck size={19}/> Restricted MCP</span><LuChevronRight size={16}/><span><LuFileCode2 size={19}/> Synthetic fixture</span>
        <small>READ-ONLY · NO SIGNING KEYS · NO WALLET RPC</small>
      </div>
    </section>
    <footer className="zn-footer"><div><strong>ZERYNEX</strong><span>ZCASH DEVELOPER TOOLS / PRIVACY-FIRST INFRASTRUCTURE.</span></div><nav><Link href="/tools">Tools</Link><Link href="/ecosystem">SDKs</Link><Link href="/agents">Agents</Link><Link href="/docs">Docs</Link></nav><small>ZCASH CORE & TOOLING / {new Date().getFullYear()}</small></footer>
  </main>
}
