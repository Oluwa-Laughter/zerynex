import type { Metadata } from 'next'
import StageWorkbench from '../../../src/workbench/StageWorkbench'

export const metadata: Metadata = {
  title: 'Stage Regression',
  description: 'Run privacy-policy regression checks against two local Zcash PCZT files, directly in Rust/WebAssembly.',
}
export default function StagesPage() { return <StageWorkbench/> }
