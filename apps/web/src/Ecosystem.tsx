'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { LuArrowUpRight, LuCheck, LuCopy, LuTerminal, LuShieldCheck, LuBookOpen, LuPackage } from 'react-icons/lu'

const integrations=[
 {id:'Rust',state:'Compiled CLI + source',title:'Rust core',desc:'Use the canonical policy engine, CLI, and offline role-handoff harness.',command:'zerynex synthetic.pczt --json\n\n# CLI source installation steps are in the guide.',guide:'/docs/rust-api',caveat:'Standalone CLI archives are built and tested for supported platforms; Cargo installation remains an alternative.'},
 {id:'TypeScript',state:'Bundled SDK artifact',title:'TypeScript + WASM',desc:'Run privacy checks directly inside your app using the canonical Rust/WebAssembly parser.',command:"import { createBrowserZerynexClient } from '@zerynex/sdk/browser'\n\nconst client = createBrowserZerynexClient({ wasm: trustedWasmBytes })\nconst report = await client.analyzeBlob(file, { deny_transparent: true })",guide:'/docs/typescript-api',caveat:'The independently tested npm tarball bundles real Rust/WASM. Public npm registry publication is still pending.'},
 {id:'Python',state:'Wheel + CLI',title:'Python',desc:'Script local PCZT checks and regression test runs by calling the trusted Rust binary.',command:"from zerynex_py import ZerynexClient\n\nclient = ZerynexClient(cli='/path/to/zerynex')\nreport = client.analyze_file('synthetic.pczt')",guide:'/docs/python-api',caveat:'A source-free Python wheel is tested against the compiled local Rust CLI. PyPI publication is still pending.'},
 {id:'Go',state:'Source adapter',title:'Go',desc:'Apply the same Rust policy engine in a Go service without a second cryptographic implementation.',command:'client := zerynex.Client{Binary: "/path/to/zerynex"}\nreport, err := client.AnalyzeFile(ctx, fixturePath, zerynex.Policy{})',guide:'/docs/go-sdk',caveat:'This Go source module uses a local Rust executable. There is no published standalone release yet.'},
] as const

export default function Ecosystem() {
 const [selected,setSelected]=useState<(typeof integrations)[number]['id']>('TypeScript')
 const [copied,setCopied]=useState(false)
 const root=useRef<HTMLElement>(null)
 const reduced=useReducedMotion()
 const lane=integrations.find(i=>i.id===selected)!
 useEffect(()=>{
  if(!root.current||reduced)return
  const ctx=gsap.context(()=>gsap.from('.zn-ecos-reveal',{opacity:0,y:24,stagger:.11,duration:.8,ease:'power3.out'}),root)
  return ()=>ctx.revert()
 },[reduced])
 async function copy(){
  try{await navigator.clipboard.writeText(lane.command);setCopied(true)}catch{setCopied(false)}
 }
 return <main className="zn-ecos" ref={root}>
  <header className="zn-ecos-header zn-ecos-reveal"><span className="zn-section-tag">LANGUAGE INTEGRATIONS / SDKs</span><h1>Bring Zcash privacy checks <em>into your code.</em></h1><p>SDKs are integration interfaces—not the product&apos;s limit. Select your programming language to use the canonical Rust policy engine inside Zcash wallets, transaction workflows and infrastructure applications.</p></header>
  <div className="zn-language-panel zn-ecos-reveal">
   <div className="zn-language-select" role="group" aria-label="Choose programming language">
    {integrations.map(i=><button type="button" key={i.id} aria-pressed={i.id===selected} onClick={()=>{setSelected(i.id);setCopied(false)}}><span>{i.id}</span><small>{i.state}</small></button>)}
   </div>
   <div className="zn-language-detail">
    <AnimatePresence mode="wait"><motion.div key={lane.id} initial={false} animate={{opacity:1,y:0}} exit={reduced?{}:{opacity:0,y:-10}} transition={{duration:.28}}>
     <div className="zn-language-top"><span>ACTIVE INTERFACE / {lane.id.toUpperCase()}</span><LuPackage size={22}/></div>
     <h2>{lane.title}</h2><p>{lane.desc}</p>
     <div className="zn-code-surface"><div><span>{lane.id} / Quickstart</span><button type="button" aria-label="Copy quickstart commands" onClick={()=>void copy()}>{copied?<LuCheck size={16}/>:<LuCopy size={16}/>} {copied?'Copied':'Copy'}</button></div><pre><code>{lane.command}</code></pre></div>
     <div className="zn-language-caveat"><LuShieldCheck size={17}/>{lane.caveat}</div>
     <Link className="zn-inline-link" href={lane.guide}>Read integration guide <LuArrowUpRight size={17}/></Link>
    </motion.div></AnimatePresence>
   </div>
  </div>
  <section className="zn-stack-paths zn-ecos-reveal">
   <div><span className="zn-section-tag">BEYOND LANGUAGE BINDINGS</span><h2>More than <em>language bindings.</em></h2></div>
   <div><Link href="/docs/github-action"><LuTerminal size={23}/><strong>CI / GitHub Actions</strong><p>Check synthetic regression fixtures on every pull request.</p><LuArrowUpRight size={19}/></Link>
   <Link href="/agents"><LuShieldCheck size={23}/><strong>MCP + agent skills</strong><p>Restricted tools for approved local fixtures and AI-assisted development.</p><LuArrowUpRight size={19}/></Link>
   <Link href="/docs/zk-prover-handoffs"><LuBookOpen size={23}/><strong>ZK / proving research</strong><p>Stage-structure checks today, proof integration still under research.</p><LuArrowUpRight size={19}/></Link></div>
  </section>
  <motion.section className="zn-distribution-section"
    initial={reduced?false:{opacity:0,y:44}}
    whileInView={{opacity:1,y:0}}
    viewport={{once:true,amount:.13}}
    transition={{duration:.85,ease:[.2,.7,.2,1]}}>
    <div className="zn-distribution-intro">
      <span className="zn-section-tag">04 / DISTRIBUTION</span>
      <h2>Keep the code.<br/><em>Skip the clone.</em></h2>
      <p>Pick a tested local binary or a small SDK archive. Zerynex builds every release in clean Linux, macOS, Windows, npm and Python environments.</p>
      <Link href="/docs/releases" className="zn-primary">Explore downloads <LuArrowUpRight size={18}/></Link>
    </div>
    <div className="zn-distribution-matrix">
      <div><span>01 / NATIVE TOOLS</span><strong>Rust CLI</strong><small>Linux · macOS · Windows</small></div>
      <div><span>02 / WEB APPLICATIONS</span><strong>TypeScript + WASM</strong><small>Bundled engine · npm tarball</small></div>
      <div><span>03 / AUTOMATION</span><strong>Python + MCP</strong><small>Wheel · local CLI dependency</small></div>
      <p>No account or installation is needed to try the hosted workbenches. Registries are not published yet.</p>
    </div>
  </motion.section>
  <section className="zn-ecos-end"><span>ZERO INSTALL TO TRY THE PRODUCT</span><h2>Start in the browser.</h2><p>Use our local-only workbench before installing anything in your app.</p><Link className="zn-primary" href="/tools">Open workbench <LuArrowUpRight size={17}/></Link></section>
 </main>
}
