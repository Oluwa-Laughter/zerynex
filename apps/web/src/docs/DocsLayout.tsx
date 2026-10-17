'use client'
import Link from 'next/link'
import { LuArrowLeft, LuBookOpen, LuShieldCheck } from 'react-icons/lu'
import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { LuMenu, LuX } from 'react-icons/lu'
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
  const pathname = usePathname()
  const [mobileContentsPath, setMobileContentsPath] = useState<string | null>(null)
  const mobileContents = mobileContentsPath === pathname
  return <div className="docs-site">
    <div className="docs-frame">
      <button type="button" className="docs-mobile-contents" aria-expanded={mobileContents}
        aria-controls="docs-contents-sidebar" onClick={() => setMobileContentsPath(value=>value === pathname ? null : pathname)}>
        {mobileContents ? <LuX size={18}/> : <LuMenu size={18}/>}
        {mobileContents ? 'Close documentation menu' : 'Browse documentation sections'}
      </button>
      <aside id="docs-contents-sidebar" className={'docs-sidebar' + (mobileContents ? ' docs-sidebar-open' : '')} aria-label="Documentation sections">
        <Link href="/docs" onClick={()=>setMobileContentsPath(null)} className={'docs-sidebar-top' + (!selected ? ' docs-selected' : '')}><LuBookOpen size={16}/> Documentation index</Link>
        {guideGroups.map(group => <section className="docs-sidebar-group" key={group}>
          <h2>{group}</h2>
          {guides.filter(guide => guide.group === group).map(guide =>
            <Link key={guide.slug} onClick={()=>setMobileContentsPath(null)} href={'/docs/' + guide.slug} className={selected === guide.slug ? 'docs-selected' : ''}>
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
