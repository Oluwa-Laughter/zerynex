import type {Metadata} from 'next'
import LightwalletdWorkbench from '../../../src/workbench/LightwalletdWorkbench'

export const metadata: Metadata = {
  title: 'Zcash lightwalletd Readiness — Zerynex',
  description: 'Offline, read-only GetLightdInfo gRPC JSON metadata checks for Zcash app developers. Never connects to a wallet or node.',
}
export default function LightwalletdPage() {return <LightwalletdWorkbench/>}
