import type { Metadata } from 'next'
import TransactionWorkbench from '../../../src/workbench/TransactionWorkbench'

export const metadata:Metadata = {
  title:'Transaction Observation',
  description:'Inspect Zcash RPC confirmation consistency and possible chain reorganizations locally; no live RPC, transaction uploads or payment execution.',
}
export default function TransactionPage(){return <TransactionWorkbench/>}
