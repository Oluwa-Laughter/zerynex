#!/usr/bin/env node
/**
 * Vercel builds apps/web from the checked-in TypeScript SDK source alias.
 * Unlike an npm tarball build, Vercel does not first compile packages/sdk.
 * Catch missing generated .js mirrors before running the expensive Next build.
 * Offline, dependency-free and safe in deployment environments.
 */
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'packages/sdk/src')
const config = await readFile(resolve(root, 'apps/web/tsconfig.json'), 'utf8')
const paths = JSON.parse(config).compilerOptions.paths
assert.deepEqual(paths['@zerynex/sdk'], ['../../packages/sdk/src/index.ts'],
  'Review the Next.js SDK resolution contract before changing the source-mirror gate')

// Turbopack sees TypeScript index.ts, but its .js imports must exist in Git.
const pending = ['index.ts']
const checked = new Set()
while (pending.length) {
  const name = pending.pop()
  if (!name || checked.has(name)) continue
  checked.add(name)
  const contents = await readFile(resolve(src, name), 'utf8')
  const imports = contents.matchAll(/(?:from\s*|import\s*\(|export\s*\*\s*from\s*)['"](\.\/[^'"]+\.js)['"]/g)
  for (const [, specifier] of imports) {
    const moduleName = specifier.slice(2)
    // Local modules are always JS mirrors unless explicitly generated WASM.
    await access(resolve(src, moduleName)).catch(() => {
      throw Error(`Missing checked-in SDK source import: ${moduleName}. Run source mirror sync.`)
    })
    pending.push(moduleName)
  }
}

// Vercel's runtime import path must enforce the same strict JSON policy as npm.
const { parseRefundPrivacyJson } = await import('../packages/sdk/src/refund-json.js')
assert.throws(() => parseRefundPrivacyJson('{"schema_version":1,"schema_version":1,"flows":[]}'),
  TypeError, 'Ambiguous JSON must be rejected from source-level JS')
assert.throws(() => parseRefundPrivacyJson('{"schema_version":1,"\\u0073chema_version":1,"flows":[]}'),
  TypeError, 'Unicode-equivalent duplicate keys must fail in source-level JS')
const valid = await readFile(resolve(root, 'examples/consumer-integration/fixtures/isolated.json'), 'utf8')
assert.equal(parseRefundPrivacyJson(valid).schema_version, 1)
console.log(`Vercel SDK source import gate passed (${checked.size} local modules, strict policy parity)`)
