import type { Metadata } from 'next'
import PaymentWorkbench from '../../../src/workbench/PaymentWorkbench'

export const metadata: Metadata = {
  title: 'ZIP-321 Payment Request Inspector — Zerynex',
  description: 'Inspect Zcash ZIP-321 payment requests locally with the canonical Rust/WebAssembly parser. No signing, uploads, or wallet access.',
}
export default function PaymentPage() { return <PaymentWorkbench/> }
