#!/usr/bin/env node
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(await readFile(path.join(root, 'docs/catalog.json'), 'utf8'))
const generated = JSON.parse(await readFile(path.join(root, 'apps/web/content/docs/index.json'), 'utf8'))
if (JSON.stringify(catalog) !== JSON.stringify(generated)) throw Error('Documentation index is stale')
const slugs = new Set(catalog.entries.map(entry => entry.slug))
let references = 0
for (const entry of catalog.entries) {
  const canonical = await readFile(path.join(root, 'docs', entry.slug + '.md'), 'utf8')
  const mirror = await readFile(path.join(root, 'apps/web/content/docs', entry.slug + '.md'), 'utf8')
  if (canonical !== mirror) throw Error('Stale documentation mirror: ' + entry.slug)
  if (!canonical.startsWith('# ')) throw Error('Missing guide heading: ' + entry.slug)
  // Validate relative Markdown file links, while leaving external upstream
  // references and repository URLs intact.
  for (const match of canonical.matchAll(/\]\(([^)]+\.md)(?:#[\w-]+)?\)/g)) {
    let target = match[1]
    if (/^https?:\/\//.test(target)) continue
    if (target.startsWith('docs/')) target = target.slice(5)
    if (target.startsWith('./')) target = target.slice(2)
    if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(target) || !slugs.has(target.slice(0,-3))) {
      throw Error('Unknown canonical guide link in ' + entry.slug)
    }
    references += 1
  }
}
console.log('Validated', catalog.entries.length, 'guides and', references, 'internal Markdown links.')
