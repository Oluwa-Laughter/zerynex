import type {Metadata} from 'next'
import RefundWorkbench from '../../../src/workbench/RefundWorkbench'
export const metadata:Metadata={
 title:'Refund Privacy Audit',
 description:'Offline Zcash refund metadata audit and per-flow privacy-regression workbench for swap and wallet engineers. No wallet keys, viewing keys or uploads.',
}
export default function RefundPage(){return <RefundWorkbench/>}
