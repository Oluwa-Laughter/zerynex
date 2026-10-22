import test from 'node:test'
import assert from 'node:assert/strict'
import { smokeWeb, validatedOrigin } from './smoke-public-web.mjs'

test('public smoke only accepts a trusted public or loopback origin', () => {
  assert.equal(validatedOrigin('https://zerynex.vercel.app'), 'https://zerynex.vercel.app')
  assert.equal(validatedOrigin('http://127.0.0.1:3100'), 'http://127.0.0.1:3100')
  for(const unsafe of ['http://other.example','https://example.com','file:///etc/passwd',
    'https://zerynex.vercel.app@evil.example','https://zerynex.vercel.app/path',
    'https://zerynex.vercel.app?token=test']) assert.throws(()=>validatedOrigin(unsafe))
})

const wasm=new Uint8Array([0,97,115,109,1,0,0,0])
function mockFetch(url, options) {
  const urlObj=new URL(url)
  const binary=urlObj.pathname.endsWith('.wasm')
  const data=binary?wasm:new TextEncoder().encode(urlObj.pathname.includes('developer-verification')
    ? 'Verify an external integration':urlObj.pathname.includes('lightwalletd') ? 'lightwalletd' : 'Zerynex')
  return Promise.resolve(new Response(data,{status:200,headers:{'content-type':binary?'application/wasm':'text/html; charset=utf-8'}}))
}
test('public smoke validates eight routes, HTML and genuine WASM header', async()=>{
  const checked=await smokeWeb('https://zerynex.vercel.app',mockFetch)
  assert.equal(checked.length,8)
  assert.ok(checked.includes('/wasm/zerynex_bg.wasm'))
  assert.ok(checked.includes('/tools/lightwalletd'))
})
test('public smoke fails closed on wrong MIME, missing route, bad engine bytes',async()=>{
  await assert.rejects(smokeWeb('https://zerynex.vercel.app',async(url,options)=>{
    if(url.endsWith('/wasm/zerynex_bg.wasm'))return new Response('invalid',{headers:{'content-type':'application/wasm'}})
    return mockFetch(url,options)
  }),/Invalid Rust\/WASM delivery/)
  await assert.rejects(smokeWeb('https://zerynex.vercel.app',async(url,options)=>{
    if(url.endsWith('/docs/quickstart'))return new Response('not found',{status:404})
    return mockFetch(url,options)
  }),/non-200/)
  await assert.rejects(smokeWeb('https://zerynex.vercel.app',async(url,options)=>{
    if(url.endsWith('/'))return new Response('Zerynex',{headers:{'content-type':'application/json'}})
    return mockFetch(url,options)
  }),/content type/)
})
