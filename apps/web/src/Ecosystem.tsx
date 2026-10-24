'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { LuArrowUpRight, LuCheck, LuCopy, LuTerminal, LuShieldCheck, LuBookOpen, LuPackage } from 'react-icons/lu'

const integrations=[
 {id:'Rust',state:'CLI · v0.2.0',title:'Rust core',desc:'Inspect local PCZT files with the canonical Rust policy engine and stage-regression CLI.',
  setup:'cargo install --git https://github.com/Oluwa-Laughter/zerynex --tag v0.2.0 --locked --bin zerynex',
  command:'zerynex --capabilities\nzerynex /path/to/synthetic.pczt --deny-transparent --json',
  guide:'/docs/cli-reference',caveat:'Review an OS-native release archive if you do not want to compile. Exit 0 = no findings, 2 = findings, 1 = error.'},
 {id:'TypeScript',state:'npm · v0.2.0',title:'TypeScript + WASM',desc:'Import the publicly released browser SDK, which bundles the canonical Rust/WebAssembly policy engine.',
  setup:'npm install @zerynex/sdk@0.2.0',
  command:"import { createBrowserZerynexClient } from '@zerynex/sdk/browser'\n\nconst client = createBrowserZerynexClient()\nawait client.ready()\n// file is explicitly selected by your app's user.\nconst report = await client.analyzeBlob(file, { deny_transparent: true })",
  guide:'/docs/typescript-api',caveat:'Published on npm. Your browser bundler must serve the adjacent trusted WASM asset; supply { wasm } if needed. PCZTs stay local.'},
 {id:'Python',state:'PyPI · v0.2.0',title:'Python',desc:'Install the published Python adapter and run canonical Rust policy checks against explicitly selected local files.',
  setup:'python3 -m pip install zerynex-python==0.2.0',
  command:"from zerynex_py import ZerynexClient, Policy\n\nclient = ZerynexClient(cli='/absolute/path/to/zerynex')\nreport = client.analyze_file('/path/to/synthetic.pczt', Policy(deny_transparent=True))\nprint(report.agent_summary())",
  guide:'/docs/python-api',caveat:'Published on PyPI. PCZT analysis also requires a separately installed trusted Rust CLI; no hosted API or wallet connection.'},
 {id:'Go',state:'Go · v0.2.0',title:'Go',desc:'Use the published Go module to invoke the same local Rust CLI, without a second cryptographic implementation.',
  setup:'go get github.com/Oluwa-Laughter/zerynex/packages/go@v0.2.0',
  command:'client := zerynex.Client{Binary: "/absolute/path/to/zerynex"}\nreport, err := client.AnalyzeFile(ctx, fixturePath, zerynex.Policy{DenyTransparent: true})',
  guide:'/docs/go-sdk',caveat:'Versioned Go module v0.2.0 is public and tested against the real Rust CLI. Install that CLI separately; no hosted API.'},
] as const

