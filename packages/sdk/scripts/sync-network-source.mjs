#!/usr/bin/env node
// Ensure direct-source Next.js/Vercel and published npm builds use identical code.
import ts from 'typescript'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source=await readFile(resolve(root,'src/network.ts'),'utf8')
const js='// GENERATED from network.ts by scripts/sync-network-source.mjs; do not edit.\n'+
  ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText
const target=resolve(root,'src/network.js')
if(process.argv.includes('--check')) {
  const existing=await readFile(target,'utf8').catch(()=>undefined)
  if(existing!==js)throw Error('Zcash node adapter JS source is out of sync with TypeScript')
  console.log('Zcash node adapter source synchronized')
} else {
  await writeFile(target,js)
  console.log('Generated source-level JS for Zcash node adapter')
}
