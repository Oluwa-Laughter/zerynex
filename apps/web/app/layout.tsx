import type { Metadata, Viewport } from 'next'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './globals.css'
import './cinema.css'
import './tools.css'
import './docs.css'
import './workbench.css'
import './rebrand.css'
import ThemeSwitch from '../src/design/ThemeSwitch'
import SiteHeader from '../src/design/SiteHeader'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Zerynex — Privacy testing for the Zcash ecosystem.',
    template: '%s · Zerynex',
  },
  description: 'Privacy-policy analysis and regression testing for Zcash transaction infrastructure. Inspect PCZT disclosures, test handoffs, and integrate local Rust/WASM, CI and MCP workflows.',
  applicationName: 'Zerynex',
  keywords: ['Zcash', 'PCZT', 'privacy', 'Rust', 'developer tooling', 'Ironwood'],
  openGraph: {
    type: 'website',
    title: 'Zerynex — Privacy testing for the Zcash ecosystem.',
    description: 'Zcash developer infrastructure for local PCZT privacy-policy checks, disclosure regression tests and safe integration workflows.',
    images: ['/og-card.svg'],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111d1a',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{__html: `(function(){try{var t=localStorage.getItem('zerynex-theme');var d=(t==='dark'||t==='light')?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',d);document.documentElement.style.colorScheme=d;}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`}}/><a href="#main-content" className="skip-link">Skip to main content</a><SiteHeader/><div id="main-content">{children}</div><ThemeSwitch/></body></html>
}
