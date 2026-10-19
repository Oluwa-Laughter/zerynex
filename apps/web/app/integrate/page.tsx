import type { Metadata } from 'next'
import ProjectIntegration from '../../src/ProjectIntegration'

export const metadata: Metadata = {
  title: 'Integrate Zerynex Into Your Project',
  description: 'Install Zcash developer tooling into your own environment: Rust CLI, WebAssembly SDK, Python, GitHub Actions or restricted local MCP, without wallet custody or PCZT uploads.',
}

export default function IntegratePage() {
  return <ProjectIntegration/>
}
