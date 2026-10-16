import type { Metadata } from 'next'
import Link from 'next/link'
import { LuArrowUpRight, LuShieldCheck, LuWorkflow, LuTerminal, LuBookOpen, LuLockKeyhole } from 'react-icons/lu'
export const metadata: Metadata = {
  title: 'Agent Tooling',
  description: 'MCP tools, portable agent skills, and CI privacy checks for synthetic Zcash PCZT fixtures.',
}
const routes=[
 {id:'01',icon:LuWorkflow,name:'Local MCP server',kind:'READ-ONLY TOOLS',body:'Use a restricted stdio MCP server that only examines approved synthetic fixtures. No wallet keys, arbitrary filesystem access or remote RPC.',code:'ZERYNEX_CLI=/absolute/path/to/zerynex\nZERYNEX_AGENT_ALLOWED_ROOT=/absolute/path/to/synthetic-fixtures\nzerynex-mcp',guide:'/docs/agents'},
 {id:'02',icon:LuBookOpen,name:'Portable agent skill',kind:'GUIDED POLICY REVIEW',body:'Equip compatible coding assistants with a documented Zcash privacy-review workflow. The skill is an instruction package, not a remote service.',code:'agent/skills/zcash-privacy-check/SKILL.md\n# Configure this skill directory in your compatible agent host.',guide:'/docs/agents'},
 {id:'03',icon:LuTerminal,name:'CI policy gate',kind:'REPRODUCIBLE AUTOMATION',body:'Keep review deterministic. Test approved synthetic PCZT snapshots as part of a GitHub Action without sending confidential wallet data to an agent.',code:'uses: Oluwa-Laughter/zerynex@<reviewed-commit>\nwith:\n  scenario-manifest: tests/fixtures/scenario.json',guide:'/docs/github-action'},
] as const
export default function Agents() {
  return <main className="zn-agents">
    <header className="zn-agents-hero"><span className="zn-section-tag">AGENT INFRASTRUCTURE / SAFETY BY DESIGN</span><h1>Automation,<br/><em>with limits.</em></h1><p>One coherent way to extend Zerynex into agent-assisted workflows: a restricted MCP interface, portable skills, and CI gates. Built for developers—not for handing transaction secrets to language models.</p></header>
    <div className="zn-agents-grid">{routes.map(item=><article key={item.id}><div className="zn-agents-meta"><span>{item.id} / {item.kind}</span><item.icon size={23}/></div><h2>{item.name}</h2><p>{item.body}</p><pre><code>{item.code}</code></pre><Link href={item.guide}>Installation and API guide <LuArrowUpRight size={16}/></Link></article>)}</div>
    <section className="zn-agents-boundary"><div><LuLockKeyhole size={29}/><strong>Agents inspect approved synthetic fixtures only.</strong></div><p>Current MCP tools are read-only and return sanitized rule identifiers. This is not a wallet signer, proof verifier, or general filesystem MCP. Host-specific setup must be completed by the developer.</p><Link href="/docs/agents">Read the trust model <LuShieldCheck size={16}/></Link></section>
  </main>
}
