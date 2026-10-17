'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { LuArrowUpRight, LuArrowRight, LuShieldCheck, LuLayers, LuGitCompare,
  LuLockKeyhole, LuTerminal, LuWorkflow, LuCheck, LuScanLine, LuCheckCheck, LuBookOpen,
  LuPlay, LuNetwork, LuChevronRight, LuFileCode2 } from 'react-icons/lu'
import { inspectPczt, loadEngine, type Report } from './analyzer'

const capabilities = [
  {n:'01', title:'Inspect a PCZT', desc:'Know which disclosure policy fields appear before signing or handoff.', icon:LuScanLine,href:'/tools',state:'LIVE IN BROWSER'},
  {n:'02', title:'Compare stages', desc:'Detect new metadata and changed shielded or transparent components.',icon:LuGitCompare,href:'/tools/stages',state:'LIVE IN BROWSER'},
  {n:'03', title:'Role handoffs',desc:'Replay reproducible PCZT role snapshots against expected privacy invariants.',icon:LuLayers,href:'/tools/handoff',state:'SYNTHETIC TESTS'},
  {n:'04', title:'SDK and CI',desc:'Add checks to app pipelines with one canonical Rust engine and reusable adapters.',icon:LuTerminal,href:'/docs/installation',state:'SOURCE INTEGRATIONS'},
]
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
        <span><LuCheck size={14}/> Input decoded</span>
        <span><LuShieldCheck size={14}/> Policy loaded</span>
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
        <MotionTitle className="zn-overline"><span className="zn-overline-dot"/> ZCASH CORE INFRASTRUCTURE / LOCAL-FIRST BY DESIGN</MotionTitle>
        <MotionTitle><h1>Privacy tooling,<br/><em>without friction.</em></h1></MotionTitle>
        <MotionTitle><p className="zn-hero-text">Inspect transaction boundaries, catch regressions, and integrate privacy checks without building another wallet or uploading sensitive PCZTs.</p></MotionTitle>
        <MotionTitle className="zn-hero-actions"><Link href="/tools" className="zn-primary">Launch workbench <LuArrowUpRight size={19}/></Link><Link href="/docs/installation" className="zn-secondary">Explore SDKs <LuArrowRight size={19}/></Link></MotionTitle>
        <MotionTitle className="zn-hero-foot"><span><LuShieldCheck size={15}/> OPEN SOURCE ENGINE</span><span><LuLockKeyhole size={15}/> BROWSER-LOCAL ANALYSIS</span><span><LuNetwork size={15}/> ZCASH PCZT V6</span></MotionTitle>
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
    <section className="zn-proof-strip"><span>ONE ENGINE / MANY WAYS TO BUILD</span><div><strong>Rust</strong><i/><strong>TypeScript</strong><i/><strong>Python</strong><i/><strong>Go</strong><i/><strong>MCP</strong></div><Link href="/ecosystem">See integrations <LuArrowUpRight size={17}/></Link></section>
    <section className="zn-demonstration">
      <div className="zn-section-copy zn-scroll-reveal">
        <span className="zn-section-tag">01 / THE PRODUCT, NOT A PROMISE</span>
        <h2>Go from question<br/>to <em>finding.</em></h2>
        <p>Run an actual PCZT policy check here. We ship reproducible, harmless fixtures so you can test Zerynex before adding it to any application.</p>
        <div className="zn-signal-list">
          <div><LuCheck size={16}/> Parsed by the Rust PCZT engine</div>
          <div><LuCheck size={16}/> Clear rule IDs and component paths</div>
          <div><LuCheck size={16}/> No backend transaction processing</div>
        </div>
        <Link className="zn-inline-link" href="/tools/stages">Try stage comparisons <LuArrowUpRight size={17}/></Link>
      </div>
      <div className="zn-scroll-reveal"><LivePreview/></div>
    </section>
    <section className="zn-capabilities">
      <div className="zn-section-header zn-scroll-reveal"><span className="zn-section-tag">02 / THE TOOLBOX</span><h2>Less setup.<br/><em>More shipping.</em></h2><p>Real utilities, not showcase screens. Each one opens to a working capability or a tested integration guide.</p></div>
      <div className="zn-capability-grid">{capabilities.map(cap=><motion.div key={cap.n} whileHover={reduced?{}:{y:-7}} transition={{type:'spring',stiffness:270,damping:23}} className="zn-scroll-reveal"><Link href={cap.href} className="zn-cap-card"><div><span>{cap.n} / {cap.state}</span><cap.icon size={25}/></div><h3>{cap.title}</h3><p>{cap.desc}</p><LuArrowUpRight size={21} className="zn-cap-arrow"/></Link></motion.div>)}</div>
    </section>
    <section className="zn-adoption">
      <div className="zn-scroll-reveal">
        <span className="zn-section-tag">03 / BUILD WHERE YOU ALREADY WORK</span>
        <h2>Your stack.<br/><em>One source of truth.</em></h2>
        <p>Use the hosted workbench with zero installation. For your codebase, bring in the SDK or run the standalone CLI. You don&apos;t have to clone the monorepo to inspect a PCZT.</p>
        <div className="zn-adoption-actions"><Link className="zn-primary" href="/ecosystem">Choose a language <LuArrowUpRight size={17}/></Link><Link href="/docs/installation" className="zn-secondary">Integration guide <LuBookOpen size={17}/></Link></div>
      </div>
      <div className="zn-code-surface zn-scroll-reveal">
        <div><span>TypeScript / packaged Rust WASM SDK</span><LuTerminal size={17}/></div>
        <pre><code>{code}</code></pre>
        <div><span>Local Rust/WASM · npm tarball tested, registry pending</span><LuCheckCheck size={17}/></div>
      </div>
    </section>
    <section className="zn-agent-feature zn-scroll-reveal">
      <div><span className="zn-section-tag">04 / ASSISTED ENGINEERING</span><h2>Agents with<br/><em>boundaries.</em></h2><p>A local MCP server, reusable agent skill, and CI gates. Agent workflows analyze approved synthetic fixtures and return sanitized findings—not unrestricted wallet access.</p><Link className="zn-inline-link" href="/agents">Explore agent tooling <LuArrowUpRight size={17}/></Link></div>
      <div className="zn-agent-path">
        <span><LuWorkflow size={19}/> AI assistant</span><LuChevronRight size={16}/><span><LuShieldCheck size={19}/> Restricted MCP</span><LuChevronRight size={16}/><span><LuFileCode2 size={19}/> Synthetic fixture</span>
        <small>READ-ONLY · NO SIGNING KEYS · NO WALLET RPC</small>
      </div>
    </section>
    <footer className="zn-footer"><div><strong>ZERYNEX</strong><span>BUILD PRIVACY INTO YOUR STACK.</span></div><nav><Link href="/tools">Tools</Link><Link href="/ecosystem">SDKs</Link><Link href="/agents">Agents</Link><Link href="/docs">Docs</Link></nav><small>ZCASH CORE & TOOLING / {new Date().getFullYear()}</small></footer>
  </main>
}
