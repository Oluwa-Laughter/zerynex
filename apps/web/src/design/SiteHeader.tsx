'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LuArrowUpRight, LuMenu, LuX } from 'react-icons/lu'

export default function SiteHeader() {
  const pathname = usePathname()
  const [openOnPath, setOpenOnPath] = useState<string | null>(null)
  const open = pathname === openOnPath
  const header = useRef<HTMLElement>(null)
  const navigation = useRef<HTMLElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLAnchorElement>(null)

  // An open menu belongs to the current route, so navigating closes it.
  // Keep focus inside the header while the mobile menu is open.
  useEffect(() => {
    if (!open) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focus = requestAnimationFrame(() => first.current?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenOnPath(null)
        toggle.current?.focus()
        return
      }
      if (event.key !== 'Tab' || !navigation.current) return
      // The drawer and its close control form one keyboard loop.
      // Do not cycle through the page or the obscured header brand.
      const items = [
        toggle.current,
        ...navigation.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])'),
      ].filter((element): element is HTMLElement =>
        Boolean(element && element.getClientRects().length > 0))
      if (!items.length) return
      const index = items.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey && index === 0) {
        event.preventDefault()
        items.at(-1)?.focus()
      } else if (event.shiftKey && index === 1) {
        event.preventDefault()
        items[0]?.focus()
      } else if (!event.shiftKey && index === 0) {
        event.preventDefault()
        items[1]?.focus()
      } else if (!event.shiftKey && (index === items.length - 1 || index === -1)) {
        event.preventDefault()
        items[0]?.focus()
      }
    }
    const onPointer = (event: PointerEvent) => {
      if (header.current && !header.current.contains(event.target as Node))
        setOpenOnPath(null)
    }
    const onResize = () => {
      if (window.innerWidth > 980) setOpenOnPath(null)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(focus)
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return <header ref={header} className="topbar zn-site-header">
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
    <nav ref={navigation} className={'desktop-nav' + (open ? ' nav-open' : '')}
      id="zn-primary-navigation" aria-label="Primary">
      <Link ref={first} href="/" className={pathname === '/' ? 'nav-active' : ''}
        onClick={() => setOpenOnPath(null)}>Overview</Link>
      <Link href="/ecosystem" className={pathname === '/ecosystem' ? 'nav-active' : ''}
        onClick={() => setOpenOnPath(null)}>SDKs</Link>
      <Link href="/integrate" className={pathname === '/integrate' ? 'nav-active' : ''}
        onClick={() => setOpenOnPath(null)}>Integrate</Link>
      <Link href="/agents" className={pathname === '/agents' ? 'nav-active' : ''}
        onClick={() => setOpenOnPath(null)}>Agents</Link>
      <Link href="/docs" className={pathname?.startsWith('/docs') ? 'nav-active' : ''}
        onClick={() => setOpenOnPath(null)}>Docs</Link>
      <Link href="/tools" className={'zn-mobile-tool-link' + (pathname?.startsWith('/tools') ? ' nav-active' : '')}
        onClick={() => setOpenOnPath(null)}>Open workbench <LuArrowUpRight size={16}/></Link>
    </nav>
    <div className="nav-actions">
      <Link href="/tools" className="nav-console" onClick={() => setOpenOnPath(null)}>
        Open workbench <LuArrowUpRight size={15}/>
      </Link>
      <button ref={toggle} type="button" className="mobile-toggle"
        aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
        aria-controls="zn-primary-navigation"
        onClick={() => setOpenOnPath(value => value === pathname ? null : pathname)}>
        {open ? <LuX size={23}/> : <LuMenu size={23}/>}
      </button>
    </div>
  </header>
}
