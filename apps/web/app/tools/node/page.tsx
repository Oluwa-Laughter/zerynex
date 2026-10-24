import type { Metadata } from 'next'
import NodeWorkbench from '../../../src/workbench/NodeWorkbench'

export const metadata: Metadata = {
  title: 'Node Readiness',
  description: 'Local-only readiness workbench for Zcash chain network, synchronization, and header lag. No RPC credentials or transaction uploads.',
}
export default function NodePage() {return <NodeWorkbench/>}
