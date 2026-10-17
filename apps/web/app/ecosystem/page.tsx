import type { Metadata } from 'next'
import App from '../../src/App'

export const metadata: Metadata = {
  title: 'Zcash SDKs and Integrations',
  description: 'Integrate Zerynex privacy-policy and transaction-regression checks into Zcash applications through Rust, TypeScript, Python, Go and local agent tooling.',
}

export default function EcosystemPage() {
  return <App page="ecosystem" />
}
