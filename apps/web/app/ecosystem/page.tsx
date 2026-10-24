import type { Metadata } from 'next'
import App from '../../src/App'

export const metadata: Metadata = {
  title: 'Developer SDKs',
  description: 'Integrate Zcash node-readiness checks, PCZT privacy policies, RPC compatibility and developer SDKs into payments, wallets, relayers and infrastructure applications.',
}

export default function EcosystemPage() {
  return <App page="ecosystem" />
}
