'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LuArrowUpRight, LuMenu, LuX } from 'react-icons/lu'

export default function SiteHeader() {
  const pathname = usePathname()
  const [openOnPath, setOpenOnPath] = useState<string | null>(null)
  const open = pathname === openOnPath
  const router = useRouter()
  const toggle = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLButtonElement>(null)

  // An open menu is scoped to its route, so route changes close it automatically.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenOnPath(null)
        toggle.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const navigate = (destination: string) => {
    setOpenOnPath(null)
    router.push(destination)
  }
  const toggleMenu = () => {
    setOpenOnPath(current => current === pathname ? null : pathname)
    if (!open) requestAnimationFrame(() => first.current?.focus())
  }
  return <header className="topbar zn-site-header">
    <Link href="/" className="brand" aria-label="Zerynex home" onClick={() => setOpenOnPath(null)}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 80 80" fill="none">
          <path d="M20 23H59L21 57H60" stroke="currentColor" strokeWidth="9" strokeLinejoin="round"/>
          <path d="M22 14V25M58 55V66" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="62" cy="19" r="5" fill="currentColor"/>
        </svg>
      </span>
      <span>ZERYNEX</span>
    </Link>
    <nav className={'desktop-nav' + (open ? ' nav-open' : '')} id="zn-primary-navigation" aria-label="Primary">
      <button ref={first} type="button" className={pathname === '/' ? 'nav-active' : ''}
        onClick={() => navigate('/')}>Overview</button>
      <button type="button" className={pathname === '/ecosystem' ? 'nav-active' : ''}
        onClick={() => navigate('/ecosystem')}>SDKs</button>
      <Link href="/agents" className={pathname === '/agents' ? 'nav-active' : ''} onClick={() => setOpenOnPath(null)}>Agents</Link>
      <Link href="/docs" className={pathname?.startsWith('/docs') ? 'nav-active' : ''} onClick={() => setOpenOnPath(null)}>Docs</Link>
      <Link href="/tools" className="zn-mobile-tool-link" onClick={() => setOpenOnPath(null)}>Open workbench <LuArrowUpRight size={16}/></Link>
    </nav>
    <div className="nav-actions">
      <button type="button" className="nav-console" onClick={() => navigate('/tools')}>
        Open workbench <LuArrowUpRight size={15}/>
      </button>
      <button ref={toggle} type="button" className="mobile-toggle" aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open} aria-controls="zn-primary-navigation" onClick={toggleMenu}>
        {open ? <LuX size={23}/> : <LuMenu size={23}/>}
      </button>
    </div>
  </header>
}
