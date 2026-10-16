'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { LuArrowUpRight, LuCheck, LuCode, LuCopy, LuNetwork, LuTerminal, LuWorkflow } from 'react-icons/lu'

const repository = 'https://github.com/Oluwa-Laughter/zerynex'
type Integration = 'rust' | 'typescript' | 'python' | 'agent' | 'z3'
const integrations: {key:Integration,label:string,title:string,kind:string,description:string,code:string,documentation:string,icon:typeof LuCode}[] = [
  {
    key:'rust',label:'Rust / CLI',title:'Use the canonical Rust engine',kind:'CLI + CI',
    description:'Run policy-as-code checks on a locally held PCZT. Exit status 0 is no findings, 2 means findings, and 1 indicates an input or runtime problem.',
    code:'cargo build --locked --release\n./target/release/zerynex apps/web/public/examples/transparent-v6.bin \\\n  --policy-file policies/shielded-only.json --json',
    documentation: repository + '/blob/main/docs/policy-format.md',icon:LuTerminal,
  },
  {
    key:'typescript',label:'TypeScript SDK',title:'Integrate with a browser application',kind:'REACT + NEXT.JS',
    description:'Use the local TypeScript SDK with an initialized and trusted WASM module. This is a repository-local package; it has not been published on npm.',
    code:"import { createZerynexClient } from '@zerynex/sdk'\nimport init, { analyze_pczt_policy } from './wasm/zerynex.js'\n\nconst client = createZerynexClient({\n  loadEngine: async () => {\n    await init({ module_or_path: '/wasm/zerynex_bg.wasm' })\n    return { analyze_pczt_policy }\n  },\n})\nconst report = await client.analyzeBlob(file, {\n  deny_transparent: true,\n})",
    documentation: repository + '/tree/main/packages/sdk',icon:LuCode,
  },
  {
    key:'python',label:'Python SDK',title:'Automate local privacy tests',kind:'PYTHON 3.11+',
    description:'The current Python SDK invokes the same Rust CLI without duplicating PCZT parsing or sending files to a remote service.',
    code:"from zerynex_py import ZerynexClient, Policy\n\nclient = ZerynexClient(cli='./target/release/zerynex')\nreport = client.analyze_file(\n    'apps/web/public/examples/transparent-v6.bin',\n    Policy(deny_transparent=True),\n)\nprint(report.agent_summary())",
    documentation: repository + '/tree/main/packages/python',icon:LuCode,
  },
  {
    key:'agent',label:'AI agents / MCP',title:'Agent-assisted privacy regressions',kind:'LOCAL STDIO',
    description:'The optional MCP server exposes read-only checks for approved synthetic fixtures. It does not expose arbitrary file access, signing, or private wallet data.',
    code:"cargo build --locked --release\npython -m venv .venv\n.venv/bin/python -m pip install './packages/python[mcp]'\n\n# Set ZERYNEX_CLI to your compiled binary.\n# Set ZERYNEX_AGENT_ALLOWED_ROOT to an approved fixture directory.\n.venv/bin/zerynex-mcp",
    documentation: repository + '/blob/main/docs/agents.md',icon:LuWorkflow,
  },
  {
    key:'z3',label:'Z3 / Zebra',title:'Diagnose local node readiness',kind:'LOOPBACK ONLY',
    description:'Check documented Zebra /healthy and /ready responses on localhost. This does not validate Zcash consensus, Zallet RPC, or Zaino indexing.',
    code:"cargo build --locked --release\npython -m venv .venv\n.venv/bin/python -m pip install ./packages/python\n.venv/bin/zerynex-z3-check --host 127.0.0.1 --port 8080",
    documentation: repository + '/blob/main/docs/z3-local.md',icon:LuNetwork,
  },
]

export default function ToolingIntegrations() {
  const [active,setActive] = useState<Integration>('rust')
  const [copied,setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)
  const current = integrations.find(item=>item.key===active) ?? integrations[0]

  useEffect(() => {
    if(!codeRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const context = gsap.context(() => {
      gsap.fromTo(codeRef.current, {opacity:.3, y:13, filter:'blur(5px)'}, {opacity:1,y:0,filter:'blur(0px)',duration:.45,ease:'power3.out'})
    })
    return () => context.revert()
  },[active])

  async function copy() {
    try {
      await navigator.clipboard.writeText(current.code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return <section className="dev-integrations console-reveal" id="integrations" aria-label="Developer integrations">
    <div className="dev-integrations-heading">
      <div><span className="dev-integrations-index">04 / CONNECT YOUR TOOLCHAIN</span><h2>Integrate Zerynex <em>your way.</em></h2><p>Use the same Rust policy rules through the ecosystem your team already knows. No new hosted trust boundary.</p></div>
      <a href={repository + '/blob/main/docs/package-managers.md'} target="_blank" rel="noopener noreferrer">PACKAGE MANAGER GUIDE <LuArrowUpRight size={14}/></a>
    </div>
    <div className="dev-integrations-shell">
      <div className="dev-integration-tabs" role="tablist" aria-label="Choose integration">
        {integrations.map((item,i) => <button
          type="button" role="tab" id={'integration-tab-'+item.key} aria-selected={active===item.key}
          aria-controls="integration-code-panel" key={item.key}
          onClick={() => {setActive(item.key);setCopied(false)}} className={active===item.key?'dev-integration-active':''}>
          <span>0{i+1}</span><item.icon size={17}/>{item.label}
        </button>)}
      </div>
      <div className="dev-integration-content" id="integration-code-panel" role="tabpanel" aria-labelledby={'integration-tab-'+active}>
        <div className="dev-integration-meta"><span>{current.kind}</span><span>LOCAL FIRST</span></div>
        <h3>{current.title}</h3><p>{current.description}</p>
        <div className="dev-code-editor">
          <div className="dev-code-editor-head"><span>DEVELOPER QUICKSTART</span><button onClick={copy} aria-label="Copy integration example">{copied?<LuCheck size={15}/>:<LuCopy size={15}/>} {copied?'COPIED':'COPY'}</button></div>
          <pre ref={codeRef}><code>{current.code}</code></pre>
        </div>
        <a className="dev-integration-docs" href={current.documentation} target="_blank" rel="noopener noreferrer">READ INTEGRATION DOCUMENTATION <LuArrowUpRight size={15}/></a>
      </div>
    </div>
    <p className="dev-integration-caveat">REFERENCE INTEGRATIONS ARE REPOSITORY-LOCAL. THE SDK PACKAGES HAVE NOT BEEN RELEASED TO PUBLIC REGISTRIES.</p>
  </section>
}
