'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LuArrowLeft, LuArrowUpRight, LuCheck, LuCircleAlert, LuCode, LuLockKeyhole, LuNetwork } from 'react-icons/lu'
import { evaluateZcashNodeStatus, type NodeReadiness, type ZcashNetwork } from '@zerynex/sdk'
import styles from './NodeWorkbench.module.css'

const MAX_INPUT = 64 * 1024
const samples = {
  ready: {chain:'test',blocks:250000,headers:250001,initial_block_download_complete:true,
    verificationprogress:0.9999,bestblockhash:'example-synthetic-only'},
  syncing: {chain:'test',blocks:250000,headers:250080,initial_block_download_complete:false,
    verificationprogress:0.84},
  wrong: {chain:'main',blocks:250000,headers:250000,initial_block_download_complete:true,
    verificationprogress:1},
} as const

export default function NodeWorkbench() {
  const [input,setInput] = useState('')
  const [network,setNetwork] = useState<ZcashNetwork>('test')
  const [maxLag,setMaxLag] = useState(2)
  const [result,setResult] = useState<NodeReadiness | null>(null)
  const [error,setError] = useState<string | null>(null)
  function selectSample(which: keyof typeof samples) {
    setInput(JSON.stringify(samples[which],null,2))
    setResult(null)
    setError(null)
  }
  function inspect() {
    setResult(null)
    setError(null)
    if (!input.trim() || input.length > MAX_INPUT) {
      setError('Choose a nonempty public chain-state response below 64 KiB.')
      return
    }
    try {
      const parsed: unknown = JSON.parse(input)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
      const candidate = parsed as Record<string,unknown>
      if ('error' in candidate && candidate.error != null) throw new Error()
      const body = 'result' in candidate ? candidate.result : candidate
      const checked = evaluateZcashNodeStatus(body, {expectedNetwork:network,maxHeaderLag:maxLag})
      setResult(checked)
    } catch {
      setError('Cannot evaluate this response. Paste valid public getblockchaininfo JSON only; no private RPC data.')
    }
  }
  const statuses = {pass:'PASSED',fail:'CHECK FAILED',unknown:'NOT CONFIRMED'}
  return <main className={styles.page}>
    <header className={styles.top}>
      <Link href="/tools"><LuArrowLeft size={16}/> Developer Tools</Link>
      <span>LOCAL-ONLY EVALUATION / NO REMOTE RPC</span>
      <Link href="/docs/node-readiness">Integration guide <LuArrowUpRight size={16}/></Link>
    </header>
    <section className={styles.hero}>
      <span className={styles.eyebrow}><LuNetwork size={17}/> ZCASH INFRASTRUCTURE / DEVELOPER WORKBENCH</span>
      <h1>Is your Zcash node <em>ready?</em></h1>
      <p>Check network identity, synchronization, header lag, and verification progress before integrating a node into a wallet, checkout, relayer, or indexer. This analyzer runs entirely in your browser.</p>
    </section>
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="node-input-label">
        <div className={styles.panelHead}><h2 id="node-input-label">01 / Public RPC response</h2><span>JSON · MAX 64 KiB</span></div>
        <p className={styles.description}>Paste the <strong>public `result` object</strong> from `getblockchaininfo`, or use a nonspendable synthetic example. Do not paste authorization headers, wallet exports, private transaction data or RPC cookies.</p>
        <div className={styles.presets} aria-label="Synthetic node examples">
          <button type="button" onClick={()=>selectSample('ready')}>Ready node</button>
          <button type="button" onClick={()=>selectSample('syncing')}>Syncing node</button>
          <button type="button" onClick={()=>selectSample('wrong')}>Wrong network</button>
        </div>
        <label className={styles.label} htmlFor="node-json">Blockchain info JSON</label>
        <textarea id="node-json" className={styles.editor} spellCheck={false} value={input}
          onChange={event=>{setInput(event.target.value.slice(0,MAX_INPUT+1));setResult(null);setError(null)}}
          placeholder={'{\n  "chain": "test",\n  "blocks": 250000,\n  "headers": 250001,\n  "verificationprogress": 0.9999\n}'} rows={12}/>
        <div className={styles.controls}>
          <label>Expected network
            <select value={network} onChange={event=>{setNetwork(event.target.value as ZcashNetwork);setResult(null)}}>
              <option value="test">Testnet</option><option value="main">Mainnet</option><option value="regtest">Regtest</option>
            </select>
          </label>
          <label>Maximum header lag
            <select value={maxLag} onChange={event=>{setMaxLag(Number(event.target.value));setResult(null)}}>
              <option value={0}>0 blocks</option><option value={2}>2 blocks</option><option value={6}>6 blocks</option><option value={20}>20 blocks</option>
            </select>
          </label>
        </div>
        <button className={styles.run} type="button" onClick={inspect}><LuCode size={17}/> Analyze readiness <LuArrowUpRight size={17}/></button>
        {error && <div className={styles.error} role="alert"><LuCircleAlert size={16}/>{error}</div>}
        <div className={styles.private}><LuLockKeyhole size={16}/> Input remains in this browser tab. No wallet access, node connection, upload or persistent storage.</div>
      </section>
      <section className={styles.panel} aria-labelledby="node-report-heading" aria-live="polite">
        <div className={styles.panelHead}><h2 id="node-report-heading">02 / Chain readiness</h2><span>READ-ONLY / V1</span></div>
        {!result ? <div className={styles.empty}><LuNetwork size={38}/><h3>Review a node response.</h3><p>Load a synthetic example or paste a public chain-state object. Zerynex will show only the supported, sanitized readiness fields.</p></div> : <>
          <div className={styles.outcome} data-ready={result.ready}>
            {result.ready ? <LuCheck size={23}/> : <LuCircleAlert size={23}/>}
            <div><strong>{result.ready ? 'NODE READINESS CONFIRMED' : 'NODE IS NOT READY'}</strong><p>{result.ready ? 'All five local policy checks passed.' : 'At least one readiness check failed or is unknown.'}</p></div>
          </div>
          <div className={styles.metrics}>
            <div><span>NETWORK</span><strong>{result.network ?? 'Unknown'}</strong></div>
            <div><span>BLOCK HEIGHT</span><strong>{result.height ?? 'Unknown'}</strong></div>
            <div><span>HEADER HEIGHT</span><strong>{result.headers ?? 'Unknown'}</strong></div>
            <div><span>HEADER LAG</span><strong>{result.header_lag ?? 'Unknown'}</strong></div>
          </div>
          <div className={styles.checks}>
            {result.checks.map(check=><div key={check.code}><span>{check.code.replaceAll('_',' ')}</span><strong data-status={check.status}>{statuses[check.status]}</strong></div>)}
          </div>
          <p className={styles.caveat}>{result.limitation}</p>
        </>}
        <Link className={styles.apiLink} href="/docs/zcash-app-recipes">Integrate in a real Zcash application <LuArrowUpRight size={17}/></Link>
      </section>
    </div>
  </main>
}
