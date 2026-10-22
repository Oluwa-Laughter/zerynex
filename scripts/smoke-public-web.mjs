#!/usr/bin/env node
/** Read-only, public-asset deployment smoke; never sends wallet/PCZT contents. */
import { pathToFileURL } from 'node:url'

const checks = [
  {path:'/', marker:'Zerynex'},
  {path:'/docs', marker:'Zerynex'},
  {path:'/docs/quickstart', marker:'Zerynex'},
  {path:'/docs/developer-verification', marker:'Verify an external integration'},
  {path:'/tools', marker:'Zerynex'},
  {path:'/tools/refund', marker:'Zerynex'},
  {path:'/tools/lightwalletd', marker:'lightwalletd'},
  {path:'/wasm/zerynex_bg.wasm', wasm:true},
]

export function validatedOrigin(value) {
  let url
  try { url = new URL(value) } catch { throw Error('Invalid site origin') }
  const local = (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  if (!(url.protocol === 'https:' || (local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && !url.hostname.endsWith('.vercel.app'))) {
    throw Error('Use an HTTPS *.vercel.app origin or a loopback development origin, without credentials')
  }
  return url.origin
}

/** Public document and WASM delivery, not actual client-side execution. */
export async function smokeWeb(origin, fetcher=fetch) {
  const base = validatedOrigin(origin)
  const results = []
  for(const {path,marker,wasm} of checks) {
    let response
    try {
      response = await fetcher(base+path, {signal:AbortSignal.timeout(15000), redirect:'error',
        headers:{'Accept':wasm?'application/wasm':'text/html'}})
    } catch { throw Error(`Public smoke request failed: ${path}`) }
    if(response.status!==200 || !response.ok) {
      await response.body?.cancel?.().catch?.(()=>{})
      throw Error(`Public smoke returned non-200: ${path}`)
    }
    const expectedType = wasm ? 'application/wasm' : 'text/html'
    if(!(response.headers.get('content-type')||'').toLowerCase().startsWith(expectedType)) {
      await response.body?.cancel?.().catch?.(()=>{})
      throw Error(`Incorrect public asset content type: ${path}`)
    }
    const limit = wasm ? 15*1024*1024 : 3*1024*1024
    const declaredSize = Number(response.headers.get('content-length')||0)
    if(declaredSize>limit) throw Error(`Public response exceeds size limit: ${path}`)
    // Bound actual streamed bytes even when servers omit Content-Length.
    let bytes=0
    const chunks=[]
    if(!response.body) throw Error(`Public response has no body: ${path}`)
    const reader=response.body.getReader()
    try {
      for(;;) {
        const {value,done}=await reader.read()
        if(done)break
        bytes+=value.byteLength
        if(bytes>limit)throw Error(`Public response exceeds size limit: ${path}`)
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const output=new Uint8Array(bytes)
    let offset=0
    for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength}
    if(wasm) {
      if(output.length<8 || output[0]!==0 || output[1]!==97 || output[2]!==115 || output[3]!==109)
        throw Error(`Invalid Rust/WASM delivery: ${path}`)
    } else if(!new TextDecoder().decode(output).toLowerCase().includes(marker.toLowerCase())) {
      throw Error(`Missing public document marker: ${path}`)
    }
    results.push(path)
  }
  return results
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const origin = process.argv[2] ?? 'https://zerynex.vercel.app'
    const routes = await smokeWeb(origin)
    console.log(`Public Zerynex smoke PASS (${routes.length} routes and WASM): ${validatedOrigin(origin)}`)
  } catch(e) {
    console.error(e instanceof Error?e.message:'Public smoke rejected')
    process.exitCode=1
  }
}
