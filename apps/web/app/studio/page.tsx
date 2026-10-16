import type { Metadata } from 'next'
import App from '../../src/App'

export const metadata: Metadata = {
  title: 'Privacy Studio',
  description: 'Locally inspect real Zcash PCZT files with the Zerynex Rust WebAssembly analyzer.',
}

export default function StudioPage() {
  return <App page="studio" />
}
