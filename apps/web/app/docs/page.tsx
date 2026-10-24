import type { Metadata } from 'next'
import DocsLayout from '../../src/docs/DocsLayout'
import DocsIndex from '../../src/docs/DocsIndex'

export const metadata: Metadata = {
  title: 'Developer Docs',
  description: 'Install Zerynex, adopt privacy-policy tooling and learn Rust, TypeScript, Python, PCZT, MCP and Zcash infrastructure integration.',
}

export default function DocumentationIndex() {
  return <DocsLayout><DocsIndex/></DocsLayout>
}
