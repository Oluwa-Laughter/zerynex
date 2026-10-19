#!/usr/bin/env node
/**
 * Explicit local-file refund metadata audit for Node.js consumers.
 * No directory scans, networking, RPC, agents, keys or raw-data logging.
 */
import {open,lstat} from 'node:fs/promises'
import {constants} from 'node:fs'
import {parse,resolve,join} from 'node:path'
import {auditRefundPrivacyJson,compareRefundPrivacyJson,refundSarifReport} from '../dist/index.js'
const LIMIT=64*1024

function args(argv){
  const values={}
  for(let i=0;i<argv.length;i++){
    const key=argv[i]
    if(key==='--help'&&argv.length===1)return {help:true}
    if(!['--manifest','--baseline','--json','--sarif'].includes(key)||key in values)throw Error('bad args')
    if(key==='--json'||key==='--sarif') values[key]=true
    else{
      if(++i>=argv.length||argv[i].startsWith('--'))throw Error('missing arg')
      values[key]=argv[i]
    }
  }
  if(!values['--manifest']||(values['--json']&&values['--sarif']))throw Error('missing manifest')
  return values
}

async function readStrictFile(path){
  if(typeof path!=='string'||!path||path.includes('\0'))throw Error('path')
  const absolute=resolve(path)
  // Reject symlink ancestors as well as leaf symlinks; caller-selected only.
  const root=parse(absolute).root
  let current=root
  for(const segment of absolute.slice(root.length).split(/[\\/]/)){
    if(!segment)continue
    current=join(current,segment)
    const meta=await lstat(current)
    if(meta.isSymbolicLink())throw Error('symlink')
  }
  const handle=await open(absolute,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0))
  try{
    const metadata=await handle.stat()
    if(!metadata.isFile()||metadata.size<=0||metadata.size>LIMIT)throw Error('size')
    // Fixed maximum read, even if the file changes while it is being read.
    const data=Buffer.alloc(LIMIT+1)
    let size=0
    while(size<data.length){
      const {bytesRead}=await handle.read(data,size,data.length-size,size)
      if(!bytesRead)break
      size+=bytesRead
    }
    if(size<1||size>LIMIT)throw Error('size')
    return new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(0,size))
  }finally{await handle.close()}
}

async function main(){
  try{
    const options=args(process.argv.slice(2))
    if(options.help){
      process.stdout.write('zerynex-refund-check --manifest public-safe.json [--baseline before.json] [--json | --sarif]\nExit 0: no declared issues/new regressions, 2: findings, 1: invalid input. No wallet data.\n')
      return
    }
    const manifest=await readStrictFile(options['--manifest'])
    let report
    if(options['--baseline']){
      const baseline=await readStrictFile(options['--baseline'])
      const [beforeInfo,afterInfo]=await Promise.all([lstat(resolve(options['--baseline'])),lstat(resolve(options['--manifest']))])
      if(beforeInfo.dev===afterInfo.dev&&beforeInfo.ino===afterInfo.ino)throw Error('same file')
      report=compareRefundPrivacyJson(baseline,manifest)
    }else report=auditRefundPrivacyJson(manifest)
    const output=options['--sarif']?refundSarifReport(report):report
    process.stdout.write(JSON.stringify(output,null,2)+'\n')
    process.exitCode=report.passed?0:2
  }catch{
    process.stderr.write('Refund privacy audit rejected invalid local metadata or arguments; no input content was printed.\n')
    process.exitCode=1
  }
}
await main()
