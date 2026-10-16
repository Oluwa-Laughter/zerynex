'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { LuArrowUpRight, LuBookOpen, LuSearch, LuShieldCheck, LuTerminal, LuWaypoints } from 'react-icons/lu'
import { guideGroups, guides } from './catalog'
import { Status } from './DocsLayout'

export default function DocsIndex() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const root = useRef<HTMLDivElement>(null)
  const matches = useMemo(() => guides.filter(guide => {
    if (filter !== 'All' && guide.group !== filter) return false
    const term = query.trim().toLowerCase()
    return !term || [guide.title, guide.audience, guide.group, guide.summary].some(value => value.toLowerCase().includes(term))
  }), [query, filter])
  useEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from('.docs-intro > *', {
        y: 25, opacity: 0, filter: 'blur(7px)', stagger: .09, duration: .8, ease: 'power3.out',
      })
      gsap.from('.docs-guide-card', {
        y: 22, opacity: 0, stagger: .04, duration: .65, ease: 'power3.out',
      })
    }, root)
    return () => ctx.revert()
  }, [])
  return <div ref={root}>
    <div className="docs-intro">
      <span className="docs-kicker">DEVELOPER KNOWLEDGE BASE / ZERYNEX 0.1</span>
      <h1>Build with <em>confidence.</em></h1>
      <p>Actual installation guides, tested workflows, SDK integration examples and explicit support boundaries. Every guide is sourced from the repository docs folder.</p>
      <div className="docs-intro-stats">
        <span><LuBookOpen size={18}/> {guides.length} guides</span>
        <span><LuTerminal size={18}/> Code-first tutorials</span>
        <span><LuShieldCheck size={18}/> Privacy-aware defaults</span>
      </div>
    </div>
    <div className="docs-search-zone">
      <label htmlFor="docs-search"><LuSearch size={19}/> <span className="sr-only">Search documentation</span></label>
      <input id="docs-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search by tool, language or use case..." />
      <span>{matches.length} RESULTS</span>
    </div>
    <div className="docs-filter-list" aria-label="Filter documentation">
      {['All', ...guideGroups].map(group => <button key={group} type="button"
        aria-pressed={filter === group} onClick={() => setFilter(group)}>{group}</button>)}
    </div>
    <div className="docs-card-list">
      {matches.map((guide, index) => <Link href={'/docs/' + guide.slug} className="docs-guide-card" key={guide.slug}>
        <span className="docs-card-index">{String(index+1).padStart(2, '0')}</span>
        <div className="docs-card-content">
          <div className="docs-card-heading"><span>{guide.group.toUpperCase()}</span><Status status={guide.status}/></div>
          <h2>{guide.title}</h2>
          <p>{guide.summary}</p>
          <small>FOR {guide.audience.toUpperCase()}</small>
        </div>
        <LuArrowUpRight size={22} className="docs-card-arrow"/>
      </Link>)}
      {matches.length === 0 && <div className="docs-empty">No matching guides. Try a broader search or choose another category.</div>}
    </div>
    <div className="docs-bottom-prompt">
      <LuWaypoints size={28}/>
      <div><h2>One cryptographic foundation. Multiple developer entry points.</h2>
        <p>Start with the language or workflow you know. Zerynex keeps the core privacy rules in Rust.</p></div>
      <Link href="/docs/installation">Start integrating <LuArrowUpRight size={17}/></Link>
    </div>
  </div>
}
