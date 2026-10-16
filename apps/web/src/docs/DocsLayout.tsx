import Link from 'next/link'
import { LuArrowLeft, LuArrowUpRight, LuBookOpen, LuShieldCheck } from 'react-icons/lu'
import type { ReactNode } from 'react'
import { guideGroups, guides, type Guide } from './catalog'



export function Status({ status }: { status: Guide['status'] }) {
  return <span className={'docs-status docs-status-' + status}>{status.toUpperCase()}</span>
}

export default function DocsLayout({
  children,
  selected,
}: {
  children: ReactNode
  selected?: string
}) {
  return <div className="docs-site">
    <header className="docs-header">
      <Link href="/" className="docs-brand" aria-label="Zerynex home">
        <span className="docs-mark"><svg viewBox="0 0 80 80" fill="none" width="25" height="25" aria-hidden="true"><path d="M20 23H59L21 57H60" stroke="currentColor" strokeWidth="9"/><circle cx="62" cy="19" r="5" fill="currentColor"/></svg></span>
        <strong>ZERYNEX</strong>
        <span className="docs-brand-tail">/ DOCUMENTATION</span>
      </Link>
      <nav aria-label="Documentation top navigation">
        <Link href="/tools">Developer Tools <LuArrowUpRight size={14}/></Link>
        <Link href="/ecosystem">SDKs <LuArrowUpRight size={14}/></Link>
        <Link href="/agents">Agents <LuArrowUpRight size={14}/></Link>
      </nav>
    </header>
    <div className="docs-frame">
      <aside className="docs-sidebar" aria-label="Documentation sections">
        <Link href="/docs" className={'docs-sidebar-top' + (!selected ? ' docs-selected' : '')}><LuBookOpen size={16}/> Documentation index</Link>
        {guideGroups.map(group => <section className="docs-sidebar-group" key={group}>
          <h2>{group}</h2>
          {guides.filter(guide => guide.group === group).map(guide =>
            <Link key={guide.slug} href={'/docs/' + guide.slug} className={selected === guide.slug ? 'docs-selected' : ''}>
              {guide.title}
            </Link>
          )}
        </section>)}
        <div className="docs-sidebar-footer"><LuShieldCheck size={15}/> Source-first. No wallet uploads.</div>
      </aside>
      <div className="docs-main">
        <div className="docs-breadcrumb"><Link href="/docs">Documentation</Link><span>/</span>{selected ? <span>{getSelectedTitle(selected)}</span> : <span>All guides</span>}</div>
        {children}
      </div>
    </div>
    <footer className="docs-footer"><Link href="/"><LuArrowLeft size={16}/> Zerynex overview</Link><span>RUST-FIRST · OPEN SOURCE · ZCASH CORE & TOOLING</span></footer>
  </div>
}

function getSelectedTitle(slug: string) {
  return guides.find(guide => guide.slug === slug)?.title ?? 'Guide'
}
