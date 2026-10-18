import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const source = join(root, 'apps/web/src/wasm')
const dest = resolve(here, '../dist/wasm')
const files = ['zerynex.js', 'zerynex.d.ts', 'zerynex_bg.wasm', 'zerynex_bg.wasm.d.ts']
await mkdir(dest, { recursive: true })
for (const file of files) {
  const src = join(source, file)
  if ((await stat(src)).size === 0) throw new Error('Empty Rust/WASM package asset: ' + file)
  await copyFile(src, join(dest, file))
}
const runtime = await readFile(join(dest, 'zerynex.js'), 'utf8')
for (const expected of ['export function analyze_pczt_policy', 'export function compare_pczt_stages', 'export function inspect_zip321_request']) {
  if (!runtime.includes(expected)) throw new Error('Rust/WASM API mismatch: ' + expected)
}
const wasm = await readFile(join(dest, 'zerynex_bg.wasm'))
if (wasm.length < 8 || Buffer.compare(wasm.subarray(0, 4), Buffer.from([0, 97, 115, 109])) !== 0)
  throw new Error('Packaged runtime does not contain a valid WASM binary header')
await copyFile(join(root, 'LICENSE'), resolve(here, '../LICENSE'))
console.log('Prepared self-contained local Rust/WASM SDK assets:', wasm.length, 'bytes')
