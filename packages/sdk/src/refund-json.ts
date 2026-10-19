/**
 * Strict bounded raw JSON ingestion for Zcash refund-privacy metadata.
 * Unlike JSON.parse alone, this rejects repeated decoded object keys before
 * the data is used. This runs locally; no raw input is ever returned in errors.
 */
import {auditRefundPrivacy,compareRefundPrivacy,type RefundAuditReport,type RefundManifest,type RefundRegressionReport} from './refund-privacy.js'

const MAX_BYTES=64*1024
const MAX_DEPTH=12
const SPACE=/[\x20\t\r\n]/
const STRING_ESCAPES=/^["\\/bfnrt]$/

export function parseRefundPrivacyJson(raw: string): RefundManifest {
  if (typeof raw !== 'string' || !raw || new TextEncoder().encode(raw).byteLength>MAX_BYTES)
    throw new TypeError('Refund metadata must be a nonempty JSON document under 64 KiB')
  let i=0
  const fail=():never=>{throw new TypeError('Invalid or ambiguous refund JSON metadata')}
  function space(){while(i<raw.length&&SPACE.test(raw[i]!))i++}
  function token(){
    if(raw[i]!== '"')fail()
    const start=i++
    while(i<raw.length){
      const ch=raw[i++]!
      if(ch==='"'){
        try{return JSON.parse(raw.slice(start,i)) as string}catch{return fail()}
      }
      if(ch==='\\'){
        if(i>=raw.length)fail()
        const escape=raw[i++]!
        if(escape==='u'){
          for(let j=0;j<4;j++){
            if(i>=raw.length||!/[0-9a-fA-F]/.test(raw[i++]!))fail()
          }
        }else if(!STRING_ESCAPES.test(escape))fail()
      }else if(ch.charCodeAt(0)<0x20)fail()
    }
    return fail()
  }
  function value(depth:number):void{
    if(depth>MAX_DEPTH)fail()
    space()
    if(raw[i]==='{'){
      i++;space()
      const keys=new Set<string>()
      if(raw[i]==='}'){i++;return}
      for(;;){
        space()
        const key=token()
        if(keys.has(key))fail()
        keys.add(key)
        space()
        if(raw[i++]!==':')fail()
        value(depth+1)
        space()
        const end=raw[i++]
        if(end==='}')return
        if(end!==',')fail()
      }
    }
    if(raw[i]==='['){
      i++;space()
      if(raw[i]===']'){i++;return}
      for(;;){
        value(depth+1);space()
        const end=raw[i++]
        if(end===']')return
        if(end!==',')fail()
      }
    }
    if(raw[i]==='"'){token();return}
    const match=/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(raw.slice(i))
    if(!match)return fail()
    i+=match[0].length
  }
  try{
    space();value(0);space()
    if(i!==raw.length)fail()
    const decoded:unknown=JSON.parse(raw)
    // Shared schema validation also rejects extra fields, invalid tokens and
    // more than 100 flows. Return the caller's validated data, not a report.
    auditRefundPrivacy(decoded)
    return decoded as RefundManifest
  }catch{
    return fail()
  }
}

/** Parse strict raw JSON, then return only redacted findings. */
export function auditRefundPrivacyJson(raw:string):RefundAuditReport {
  return auditRefundPrivacy(parseRefundPrivacyJson(raw))
}

/** Compare strict raw JSON files without revealing flow references. */
export function compareRefundPrivacyJson(previous:string,current:string):RefundRegressionReport {
  return compareRefundPrivacy(parseRefundPrivacyJson(previous),parseRefundPrivacyJson(current))
}