export default function Ecosystem() {
 const [selected,setSelected]=useState<(typeof integrations)[number]['id']>('TypeScript')
 const [copied,setCopied]=useState<'setup'|'example'|null>(null)
 const [copyError,setCopyError]=useState(false)
 const root=useRef<HTMLElement>(null)
 const reduced=useReducedMotion()
 const lane=integrations.find(i=>i.id===selected)!
 useEffect(()=>{
  if(!root.current||reduced)return
  const ctx=gsap.context(()=>gsap.from('.zn-ecos-reveal',{opacity:0,y:24,stagger:.11,duration:.8,ease:'power3.out'}),root)
  return ()=>ctx.revert()
 },[reduced])
 async function copy(value: string, target: 'setup' | 'example'){
  try{await navigator.clipboard.writeText(value);setCopied(target);setCopyError(false)}catch{setCopied(null);setCopyError(true)}
 }
 return <main className="zn-ecos" ref={root}>
  <header className="zn-ecos-header zn-ecos-reveal"><span className="zn-section-tag">LANGUAGE INTEGRATIONS / SDKs</span><h1>Bring Zcash privacy checks <em>into your code.</em></h1><p>SDKs are integration interfaces—not the product&apos;s limit. Select your programming language to use the canonical Rust policy engine inside Zcash wallets, transaction workflows and infrastructure applications.</p></header>
  <div className="zn-language-panel zn-ecos-reveal">
   <div className="zn-language-select" role="group" aria-label="Choose programming language">
    {integrations.map(i=><button type="button" key={i.id} aria-pressed={i.id===selected} onClick={()=>{setSelected(i.id);setCopied(null);setCopyError(false)}}><span>{i.id}</span><small>{i.state}</small></button>)}
   </div>
   <div className="zn-language-detail">
    <AnimatePresence mode="wait"><motion.div key={lane.id} initial={false} animate={{opacity:1,y:0}} exit={reduced?{}:{opacity:0,y:-10}} transition={{duration:.28}}>
     <div className="zn-language-top"><span>ACTIVE INTERFACE / {lane.id.toUpperCase()}</span><LuPackage size={22}/></div>
     <h2>{lane.title}</h2><p>{lane.desc}</p>
     <div className="zn-code-surface zn-install-surface"><div><span>{lane.id} / Setup</span><button type="button" aria-label="Copy setup command" onClick={()=>void copy(lane.setup,'setup')}>{copied==='setup'?<LuCheck size={16}/>:<LuCopy size={16}/>} {copied==='setup'?'Copied':'Copy'}</button></div><pre><code>{lane.setup}</code></pre></div>
     <div className="zn-code-surface"><div><span>{lane.id} / Example</span><button type="button" aria-label="Copy example code" onClick={()=>void copy(lane.command,'example')}>{copied==='example'?<LuCheck size={16}/>:<LuCopy size={16}/>} {copied==='example'?'Copied':'Copy'}</button></div><pre><code>{lane.command}</code></pre></div>
     <span className="sr-only" role="status" aria-live="polite">{copied ? (copied==='setup'?'Setup command copied':'Example code copied') : ''}</span>
     {copyError&&<p className="zn-copy-notice" role="alert">Clipboard unavailable. Select the command or code above to copy it manually.</p>}
     <div className="zn-language-caveat"><LuShieldCheck size={17}/>{lane.caveat}</div>
     <Link className="zn-inline-link" href={lane.guide}>Read integration guide <LuArrowUpRight size={17}/></Link>
    </motion.div></AnimatePresence>
   </div>
  </div>
  <section className="zn-stack-paths zn-ecos-reveal">
   <div><span className="zn-section-tag">BEYOND LANGUAGE BINDINGS</span><h2>More than <em>language bindings.</em></h2></div>
   <div><Link href="/docs/github-action"><LuTerminal size={23}/><strong>CI / GitHub Actions</strong><p>Check synthetic regression fixtures on every pull request.</p><LuArrowUpRight size={19}/></Link>
   <Link href="/agents"><LuShieldCheck size={23}/><strong>MCP + agent skills</strong><p>Restricted tools for approved local fixtures and AI-assisted development.</p><LuArrowUpRight size={19}/></Link>
   <Link href="/tools/payment"><LuShieldCheck size={23}/><strong>ZIP-321 payments</strong><p>Validate multi-recipient payment requests with the Rust engine—no wallet custody or signing.</p><LuArrowUpRight size={19}/></Link>
   <Link href="/tools/transaction"><LuShieldCheck size={23}/><strong>Transaction observations</strong><p>Validate chain confirmation reports and catch reorganization hints without connecting to wallets.</p><LuArrowUpRight size={19}/></Link>
   <Link href="/tools/refund"><LuShieldCheck size={23}/><strong>Swap refund privacy</strong><p>Offline TypeScript checks for declared viewing-key scope and refund-address reuse.</p><LuArrowUpRight size={19}/></Link>
   <Link href="/docs/node-readiness"><LuShieldCheck size={23}/><strong>Node & infrastructure</strong><p>Read-only Zcash RPC readiness checks for wallets, payments, indexers and relayers.</p><LuArrowUpRight size={19}/></Link>
   <Link href="/docs/zcash-app-recipes"><LuTerminal size={23}/><strong>Zcash app recipes</strong><p>Integration patterns for payments, private markets, cross-chain and core tooling.</p><LuArrowUpRight size={19}/></Link>
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
      <div><span>02 / WEB APPLICATIONS</span><strong>TypeScript + WASM</strong><small>Published npm SDK · Rust/WASM</small></div>
      <div><span>03 / AUTOMATION</span><strong>Python + MCP</strong><small>Published PyPI wheel · local CLI</small></div>
      <p>Try the browser tools without an account or installation. TypeScript and Python SDKs are publicly installable; Go is also available as a public, versioned module.</p>
    </div>
  </motion.section>
  <section className="zn-ecos-end"><span>ZERO INSTALL TO TRY THE PRODUCT</span><h2>Start in the browser.</h2><p>Use our local-only workbench before installing anything in your app.</p><Link className="zn-primary" href="/tools">Open workbench <LuArrowUpRight size={17}/></Link></section>
 </main>
}
