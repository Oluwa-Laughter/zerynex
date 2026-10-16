'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import Link from 'next/link'
import {
  LuArrowRight, LuArrowUpRight, LuCheck,
  LuCode, LuCopy, LuLayers3, LuNetwork, LuShieldCheck,
  LuTerminal, LuWorkflow, LuBookOpen,  LuExternalLink,
  LuCpu, LuBlocks, LuCircleHelp,
} from 'react-icons/lu'

type LaneKey = 'rust' | 'typescript' | 'python' | 'agent' | 'node' | 'go' | 'zk'
interface Lane {
  key: LaneKey
  ordinal: string
  eyebrow: string
  title: string
  subtitle: string
  icon: typeof LuCode
  command: string
  language: string
  note: string
  steps: string[]
}
const lanes: Lane[] = [
  {
    key: 'rust', ordinal: '01', eyebrow: 'THE FOUNDATION', title: 'Rust engineer',
    subtitle: 'Build directly on the PCZT policy engine.',
    icon: LuCpu,
    language: 'Bash',
    command: 'git clone https://github.com/Oluwa-Laughter/zerynex.git\ncd zerynex\ncargo test --locked\ncargo run --locked -- apps/web/public/examples/transparent-v6.bin --deny-transparent --json',
    note: 'All policy rules are implemented by the Zerynex Rust core. No hosted analyzer required.',
    steps: ['Clone the source and validate the build', 'Run a synthetic PCZT privacy check', 'Write a rule regression test'],
  },
  {
    key: 'typescript', ordinal: '02', eyebrow: 'WEB AND WALLET SDK', title: 'TypeScript developer',
    subtitle: 'Add local analysis to an application.',
    icon: LuCode,
    language: 'TypeScript',
    command: "import { createZerynexClient } from '@zerynex/sdk'\nimport init, { analyze_pczt_policy } from './wasm/zerynex.js'\n\nconst client = createZerynexClient({\n  loadEngine: async () => {\n    await init({ module_or_path: '/wasm/zerynex_bg.wasm' })\n    return { analyze_pczt_policy }\n  },\n})\n\nconst report = await client.analyzeBlob(file, {\n  deny_transparent: true,\n})",
    note: 'The SDK is linked from this repository; it is not yet published to npm. Supply a trusted local WASM loader.',
    steps: ['Build the repository-local TypeScript SDK', 'Configure a trusted local WASM module', 'Inspect files without uploading them'],
  },
  {
    key: 'python', ordinal: '03', eyebrow: 'SECURITY AUTOMATION', title: 'Python developer',
    subtitle: 'Automate repeatable privacy checks.',
    icon: LuTerminal,
    language: 'Python',
    command: "from zerynex_py import ZerynexClient, Policy\n\nclient = ZerynexClient(\n    cli='./target/release/zerynex',\n)\nreport = client.analyze_file(\n    './apps/web/public/examples/transparent-v6.bin',\n    Policy(deny_transparent=True),\n)\nprint(report.agent_summary())",
    note: 'This Python adapter calls the local Rust CLI. Native PyO3 bindings are a planned extension, not an implemented feature.',
    steps: ['Build the Rust CLI and install local Python package', 'Configure the executable path', 'Automate tests with sanitized findings'],
  },
  {
    key: 'agent', ordinal: '04', eyebrow: 'AI-ASSISTED ENGINEERING', title: 'Agent builder',
    subtitle: 'Give an assistant narrow, read-only tools.',
    icon: LuWorkflow,
    language: 'Bash',
    command: "cargo build --locked --release\npython -m venv .venv\n.venv/bin/python -m pip install './packages/python[mcp]'\n\n# Configure your local MCP host with:\n# ZERYNEX_CLI=/absolute/path/to/zerynex\n# ZERYNEX_AGENT_ALLOWED_ROOT=/path/to/synthetic-fixtures\n# Then run the local zerynex-mcp command.",
    note: 'Agents receive limited policy findings about approved synthetic fixtures. No wallet keys, arbitrary paths or raw PCZT bytes.',
    steps: ['Install the portable Agent Skill', 'Configure the fixture-restricted MCP server', 'Use findings to review privacy regressions'],
  },
  {
    key: 'node', ordinal: '05', eyebrow: 'ZCASH INFRASTRUCTURE', title: 'Z3 / node operator',
    subtitle: 'Understand the Zebra readiness boundary.',
    icon: LuNetwork,
    language: 'Bash',
    command: "cargo build --locked --release\npython -m venv .venv\n.venv/bin/python -m pip install ./packages/python\n\n# Check only the local Zebra health port:\n.venv/bin/zerynex-z3-check --host 127.0.0.1 --port 8080",
    note: 'Diagnostic only: checks local /healthy and /ready. It does not query wallets, collect credentials, verify consensus or inspect Zaino gRPC.',
    steps: ['Start your own Z3 stack using upstream docs', 'Locate its local Zebra health port', 'Distinguish liveness from readiness'],
  },
  {
    key: 'go', ordinal: '06', eyebrow: 'GO INFRASTRUCTURE', title: 'Go engineer',
    subtitle: 'Use the Rust engine inside a Go application.',
    icon: LuBlocks, language: 'Go',
    command: "import (\n  \"context\"\n  zerynex \"github.com/Oluwa-Laughter/zerynex/packages/go\"\n)\n\nclient := zerynex.Client{Binary: \"/path/to/zerynex\"}\nreport, err := client.AnalyzeFile(\n  context.Background(), fixturePath,\n  zerynex.Policy{DenyTransparent: true},\n)",
    note: 'Source Go adapter, tested against the actual Rust CLI. No reimplementation of Zcash protocol cryptography. Build and install a trusted local Rust binary.',
    steps: ['Build the Rust CLI and add the local Go module', 'Run tests against nonspendable PCZT fixtures', 'Integrate sanitized findings into your service'],
  },
  {
    key: 'zk', ordinal: '07', eyebrow: 'ZK / CRYPTOGRAPHY', title: 'ZK engineer',
    subtitle: 'Test disclosure boundaries across prover handoffs.',
    icon: LuShieldCheck, language: 'Bash',
    command: "cargo run --locked -- \\\n  apps/web/public/examples/clean-v6.bin \\\n  --compare-with apps/web/public/examples/flagged-v6.bin \\\n  --json\n\n# Structural privacy-policy regression only.\n# ZK proof generation and verification are NOT implemented.",
    note: 'Partial support: this checks selected privacy field presence and component counts, not proof validity, soundness, signing or transaction equivalence.',
    steps: ['Choose synthetic PCZT handoff fixtures', 'Compare stage disclosure findings', 'Validate proofs separately with upstream cryptographic libraries'],
  },
]

