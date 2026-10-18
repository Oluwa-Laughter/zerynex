'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { LuArrowLeft, LuArrowUpRight, LuCheck, LuCircleAlert, LuCode, LuGitBranch, LuLockKeyhole } from 'react-icons/lu'
import { createZcashTransactionObserver, type TransactionChange, type ZcashNetwork } from '@zerynex/sdk'
import styles from './NodeWorkbench.module.css'

const txid='a'.repeat(64)
const blockhash='b'.repeat(64)
const chainhash='c'.repeat(64)
const chain={chain:'test',blocks:106,headers:106,initial_block_download_complete:true,verificationprogress:1,bestblockhash:chainhash}
const examples={
  confirmed:{tx:{txid,confirmations:7,height:100,blockhash},chain},
  pending:{tx:{txid,confirmations:0},chain},
  orphaned:{tx:{txid,confirmations:-1,blockhash,in_active_chain:false},chain},
  wrong:{tx:{txid,confirmations:7,height:100,blockhash},chain:{...chain,chain:'main'}},
} as const

export default function TransactionWorkbench(){
  const [txInput,setTxInput]=useState('')
  const [chainInput,setChainInput]=useState('')
  const [expectedNetwork,setNetwork]=useState<ZcashNetwork>('test')
  const [expectedTxid,setExpectedTxid]=useState(txid)
  const [required,setRequired]=useState(6)
  const [result,setResult]=useState<TransactionChange|null>(null)
  const [error,setError]=useState<string|null>(null)
  const observerRef=useRef<{key:string,watcher:ReturnType<typeof createZcashTransactionObserver>}|null>(null)

  function loadExample(which:keyof typeof examples){
    setTxInput(JSON.stringify(examples[which].tx,null,2))
    setChainInput(JSON.stringify(examples[which].chain,null,2))
    setResult(null);setError(null)
  }
  function inspect(){
    setResult(null);setError(null)
    try{
      if(!txInput.trim() || !chainInput.trim() || txInput.length>65536 || chainInput.length>65536)
        throw Error()
      const tx:unknown=JSON.parse(txInput)
      const info:unknown=JSON.parse(chainInput)
      if(!tx || !info || typeof tx!=='object' || typeof info!=='object' || Array.isArray(tx) || Array.isArray(info))throw Error()
      if(('result' in tx) || ('result' in info) || ('error' in tx) || ('error' in info))throw Error()
      const policy={expectedNetwork,expectedTxid,requiredConfirmations:required}
      const key=`${expectedNetwork}:${expectedTxid.toLowerCase()}:${required}`
      if(observerRef.current?.key!==key)observerRef.current={key,watcher:createZcashTransactionObserver(policy)}
      setResult(observerRef.current.watcher.observe(tx,info))
    }catch{
      setError('Observation rejected. Provide valid public RPC result objects and a 64-character transaction ID; no node connection or transaction was attempted.')
    }
  }
  const good=result?.observation.state==='confirmation_target_met'
  return <main className={styles.page}>
    <header className={styles.top}>
      <Link href="/tools"><LuArrowLeft size={16}/> Developer Tools</Link>
      <span>OFFLINE RPC OBSERVATION / NO WALLET CONNECTION</span>
      <Link href="/docs/transaction-observations">Integration guide <LuArrowUpRight size={16}/></Link>
    </header>
    <section className={styles.hero}>
      <span className={styles.eyebrow}><LuGitBranch size={17}/> ZCASH TRANSACTION INFRASTRUCTURE / DEVELOPER WORKBENCH</span>
      <h1>Inspect transaction <em>confirmations.</em></h1>
      <p>Check a Zcash node&apos;s reported transaction height, confirmation count and network consistency. Compare observations for possible reorganizations. This is local diagnostic tooling—not proof of a payment or wallet receipt.</p>
    </section>
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="transaction-input-heading">
        <div className={styles.panelHead}><h2 id="transaction-input-heading">01 / Public RPC results</h2><span>MAX 64 KiB / OBJECT</span></div>
        <p className={styles.description}>Use publicly shareable <code>getrawtransaction(txid, 1)</code> and <code>getblockchaininfo</code> <strong>result objects</strong>, not their JSON-RPC envelopes. Do not paste wallet-specific, private, or authenticated request material.</p>
        <div className={styles.presets}>
          <button type="button" onClick={()=>loadExample('confirmed')}>Confirmed synthetic</button>
          <button type="button" onClick={()=>loadExample('pending')}>Unconfirmed</button>
          <button type="button" onClick={()=>loadExample('orphaned')}>Orphaned example</button>
          <button type="button" onClick={()=>loadExample('wrong')}>Wrong network</button>
        </div>
        <label className={styles.label} htmlFor="txid-input">Expected transaction ID (64 hex)</label>
        <textarea id="txid-input" className={styles.editor} rows={2} style={{minHeight:70}} spellCheck={false} value={expectedTxid}
          onChange={event=>{setExpectedTxid(event.target.value.slice(0,65));setResult(null);setError(null)}} />
        <label className={styles.label} htmlFor="transaction-rpc-json" style={{marginTop:18}}>getrawtransaction verbose result</label>
        <textarea id="transaction-rpc-json" className={styles.editor} rows={6} spellCheck={false} value={txInput}
          onChange={event=>{setTxInput(event.target.value.slice(0,65537));setResult(null);setError(null)}} placeholder={'{"txid":"...", "confirmations":7, "blockhash":"...", "height":100}'}/>
        <label className={styles.label} htmlFor="chain-rpc-json" style={{marginTop:18}}>getblockchaininfo result</label>
        <textarea id="chain-rpc-json" className={styles.editor} rows={5} spellCheck={false} value={chainInput}
          onChange={event=>{setChainInput(event.target.value.slice(0,65537));setResult(null);setError(null)}} placeholder={'{"chain":"test", "blocks":106}'}/>
        <div className={styles.controls}>
          <label>Expected network
            <select value={expectedNetwork} onChange={event=>{setNetwork(event.target.value as ZcashNetwork);setResult(null)}}>
              <option value="test">Testnet</option><option value="main">Mainnet</option><option value="regtest">Regtest</option>
            </select>
          </label>
          <label>Required confirmations
            <select value={required} onChange={event=>{setRequired(Number(event.target.value));setResult(null)}}>
              <option value={1}>1 confirmation</option><option value={3}>3 confirmations</option><option value={6}>6 confirmations</option><option value={10}>10 confirmations</option><option value={20}>20 confirmations</option>
            </select>
          </label>
        </div>
        <button className={styles.run} type="button" onClick={inspect}><LuCode size={17}/> Observe transaction <LuArrowUpRight size={17}/></button>
        {error&&<div className={styles.error} role="alert"><LuCircleAlert size={16}/>{error}</div>}
        <div className={styles.private}><LuLockKeyhole size={16}/> No RPC network call, wallet connection or upload occurs. Raw transaction IDs, hashes, and contents are excluded from the report.</div>
      </section>
      <section className={styles.panel} aria-labelledby="transaction-report-heading" aria-live="polite">
        <div className={styles.panelHead}><h2 id="transaction-report-heading">02 / Observation report</h2><span>REDACTED / V1</span></div>
        {!result?<div className={styles.empty}><LuGitBranch size={38}/><h3>Review one node&apos;s evidence.</h3><p>Load synthetic responses or paste public RPC result objects. Re-observe after the block changes to check for possible reorganizations.</p></div>:<>
          <div className={styles.outcome} data-ready={good}>
            {good?<LuCheck size={23}/>:<LuCircleAlert size={23}/>}
            <div><strong>{result.observation.state.replaceAll('_',' ').toUpperCase()}</strong>
              <p>{good?'The chosen node reports the requested confirmation threshold; independent payment verification is still required.':'Not enough consistent evidence to meet the chosen confirmation threshold.'}</p>
            </div>
          </div>
          {result.possible_reorg && <div className={styles.error} role="alert"><LuCircleAlert size={17}/> Possible chain reorganization: independently verify the canonical chain.</div>}
          <div className={styles.metrics}>
            <div><span>NETWORK</span><strong>{result.observation.network??'Unknown'}</strong></div>
            <div><span>CONFIRMATIONS</span><strong>{result.observation.confirmations??'Unknown'}</strong></div>
            <div><span>CHAIN HEIGHT</span><strong>{result.observation.chain_height??'Unknown'}</strong></div>
            <div><span>TX HEIGHT</span><strong>{result.observation.transaction_height??'Unknown'}</strong></div>
          </div>
          <div className={styles.checks}>{result.observation.checks.map(check=><div key={check.code}>
            <span>{check.code.replaceAll('_',' ')}</span>
            <strong data-status={check.status}>{check.status==='pass'?'PASSED':check.status==='fail'?'NOT MET':'UNKNOWN'}</strong>
          </div>)}</div>
          <p className={styles.caveat}>{result.observation.limitation}</p>
        </>}
        <Link className={styles.apiLink} href="/docs/transaction-observations">Use transaction observations in your backend <LuArrowUpRight size={17}/></Link>
      </section>
    </div>
  </main>
}
