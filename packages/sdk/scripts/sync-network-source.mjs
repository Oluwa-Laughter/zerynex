#!/usr/bin/env node
// Keep Next.js/Vercel source imports and published npm builds synchronized.
// Next resolves './*.js' references from TypeScript entry points using these
// checked-in JavaScript mirrors, even without a monorepo SDK compile step.
import ts from 'typescript'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..')
for(const moduleName of ['network','wallet-handoff','transaction']){
  const source=await readFile(resolve(root,`src/${moduleName}.ts`),'utf8')
  const js=`// GENERATED from ${moduleName}.ts by scripts/sync-network-source.mjs; do not edit.\n`+
    ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText
  const target=resolve(root,`src/${moduleName}.js`)
  if(process.argv.includes('--check')){
    const existing=await readFile(target,'utf8').catch(()=>undefined)
    if(existing!==js)throw Error(`Zcash SDK source mirror ${moduleName}.js is out of sync with TypeScript`)
  }else await writeFile(target,js)
}
console.log('Zcash SDK source-level JavaScript mirrors synchronized (3 modules)')