const repo = 'https://github.com/Oluwa-Laughter/zerynex'
const docs = {
  z3: 'https://github.com/ZcashFoundation/z3',
  pczt: 'https://zips.z.cash/zip-0374',
  sdk: '/docs/installation',
  python: '/docs/installation',
  go: '/docs/go-sdk',
  zk: '/docs/zk-prover-handoffs',
  agent: '/docs/agents',
}
export default function Ecosystem() {
  const [selected, setSelected] = useState<LaneKey>('rust')
  const [copied, setCopied] = useState(false)
  const scope = useRef<HTMLElement>(null)
  const lane = lanes.find(x => x.key === selected) ?? lanes[0]

  useEffect(() => {
    if (!scope.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from('.atlas-entrance', {
        y: 38, autoAlpha: 0, stagger: .11, duration: .9, ease: 'power3.out',
      })
      gsap.from('.atlas-orbit', {
        rotate: 90, scale: .75, autoAlpha: 0, duration: 1.4, ease: 'expo.out',
      })
    }, scope)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!scope.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo('.atlas-code', { opacity: .2, y: 12 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out' })
  }, [selected])

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(lane.command)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return <main className="atlas-page" ref={scope}>
    <section className="atlas-hero">
      <div className="atlas-topline atlas-entrance">
        <span className="atlas-ref">ZERYNEX / ECOSYSTEM / 001</span>
        <span className="atlas-benchmark"><span className="atlas-tiny-square"/> OPEN DEVELOPER INFRASTRUCTURE</span>
      </div>
      <div className="atlas-hero-grid">
        <div className="atlas-hero-copy">
          <div className="atlas-eyebrow atlas-entrance"><LuLayers3 size={17}/> DIFFERENT STACKS. ONE PRIVACY ENGINE.</div>
          <h1 className="atlas-title atlas-entrance">Find your<br/><em>entry point.</em></h1>
          <p className="atlas-lede atlas-entrance">Zcash engineering is more than one language or one wallet. Explore real integration paths, tools, and carefully scoped privacy checks—built for your workflow.</p>
          <div className="atlas-hero-actions atlas-entrance">
            <a href="#atlas-lanes" className="atlas-primary">CHOOSE A PATH <LuArrowRight size={18}/></a>
            <a href={repo} target="_blank" rel="noopener noreferrer" className="atlas-secondary">VIEW SOURCE <LuArrowUpRight size={15}/></a>
          </div>
        </div>
        <div className="atlas-art" aria-label="Architectural diagram of seven developer paths connected to a shared privacy engine" role="img">
          <div className="atlas-art-grid"/>
          <div className="atlas-orbit atlas-orbit-outer"/>
          <div className="atlas-orbit atlas-orbit-middle"/>
          <div className="atlas-orbit atlas-orbit-inner"/>
          <div className="atlas-core"><LuShieldCheck size={45} strokeWidth={1.15}/><span>RUST / CORE</span></div>
          <div className="atlas-satellite sat-one">01 / RUST</div>
          <div className="atlas-satellite sat-two">02 / TS</div>
          <div className="atlas-satellite sat-three">03 / PYTHON</div>
          <div className="atlas-satellite sat-four">04 / MCP</div>
          <div className="atlas-satellite sat-five">05 / Z3</div>
          <div className="atlas-satellite sat-six">06 / GO</div>
          <div className="atlas-satellite sat-seven">07 / ZK</div>
          <span className="atlas-art-caption">A COMMON CRYPTOGRAPHIC FOUNDATION</span>
        </div>
      </div>
      <div className="atlas-footline atlas-entrance"><span>07 DEVELOPER PATHS</span><span>NO SECRET UPLOADS</span><span>LOCAL-FIRST BY DESIGN</span></div>
    </section>

    <section className="atlas-workspace" id="atlas-lanes">
      <div className="atlas-section-heading"><div><span className="atlas-section-index">01 / DEVELOPER PATHWAYS</span><h2>One toolchain.<br/><em>Many disciplines.</em></h2></div><p>Select the environment you use. Each path includes actual source, setup commands and clear capability boundaries.</p></div>
      <div className="atlas-workbench">
        <div className="atlas-lane-list" role="group" aria-label="Choose developer path">
          {lanes.map(item => <button key={item.key} type="button" aria-pressed={selected === item.key} className={'atlas-lane' + (selected === item.key ? ' atlas-lane-active' : '')} onClick={() => {setSelected(item.key);setCopied(false)}}>
            <span className="atlas-lane-num">{item.ordinal}</span>
            <span className="atlas-lane-icon"><item.icon size={21} strokeWidth={1.5}/></span>
            <span className="atlas-lane-copy"><small>{item.eyebrow}</small><strong>{item.title}</strong></span>
            <LuArrowUpRight className="atlas-lane-arrow" size={18}/>
          </button>)}
        </div>
        <div className="atlas-workbench-right" key={selected}>
          <div className="atlas-workbench-head"><span><span className="atlas-tiny-square"/> ACTIVE PATH / {lane.ordinal}</span><span>LOCAL EXECUTION</span></div>
          <div className="atlas-path-header">
            <div className="atlas-active-icon"><lane.icon size={29} strokeWidth={1.25}/></div>
            <div><small>{lane.eyebrow}</small><h3>{lane.title}</h3><p>{lane.subtitle}</p></div>
          </div>
          <div className="atlas-editor">
            <div className="atlas-editor-bar"><span><i/><i/><i/></span><span>{lane.language.toUpperCase()} / QUICKSTART</span><button onClick={copyCommand} aria-label="Copy quickstart commands">{copied ? <LuCheck size={16}/> : <LuCopy size={16}/>} {copied ? 'COPIED' : 'COPY'}</button></div>
            <pre className="atlas-code"><code>{lane.command}</code></pre>
          </div>
          <div className="atlas-advisory"><LuCircleHelp size={19}/><p>{lane.note}</p></div>
          <div className="atlas-integration-steps"><div className="atlas-step-title">YOUR STARTING SEQUENCE <span>03 STEPS</span></div>{lane.steps.map((step, i) => <div className="atlas-integration-step" key={step}><span>0{i + 1}</span><p>{step}</p><LuArrowUpRight size={14}/></div>)}</div>
        </div>
      </div>
    </section>

    <section className="atlas-topology">
      <div className="atlas-section-heading"><div><span className="atlas-section-index">02 / ZCASH NODE STACK</span><h2>Know the <em>boundary.</em></h2></div><p>Navigate the upstream Z3 services without mistaking a successful HTTP response for full wallet or consensus health.</p></div>
      <div className="atlas-topology-layout">
        <div className="atlas-topology-diagram">
          <div className="atlas-topology-intro"><span>Z3 REFERENCE TOPOLOGY</span><span>DOCS-BASED · NOT LIVE TELEMETRY</span></div>
          <div className="atlas-node-line">
            <div className="atlas-node atlas-node-main"><div className="atlas-node-icon"><LuNetwork size={23}/></div><small>01 / FULL NODE</small><h3>Zebra</h3><p>Consensus node and chain sync</p><div className="atlas-node-tag">/healthy · /ready</div></div>
            <div className="atlas-node-connector"><span/><LuArrowRight size={20}/><span/></div>
            <div className="atlas-node"><div className="atlas-node-icon"><LuShieldCheck size={23}/></div><small>02 / WALLET</small><h3>Zallet</h3><p>Wallet service and PCZT RPC</p><div className="atlas-node-tag">WALLET RPC</div></div>
            <div className="atlas-node-connector"><span/><LuArrowRight size={20}/><span/></div>
            <div className="atlas-node"><div className="atlas-node-icon"><LuBlocks size={23}/></div><small>03 / INDEXER</small><h3>Zaino</h3><p>Light-wallet indexing service</p><div className="atlas-node-tag">GRPC / INDEXER</div></div>
          </div>
          <div className="atlas-topology-footer"><span>HEALTH SIGNALS ARE NOT SECURITY PROOFS</span><a href={docs.z3} target="_blank" rel="noopener noreferrer">UPSTREAM Z3 DOCS <LuExternalLink size={14}/></a></div>
        </div>
        <div className="atlas-diagnostics">
          <div><span className="atlas-diagnostics-eyebrow">LOCAL NODE DIAGNOSTICS</span><h3>Is your node<br/><em>actually ready?</em></h3><p>Zerynex can make two local read-only HTTP requests to Zebra’s documented health endpoints. No wallet RPC credentials or exposed network ports required.</p></div>
          <div className="atlas-diagnostics-code"><div>$ zerynex-z3-check</div><div><span>GET</span> 127.0.0.1:8080/healthy</div><div><span>GET</span> 127.0.0.1:8080/ready</div></div>
          <Link href="/docs/z3-local">OPEN DIAGNOSTIC GUIDE <LuArrowUpRight size={16}/></Link>
        </div>
      </div>
    </section>

    <section className="atlas-bottom">
      <div className="atlas-bottom-meta"><LuBookOpen size={22}/><span>OUR POSITION</span></div>
      <h2>More entry points.<br/><em>Fewer trust assumptions.</em></h2>
      <p>Every new SDK, node check and agent tool should make Zcash easier to build on without quietly weakening the privacy boundary.</p>
      <div className="atlas-bottom-links"><a href={docs.pczt} target="_blank" rel="noopener noreferrer">ZIP-374 <LuArrowUpRight size={16}/></a><Link href={docs.python}>PYTHON SDK <LuArrowUpRight size={16}/></Link><Link href={docs.go}>GO SDK <LuArrowUpRight size={16}/></Link><Link href={docs.zk}>ZK / PROVER <LuArrowUpRight size={16}/></Link><Link href={docs.agent}>AGENT SKILL + MCP <LuArrowUpRight size={16}/></Link><Link href={docs.sdk}>TYPESCRIPT SDK <LuArrowUpRight size={16}/></Link></div>
    </section>
  </main>
}
