import type { Metadata } from 'next'
import App from '../../src/App'
export const metadata: Metadata = {
  title: 'Developer Tools',
  description: 'Local-first Zcash development tools: PCZT privacy analysis, node readiness, wallet handoffs, SDKs and CI integrations.',
}
export default function ToolsPage() { return <App page="tools" /> }
