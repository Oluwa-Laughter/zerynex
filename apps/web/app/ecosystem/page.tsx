import type { Metadata } from 'next'
import App from '../../src/App'

export const metadata: Metadata = {
  title: 'Ecosystem Atlas',
  description: 'Choose a development path for Zcash wallets, privacy engineering, node infrastructure, SDKs and AI-assisted tools using Zerynex.',
}

export default function EcosystemPage() {
  return <App page="ecosystem" />
}
