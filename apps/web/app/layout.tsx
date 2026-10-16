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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Zerynex — Privacy is a property.',
    template: '%s · Zerynex',
  },
  description: 'A local-first privacy policy engine for Zcash PCZT workflows. Verify handoffs, reduce unwanted disclosure, and build with Rust and WebAssembly.',
  applicationName: 'Zerynex',
  keywords: ['Zcash', 'PCZT', 'privacy', 'Rust', 'developer tooling', 'Ironwood'],
  openGraph: {
    type: 'website',
    title: 'Zerynex — Privacy is a property.',
    description: 'Privacy policy analysis for Zcash developers. Your PCZT remains on your device.',
    images: ['/og-card.svg'],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>
}
