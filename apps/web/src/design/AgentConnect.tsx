'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { LuArrowUpRight, LuBookOpen, LuCheck, LuCopy,
  LuLockKeyhole, LuPlay, LuShieldCheck, LuTerminal, LuWorkflow } from 'react-icons/lu'
import { inspectPczt, loadEngine, type Report } from '../analyzer'

type Host = 'cursor' | 'claude' | 'vscode'
type Sample = 'clean' | 'transparent' | 'flagged'
const hosts: {id:Host;name:string;key:'mcpServers'|'servers';where:string}[]=[
  {id:'cursor',name:'Cursor',key:'mcpServers',where:'Cursor MCP settings / .cursor/mcp.json'},
  {id:'claude',name:'Claude Desktop',key:'mcpServers',where:'Claude Desktop MCP configuration'},
  {id:'vscode',name:'VS Code',key:'servers',where:'Workspace .vscode/mcp.json'},
]
const previewFixtures:{id:Sample;name:string;expect:string}[]=[
  {id:'clean',name:'Clean',expect:'No findings'},
  {id:'transparent',name:'Transparent output',expect:'Shielded-only violation'},
  {id:'flagged',name:'Metadata',expect:'Proprietary disclosure'},
]
function validAbsolute(value:string){
  return (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) &&
    !value.includes('\n') && !value.includes('\r') && value.length<1024
}

