'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LuArrowLeft, LuArrowUpRight, LuCheck, LuCircleAlert, LuCode, LuLockKeyhole, LuWallet } from 'react-icons/lu'
import { inspectZip321Uri, type Zip321Summary } from '@zerynex/sdk/browser'
import styles from './NodeWorkbench.module.css'

const sample = 'zcash:ztestsapling10yy2ex5dcqkclhc7z7yrnjq2z6feyjad56ptwlfgmy77dmaqqrl9gyhprdx59qgmsnyfska2kez?amount=1&memo=VGhpcyBpcyBhIHNpbXBsZSBtZW1vLg&message=Thank%20you%20for%20your%20purchase'
const multi = 'zcash:?address=tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU&amount=123.456&address.1=ztestsapling10yy2ex5dcqkclhc7z7yrnjq2z6feyjad56ptwlfgmy77dmaqqrl9gyhprdx59qgmsnyfska2kez&amount.1=0.789'

export default function PaymentWorkbench() {
  const [uri,setUri] = useState('')
  const [network,setNetwork] = useState<'main'|'test'|'regtest'>('test')
  const [busy,setBusy] = useState(false)
  const [report,setReport] = useState<Zip321Summary|null>(null)
  const [error,setError] = useState<string|null>(null)
  async function inspect(){
    if (busy)return
    setError(null);setReport(null);setBusy(true)
    try {
      const result=await inspectZip321Uri(uri,network,{wasm:'/wasm/zerynex_bg.wasm'})
      setReport(result)
    } catch {
      setError('Payment request rejected. Check its network, recipient checksum, amount, memo and required parameters. No payment was attempted.')
    } finally {setBusy(false)}
  }
  function load(value:string){setUri(value);setError(null);setReport(null)}
  return <main className={styles.page}>
    <header className={styles.top}>
      <Link href="/tools"><LuArrowLeft size={16}/> Developer Tools</Link>
      <span>LOCAL ZIP-321 / RUST + WASM</span>
      <Link href="/docs/payment-requests">Integration guide <LuArrowUpRight size={16}/></Link>
    </header>
    <section className={styles.hero}>
      <span className={styles.eyebrow}><LuWallet size={17}/> SHIELDED PAYMENTS / WALLET + MERCHANT TOOLING</span>
      <h1>Inspect payment <em>requests.</em></h1>
      <p>Check ZIP-321 request syntax, actual Zcash address encoding, recipient network and multi-payment amounts with the canonical Rust engine—right in your browser. No signing, wallet connection or payment execution.</p>
    </section>
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="request-input">
        <div className={styles.panelHead}><h2 id="request-input">01 / Payment request</h2><span>ZIP-321 · MAX 16 KiB</span></div>
        <p className={styles.description}>Paste a payment URI beginning with <code>zcash:</code>, or load a nonspendable specification example. A request is not a payment authorization; always confirm details in your wallet.</p>
        <div className={styles.presets}>
          <button type="button" onClick={()=>load(sample)}>Shielded example</button>
          <button type="button" onClick={()=>load(multi)}>Multiple recipients</button>
          <button type="button" onClick={()=>load(sample+'&req-wallet-sign=1')}>Unsupported required field</button>
        </div>
        <label className={styles.label} htmlFor="zip321-uri">ZIP-321 URI</label>
        <textarea className={styles.editor} id="zip321-uri" spellCheck={false} rows={11} value={uri}
          onChange={e=>load(e.target.value.slice(0,16385))} placeholder="zcash:..."/>
        <div className={styles.controls}>
          <label>Expected Zcash network
            <select value={network} onChange={e=>{setNetwork(e.target.value as 'main'|'test'|'regtest');setReport(null)}}>
              <option value="test">Testnet</option><option value="main">Mainnet</option><option value="regtest">Regtest</option>
            </select>
          </label>
        </div>
        <button className={styles.run} type="button" disabled={busy} onClick={()=>void inspect()}><LuCode size={17}/> {busy?'Inspecting…':'Validate payment request'} <LuArrowUpRight size={17}/></button>
        {error&&<div className={styles.error} role="alert"><LuCircleAlert size={16}/>{error}</div>}
        <div className={styles.private}><LuLockKeyhole size={16}/> The URI stays inside this browser tab. Zerynex does not transmit addresses, memos or request contents to its backend.</div>
      </section>
      <section className={styles.panel} aria-labelledby="payment-output">
        <div className={styles.panelHead}><h2 id="payment-output">02 / Validated structure</h2><span>REDACTED · LOCAL ONLY</span></div>
        {!report?<div className={styles.empty}><LuWallet size={39}/><h3>Inspect a request locally.</h3><p>Choose one of the specification examples or provide your own ZIP-321 URI. The report omits recipient addresses, memo contents and payment labels.</p></div>:<>
          <div className={styles.outcome} data-ready={true}><LuCheck size={22}/><div><strong>ZIP-321 REQUEST STRUCTURE VALID</strong><p>Supported ZEC-only fields parsed for {network}. Wallet approval is still required.</p></div></div>
          <div className={styles.metrics}>
            <div><span>NETWORK</span><strong>{report.network}</strong></div>
            <div><span>PAYMENTS</span><strong>{report.payments.length}</strong></div>
            <div><span>TOTAL (ZAT)</span><strong>{report.total_zat??'Unspecified'}</strong></div>
            <div><span>ASSET</span><strong>ZEC only</strong></div>
          </div>
          <div className={styles.checks}>{report.payments.map(item=><div key={item.index}>
            <span>PAYMENT {item.index} · {item.address_type.replaceAll('_',' ')}</span>
            <strong data-status="pass">{item.amount_zat===null?'AMOUNT UNSPECIFIED':`${item.amount_zat} ZAT`}{item.memo_present?' · MEMO':''}</strong>
          </div>)}</div>
          <p className={styles.caveat}>{report.limitation}</p>
        </>}
        <Link className={styles.apiLink} href="/docs/payment-requests">Implement ZIP-321 validation in your application <LuArrowUpRight size={17}/></Link>
      </section>
    </div>
  </main>
}
