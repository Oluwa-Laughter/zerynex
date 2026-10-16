import type { Metadata } from 'next'
import App from '../../src/App'
export const metadata: Metadata = {
  title: 'Developer Tools',
  description: 'PCZT inspection and integration quickstarts for Zcash Rust, wallet, TypeScript, Python and agent engineering.',
}
export default function ToolsPage() { return <App page="tools" /> }
