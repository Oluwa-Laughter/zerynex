'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import Link from 'next/link'
import { LuArrowUpRight, LuCheck, LuCode, LuCopy, LuNetwork, LuTerminal, LuWorkflow, LuGitPullRequest, LuGitBranch, LuGitMerge, LuPackage, LuFileJson, LuShieldCheck } from 'react-icons/lu'

type Integration = 'rust' | 'typescript' | 'python' | 'agent' | 'z3' | 'github' | 'stages' | 'handoff' | 'go' | 'rpc' | 'zk'
const integrations: {key:Integration,label:string,title:string,kind:string,description:string,code:string,documentation:string,icon:typeof LuCode}[] = [
  {
    key:'rust',label:'Rust / CLI',title:'Use the canonical Rust engine',kind:'CLI + CI',
    description:'Run policy-as-code checks on a locally held PCZT. Exit status 0 is no findings, 2 means findings, and 1 indicates an input or runtime problem.',
    code:'cargo build --locked --release\n./target/release/zerynex apps/web/public/examples/transparent-v6.bin \\\n  --policy-file policies/shielded-only.json --json',
    documentation: '/docs/policy-format.md',icon:LuTerminal,
  },
  {
    key:'typescript',label:'TypeScript SDK',title:'Integrate with a browser application',kind:'REACT + NEXT.JS',
    description:'Use the local TypeScript SDK with an initialized and trusted WASM module. This is a repository-local package; it has not been published on npm.',
    code:"import { createZerynexClient } from '@zerynex/sdk'\nimport init, { analyze_pczt_policy } from './wasm/zerynex.js'\n\nconst client = createZerynexClient({\n  loadEngine: async () => {\n    await init({ module_or_path: '/wasm/zerynex_bg.wasm' })\n    return { analyze_pczt_policy }\n  },\n})\nconst report = await client.analyzeBlob(file, {\n  deny_transparent: true,\n})",
    documentation: '/docs/installation',icon:LuCode,
  },
  {
    key:'python',label:'Python SDK',title:'Automate local privacy tests',kind:'PYTHON 3.11+',
    description:'The current Python SDK invokes the same Rust CLI without duplicating PCZT parsing or sending files to a remote service.',
    code:"from zerynex_py import ZerynexClient, Policy\n\nclient = ZerynexClient(cli='./target/release/zerynex')\nreport = client.analyze_file(\n    'apps/web/public/examples/transparent-v6.bin',\n    Policy(deny_transparent=True),\n)\nprint(report.agent_summary())",
    documentation: '/docs/installation',icon:LuCode,
  },
  {
    key:'go',label:'Go SDK',title:'Local policy checks for Go services',kind:'GO / RUST CLI',
    description:'Go infrastructure developers can run canonical Rust privacy checks through the source SDK. Supports binary PCZTs, base64-over-stdin, and stage comparison without an app UI or hosted service.',
    code:"cargo build --locked --release --bin zerynex\n\n# In a Go project that imports the repository-local module:\nclient := zerynex.Client{Binary: \"/path/to/zerynex\"}\nreport, err := client.AnalyzeFile(ctx, fixturePath,\n    zerynex.Policy{DenyTransparent: true})\n\n// Real Rust integration is verified in CI with Go tests.\n// Do not send real wallet PCZTs to public CI.",
    documentation: '/docs/go-sdk',icon:LuPackage,
  },
  {
    key:'stages',label:'PCZT Stage Regression',title:'Catch exposure introduced by a transaction handoff',kind:'WALLET / CI / REGRESSION',
    description:'Compare two local PCZT stages using the same Rust policy engine. Flag newly present sensitive field locations and component-count changes; this is not a cryptographic equivalence check.',
    code:"cargo run --locked -- \\\n  apps/web/public/examples/clean-v6.bin \\\n  --compare-with apps/web/public/examples/flagged-v6.bin \\\n  --json\n\n# For GitHub Actions, configure baseline-path and pczt-path.\n# Only use synthetic, nonspendable fixtures in public CI.",
    documentation: '/docs/pczt-stage-regression.md',icon:LuGitBranch,
  },
  {
    key:'zk',label:'ZK / Prover handoffs',title:'Test privacy invariants around prover roles',kind:'ZK / RESEARCH + STRUCTURAL CHECKS',
    description:'ZK engineers can test permitted PCZT fields and component counts around a handoff. This is not a proof generator, cryptographic verifier or circuit audit.',
    code:"cargo run --locked -- \\\n  apps/web/public/examples/clean-v6.bin \\\n  --compare-with apps/web/public/examples/flagged-v6.bin \\\n  --json\n\n# This detects limited disclosure/structure changes.\n# Proof validity and witness correctness are NOT checked.",
    documentation: '/docs/zk-prover-handoffs',icon:LuShieldCheck,
  },
  {
    key:'handoff',label:'Wallet Role Harness',title:'Test synthetic PCZT roles without a node',kind:'RUST / SYNTHETIC / CI',
    description:'Run a manifest of expected disclosure outcomes against real upstream PCZT Creator, Updater, Combiner and Redactor operations. No wallet, signing or proof generation is required.',
    code:"cargo run --locked --example generate_role_handoff -- --check\n\ncargo run --locked --bin zerynex-handoff -- \\\n  --manifest tests/fixtures/role-handoff/scenario.json \\\n  --json\n\n# In another repository, use the Zerynex GitHub Action\n# with scenario-manifest instead of uploading transactions.",
    documentation: '/docs/handoff-harness.md',icon:LuGitMerge,
  },
  {
    key:'github',label:'GitHub Actions',title:'Continuous privacy checks in any repository',kind:'CI / NO APP DEPENDENCY',
    description:'Drop a Zerynex composite action into a Zcash repository to check synthetic PCZT fixtures on pull requests. It compiles and runs the Rust engine locally in the runner.',
    code:"# .github/workflows/privacy.yml\n- uses: actions/checkout@v4\n- uses: Oluwa-Laughter/zerynex@main\n  id: zerynex\n  with:\n    pczt-path: tests/fixtures/synthetic.pczt\n    policy-path: policies/shielded-only.json\n    fail-on-findings: 'true'\n\n# Production use: pin to a reviewed immutable commit SHA.\n# Never upload real PCZTs or wallet keys to CI.",
    documentation: '/docs/github-action.md',icon:LuGitPullRequest,
  },
  {
    key:'agent',label:'AI agents / MCP',title:'Agent-assisted privacy regressions',kind:'LOCAL STDIO',
    description:'The optional MCP server exposes read-only checks for approved synthetic fixtures. It does not expose arbitrary file access, signing, or private wallet data.',
    code:"cargo build --locked --release\npython -m venv .venv\n.venv/bin/python -m pip install './packages/python[mcp]'\n\n# Set ZERYNEX_CLI to your compiled binary.\n# Set ZERYNEX_AGENT_ALLOWED_ROOT to an approved fixture directory.\n.venv/bin/zerynex-mcp",
    documentation: '/docs/agents.md',icon:LuWorkflow,
  },
  {
    key:'rpc',label:'RPC Contracts',title:'Catch OpenRPC compatibility drift offline',kind:'ZALLET / JSON-RPC / PREVIEW',
    description:'Test a local, explicitly approved OpenRPC schema against required method names, ordered parameters and required flags. No RPC URL, node connection or wallet credentials are used.',
    code:"python3 scripts/check_rpc_contract.py \\\n  --schema tests/fixtures/rpc/zallet-synthetic-openrpc.json \\\n  --contract tests/fixtures/rpc/zallet-minimum-contract.json \\\n  --json\n\n# Synthetic schema only. A real Zallet version has not\n# been independently verified by this checker.",
    documentation: '/docs/rpc-contracts',icon:LuFileJson,
  },
  {
    key:'z3',label:'Z3 / Zebra',title:'Diagnose local node readiness',kind:'LOOPBACK ONLY',
    description:'Check documented Zebra /healthy and /ready responses on localhost. This does not validate Zcash consensus, Zallet RPC, or Zaino indexing.',
    code:"cargo build --locked --release\npython -m venv .venv\n.venv/bin/python -m pip install ./packages/python\n.venv/bin/zerynex-z3-check --host 127.0.0.1 --port 8080",
    documentation: '/docs/z3-local.md',icon:LuNetwork,
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
      <Link href="/docs/package-managers">PACKAGE MANAGER GUIDE <LuArrowUpRight size={14}/></Link>
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
        <Link className="dev-integration-docs" href={current.documentation}>READ INTEGRATION DOCUMENTATION <LuArrowUpRight size={15}/></Link>
      </div>
    </div>
    <p className="dev-integration-caveat">GITHUB ACTION SUPPORTS EXTERNAL REPOSITORIES. SDK PACKAGES ARE STILL SOURCE-ONLY, NOT REGISTRY-RELEASED.</p>
  </section>
}
