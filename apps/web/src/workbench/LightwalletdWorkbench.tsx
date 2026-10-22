'use client'

import {useState} from 'react'
import Link from 'next/link'
import {LuArrowLeft,LuArrowUpRight,LuCheck,LuCircleAlert,LuCode,LuLockKeyhole,LuNetwork} from 'react-icons/lu'
import {evaluateLightwalletdJson, type LightwalletdNetwork, type LightwalletdReadiness} from '@zerynex/sdk'
import styles from './NodeWorkbench.module.css'

const MAX_INPUT = 64 * 1024
const examples = {
  ready: {chainName:'test',blockHeight:'3100000',estimatedHeight:'3100002',saplingActivationHeight:'280000',consensusBranchId:'c2d6d0b4'},
  syncing: {chainName:'test',blockHeight:'3100000',estimatedHeight:'3100040',saplingActivationHeight:'280000',consensusBranchId:'c2d6d0b4'},
  wrong: {chainName:'main',blockHeight:'3100000',estimatedHeight:'3100000',saplingActivationHeight:'280000',consensusBranchId:'c2d6d0b4'},
  unknown: {chainName:'test',blockHeight:'3100000',estimatedHeight:'0',saplingActivationHeight:'280000',consensusBranchId:''},
} as const

export default function LightwalletdWorkbench() {
  const [input,setInput] = useState('')
  const [network,setNetwork] = useState<LightwalletdNetwork>('test')
  const [maxLag,setMaxLag] = useState(2)
  const [result,setResult] = useState<LightwalletdReadiness | null>(null)
  const [error,setError] = useState<string | null>(null)
  const statuses = {pass:'PASSED',fail:'CHECK FAILED',unknown:'NOT CONFIRMED'}
  function reset() {setResult(null);setError(null)}
  function load(which:keyof typeof examples) {
    setInput(JSON.stringify(examples[which],null,2))
    reset()
  }
  function inspect() {
    reset()
    if(!input.trim() || new TextEncoder().encode(input).byteLength > MAX_INPUT) {
      setError('Select a nonempty public GetLightdInfo response under 64 KiB.')
      return
    }
    try {
      setResult(evaluateLightwalletdJson(input,{expectedNetwork:network,maxHeightLag:maxLag}))
    } catch {
      setError('Response rejected. Paste valid public GetLightdInfo JSON without duplicate keys or private wallet data.')
    }
  }
  return <main className={styles.page}>
    <header className={styles.top}>
      <Link href="/tools/node"><LuArrowLeft size={16}/> Node readiness</Link>
      <span>LOCAL METADATA ONLY / NO GRPC CONNECTION</span>
      <Link href="/docs/node-readiness">SDK integration guide <LuArrowUpRight size={16}/></Link>
    </header>
    <section className={styles.hero}>
      <span className={styles.eyebrow}><LuNetwork size={17}/> ZCASH LIGHTWALLETD / OFFLINE PREVIEW</span>
      <h1>Inspect lightwalletd <em>readiness.</em></h1>
      <p>Review a public GetLightdInfo response before connecting a Zcash application. Check the reported network, heights, Sapling activation, sync lag, and branch identifier shape. Nothing is sent to a server.</p>
    </section>
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="lightd-input-heading">
        <div className={styles.panelHead}><h2 id="lightd-input-heading">01 / Public gRPC metadata</h2><span>JSON · MAX 64 KiB</span></div>
        <p className={styles.description}>Paste the <strong>public GetLightdInfo protobuf JSON object</strong> from your own trusted backend, or use a synthetic example. Do not paste wallet keys, viewing keys, cookies, credentials, addresses, or private transactions.</p>
        <div className={styles.presets} aria-label="Synthetic lightwalletd examples">
          <button type="button" onClick={()=>load('ready')}>Ready lightwalletd</button>
          <button type="button" onClick={()=>load('syncing')}>Syncing lightwalletd</button>
          <button type="button" onClick={()=>load('wrong')}>Wrong network</button>
          <button type="button" onClick={()=>load('unknown')}>Unknown state</button>
        </div>
        <label className={styles.label} htmlFor="lightd-json">GetLightdInfo JSON</label>
        <textarea id="lightd-json" className={styles.editor} rows={12} spellCheck={false}
          value={input} onChange={e=>{setInput(e.target.value.slice(0,MAX_INPUT+1));reset()}}
          placeholder={'{\n  "chainName": "test",\n  "blockHeight": "3100000",\n  "estimatedHeight": "3100002"\n}'}/>
        <div className={styles.controls}>
          <label>Expected network
            <select value={network} onChange={e=>{setNetwork(e.target.value as LightwalletdNetwork);reset()}}>
              <option value="test">Testnet</option><option value="main">Mainnet</option><option value="regtest">Regtest</option>
            </select>
          </label>
          <label>Maximum estimated lag
            <select value={maxLag} onChange={e=>{setMaxLag(Number(e.target.value));reset()}}>
              <option value={0}>0 blocks</option><option value={2}>2 blocks</option><option value={6}>6 blocks</option><option value={20}>20 blocks</option>
            </select>
          </label>
        </div>
        <button className={styles.run} type="button" onClick={inspect}><LuCode size={17}/> Evaluate metadata <LuArrowUpRight size={17}/></button>
        {error && <div className={styles.error} role="alert"><LuCircleAlert size={16}/>{error}</div>}
        <div className={styles.private}><LuLockKeyhole size={16}/> All parsing runs in this tab. No gRPC connection, no uploads, no saved input. Never paste confidential metadata.</div>
      </section>
      <section className={styles.panel} aria-labelledby="lightd-report-heading" aria-live="polite">
        <div className={styles.panelHead}><h2 id="lightd-report-heading">02 / Sanitized metadata checks</h2><span>PREVIEW / READ ONLY</span></div>
        {!result ? <div className={styles.empty}><LuNetwork size={38}/><h3>Review a response.</h3><p>Load a synthetic sample or paste public metadata. Only network, heights, lag, and fixed policy check names are shown.</p></div> : <>
          <div className={styles.outcome} data-ready={result.ready}>
            {result.ready ? <LuCheck size={23}/> : <LuCircleAlert size={23}/>}
            <div><strong>{result.ready ? 'METADATA CHECKS PASSED' : 'READINESS NOT CONFIRMED'}</strong>
              <p>{result.ready ? 'Five declared metadata checks passed; live connectivity is not verified.' : 'At least one reported field is missing, inconsistent, or outside policy.'}</p></div>
          </div>
          <div className={styles.metrics}>
            <div><span>NETWORK</span><strong>{result.network ?? 'Unknown'}</strong></div>
            <div><span>BLOCK HEIGHT</span><strong>{result.block_height ?? 'Unknown'}</strong></div>
            <div><span>ESTIMATED HEIGHT</span><strong>{result.estimated_height ?? 'Unknown'}</strong></div>
            <div><span>ESTIMATED LAG</span><strong>{result.sync_lag ?? 'Unknown'}</strong></div>
          </div>
          <div className={styles.checks}>{result.checks.map(check=><div key={check.code}>
            <span>{check.code.replaceAll('_',' ')}</span><strong data-status={check.status}>{statuses[check.status]}</strong>
          </div>)}</div>
          <p className={styles.caveat}>{result.limitation}</p>
        </>}
        <Link className={styles.apiLink} href="/docs/node-readiness">Use the pure SDK in your own backend <LuArrowUpRight size={17}/></Link>
      </section>
    </div>
  </main>
}