export default function AgentConnect() {
  const scope=useRef<HTMLElement>(null)
  const [host,setHost]=useState<Host>('cursor')
  const [server,setServer]=useState('/absolute/path/to/.venv/bin/zerynex-mcp')
  const [cli,setCli]=useState('/absolute/path/to/zerynex')
  const [root,setRoot]=useState('/absolute/path/to/approved-synthetic-fixtures')
  const [copied,setCopied]=useState(false)
  const [ready,setReady]=useState(false)
  const [sample,setSample]=useState<Sample>('transparent')
  const [busy,setBusy]=useState(false)
  const [report,setReport]=useState<Report|null>(null)
  const [error,setError]=useState('')
  const reduced=useReducedMotion()
  const chosen=hosts.find(h=>h.id===host)!
  const snippet=useMemo(()=>JSON.stringify({
    [chosen.key]:{
      zerynex:{
        ...(host==='claude'?{}:{type:'stdio'}),
        command:server,
        args:[],
        env:{ZERYNEX_CLI:cli,ZERYNEX_AGENT_ALLOWED_ROOT:root},
      },
    },
  },null,2),[chosen.key,host,server,cli,root])
  const valid=[server,cli,root].every(value=>validAbsolute(value) && !value.startsWith('/absolute/path/to'))
  useEffect(()=>{
    if(!scope.current || reduced)return
    gsap.registerPlugin(ScrollTrigger)
    const context=gsap.context(()=>{
      gsap.utils.toArray<HTMLElement>('.zn-agent-connect-heading,.zn-agent-config,.zn-agent-demo').forEach(item=>{
        gsap.fromTo(item,{opacity:0,y:28},{opacity:1,y:0,duration:.85,ease:'power3.out',
          scrollTrigger:{trigger:item,start:'top 94%',once:true}})
      })
    },scope)
    return ()=>context.revert()
  },[reduced])
  useEffect(()=>{
    let active=true
    loadEngine().then(()=>{if(active)setReady(true)}).catch(()=>{if(active)setError('The local browser Rust engine is unavailable.')})
    return ()=>{active=false}
  },[])
  async function copy(){
    if(!valid)return
    try{await navigator.clipboard.writeText(snippet);setCopied(true)}catch{setCopied(false)}
  }
  async function run(){
    if(!ready||busy)return
    setBusy(true);setError('');setReport(null)
    try{
      const response=await fetch('/examples/'+sample+'-v6.bin')
      if(!response.ok)throw new Error('Synthetic fixture unavailable.')
      const bytes=await response.arrayBuffer()
      const result=await inspectPczt(new File([bytes],sample+'-synthetic.pczt'),
        'external-signer',{denyTransparent:true,denySapling:false})
      setReport(result)
    }catch{setError('Local Rust/WASM analysis could not complete. Try again or use the standalone workbench.')}
    finally{setBusy(false)}
  }
  return <section className="zn-agent-connect" ref={scope}>
    <div className="zn-agent-connect-heading"><span className="zn-section-tag">05 / REAL DEVELOPER ONBOARDING</span><h2>Connect your<br/><em>own agent.</em></h2><p>Generate host configuration locally. Your paths stay in the browser. Then validate the actual MCP process with the doctor command, before giving your assistant any tool access.</p></div>
    <div className="zn-agent-grid">
      <div className="zn-agent-config">
        <div className="zn-agent-config-head"><LuWorkflow size={20}/><span>01 / MCP HOST CONFIGURATION</span></div>
        <div className="zn-agent-hosts" role="group" aria-label="MCP client configuration">
          {hosts.map(item=><button key={item.id} type="button" aria-pressed={host===item.id} onClick={()=>{setHost(item.id);setCopied(false)}}>{item.name}</button>)}
        </div>
        <div className="zn-agent-paths">
          <label htmlFor="mcp-server-path">MCP executable <small>Installed Python entrypoint</small></label>
          <input id="mcp-server-path" type="text" value={server} spellCheck={false} onChange={event=>{setServer(event.target.value);setCopied(false)}}/>
          <label htmlFor="mcp-cli-path">Trusted Rust CLI <small>Local executable path</small></label>
          <input id="mcp-cli-path" type="text" value={cli} spellCheck={false} onChange={event=>{setCli(event.target.value);setCopied(false)}}/>
          <label htmlFor="mcp-fixture-path">Allowed synthetic fixture root <small>Dedicated directory, no wallet data</small></label>
          <input id="mcp-fixture-path" type="text" value={root} spellCheck={false} onChange={event=>{setRoot(event.target.value);setCopied(false)}}/>
        </div>
        {!valid&&<p role="alert" className="zn-agent-invalid">Replace sample paths with absolute local paths (Unix or Windows), one per line.</p>}
        <div className="zn-agent-code-head"><span>{chosen.where}</span><button type="button" disabled={!valid} onClick={()=>void copy()}>{copied?<LuCheck size={16}/>:<LuCopy size={16}/>} {copied?'Copied':'Copy JSON'}</button></div>
        <pre className="zn-agent-code"><code>{snippet}</code></pre>
        <div className="zn-agent-setup-help"><LuLockKeyhole size={18}/><p>Sample configurations for hosts that support these keys; apply in the host’s own settings. The website cannot access your filesystem, start MCP, or verify a remote agent.</p></div>
      </div>
      <div className="zn-agent-demo">
        <div className="zn-agent-config-head"><LuShieldCheck size={20}/><span>02 / LOCAL ANALYSIS DEMONSTRATION</span></div>
        <p>See exactly the kind of sanitized finding an agent receives. This demo executes Rust/WASM <strong>in the browser</strong>; it is not an MCP connection.</p>
        <div className="zn-agent-fixtures" role="group" aria-label="Select synthetic PCZT sample">
          {previewFixtures.map(f=><button key={f.id} type="button" aria-pressed={sample===f.id} onClick={()=>{setSample(f.id);setReport(null);setError('')}}><strong>{f.name}</strong><small>{f.expect}</small></button>)}
        </div>
        <button type="button" className="zn-primary zn-agent-run" disabled={!ready||busy} onClick={()=>void run()}><LuPlay size={17}/>{busy?'Running Rust checks':ready?'Run local policy check':'Loading engine'}</button>
        <AnimatePresence mode="wait">
          {report&&<motion.div className="zn-agent-results" key={sample} initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.23}} aria-live="polite">
            <span>{report.findings.length===0?'NO POLICY FINDINGS':'POLICY FINDINGS DETECTED'} / {report.findings.length}</span>
            {report.findings.length===0?<p>Checks passed under the selected synthetic policy. This does not prove anonymity.</p>:
              report.findings.map((f,i)=><div key={i}><strong>{f.rule}</strong><small>{f.field}</small><p>{f.explanation}</p></div>)}
          </motion.div>}
        </AnimatePresence>
        {error&&<p role="alert" className="zn-agent-invalid">{error}</p>}
        <div className="zn-agent-doctor"><LuTerminal size={17}/><div><strong>03 / VERIFY THE REAL MCP PROCESS</strong><code>zerynex-mcp-doctor --cli /absolute/path/to/zerynex --fixtures /absolute/path/to/approved-synthetic-fixtures --server /absolute/path/to/zerynex-mcp</code></div></div>
        <Link className="zn-inline-link" href="/docs/agents">Complete setup and trust model <LuArrowUpRight size={16}/></Link>
      </div>
    </div>
    <div className="zn-agent-instructions">
      <span><LuBookOpen size={16}/> Working tool names</span>
      <code>list_synthetic_fixtures</code><code>analyze_synthetic_pczt</code><code>compare_synthetic_pczt_stages</code>
      <code>run_synthetic_smoke_suite</code><code>explain_zerynex_rule</code><code>zerynex_policy_schema</code>
      <code>zerynex_core_capabilities</code><code>check_synthetic_zallet_rpc_contract</code><code>run_zerynex_developer_preflight</code>
    </div>
  </section>
}
