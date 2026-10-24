import type { Metadata } from 'next'
import HandoffWorkbench from '../../../src/workbench/HandoffWorkbench'
export const metadata:Metadata={
  title:'PCZT Handoff Tests',
  description:'Run deterministic synthetic Creator, Updater, Combiner and Redactor scenarios with the real Rust policy engine in your browser.',
}
export default function HandoffPage(){return <HandoffWorkbench/>}
