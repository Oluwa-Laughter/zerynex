'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { LuArrowRight, LuArrowUpRight, LuBookOpen, LuCode, LuSearch, LuShieldCheck, LuTerminal } from 'react-icons/lu'
import { guideGroups, guides } from './catalog'
import { Status } from './DocsLayout'

const entryPoints = [
  { number: '01', title: 'First privacy check', description: 'Understand PCZT findings using local synthetic fixtures.', href: '/docs/quickstart', Icon: LuTerminal },
  { number: '02', title: 'Integrate an SDK', description: 'Use the Rust engine from TypeScript, Python, Go or Rust.', href: '/docs/typescript-api', Icon: LuCode },
  { number: '03', title: 'Automate a workflow', description: 'Run deterministic policy tests in CI and restricted MCP hosts.', href: '/docs/github-action', Icon: LuShieldCheck },
] as const
export default function DocsIndex() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const matches = useMemo(() => guides.filter(guide => {
    if (filter !== 'All' && guide.group !== filter) return false
    const term = query.trim().toLowerCase()
    return !term || [guide.title, guide.audience, guide.group, guide.summary].some(value => value.toLowerCase().includes(term))
  }), [query, filter])
  const visibleGroups = guideGroups.filter(group => matches.some(guide => guide.group === group))
  return <div>
    <header className="docs-intro">
      <span className="docs-kicker">ZERYNEX / DEVELOPER DOCUMENTATION</span>
      <h1>Learn the core.<br/><em>Build with confidence.</em></h1>
      <p>Install the local-first Zcash PCZT policy engine, integrate SDKs, and test privacy disclosures across developer workflows. Start with a real API or tutorial—not project planning notes.</p>
      <div className="docs-intro-stats">
        <span><LuBookOpen size={18}/> {guides.length} public guides</span>
        <span><LuTerminal size={18}/> Runnable examples</span>
        <span><LuShieldCheck size={18}/> Explicit trust boundaries</span>
      </div>
    </header>
    {!query.trim() && filter === 'All' && <section className="docs-start-section" aria-labelledby="docs-start-title">
      <div className="docs-group-heading"><span className="docs-kicker">START BUILDING</span><h2 id="docs-start-title">Choose your path</h2></div>
      <div className="docs-entry-grid">
        {entryPoints.map(({ number, title, description, href, Icon }) => <Link href={href} className="docs-entry-card" key={href}>
          <span className="docs-entry-top"><span>{number} / GUIDE</span><Icon size={22}/></span>
          <strong>{title}</strong><p>{description}</p>
          <span className="docs-entry-action">Read guide <LuArrowUpRight size={16}/></span>
        </Link>)}
      </div>
    </section>}
    <section className="docs-library" aria-label="Browse developer documentation">
      <div className="docs-group-heading"><span className="docs-kicker">DEVELOPER REFERENCE</span><h2>Browse by topic</h2></div>
      <div className="docs-search-zone">
        <label htmlFor="docs-search"><LuSearch size={19}/> <span className="sr-only">Search documentation</span></label>
        <input id="docs-search" type="text" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search guides, languages or concepts..." />
        <span aria-live="polite">{matches.length} RESULTS</span>
      </div>
      <div className="docs-filter-list" aria-label="Filter documentation">
        {['All', ...guideGroups].map(group => <button key={group} type="button"
          aria-pressed={filter === group} onClick={() => setFilter(group)}>{group}</button>)}
      </div>
      {visibleGroups.map(group => {
        const items = matches.filter(guide => guide.group === group)
        return <section className="docs-group-section" key={group} aria-label={group}>
          <div className="docs-group-label"><h3>{group}</h3><span>{items.length} {items.length === 1 ? 'GUIDE' : 'GUIDES'}</span></div>
          <div className="docs-card-list">
            {items.map((guide, index) => <Link href={'/docs/' + guide.slug} className="docs-guide-card" key={guide.slug}>
              <span className="docs-card-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="docs-card-content">
                <div className="docs-card-heading"><Status status={guide.status}/></div>
                <h4>{guide.title}</h4><p>{guide.summary}</p>
              </div>
              <LuArrowUpRight size={19} className="docs-card-arrow" aria-hidden="true"/>
            </Link>)}
          </div>
        </section>
      })}
      {matches.length === 0 && <div className="docs-empty" role="status">No matching guides. Try a broader search or choose another category.</div>}
    </section>
    <div className="docs-bottom-prompt">
      <LuBookOpen size={28}/>
      <div><h2>Using Zerynex for the first time?</h2><p>Start with a nonspendable PCZT fixture and see an expected policy finding before integrating your application.</p></div>
      <Link href="/docs/quickstart">Open quickstart <LuArrowRight size={17}/></Link>
    </div>
  </div>
}
