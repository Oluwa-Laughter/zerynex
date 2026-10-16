#!/usr/bin/env node
// docs/ is authoritative; build a self-contained, static Next content bundle.
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docs = path.join(root, 'docs')
const out = path.join(root, 'apps/web/content/docs')
const data = JSON.parse(await readFile(path.join(docs, 'catalog.json'), 'utf8'))
if (data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 100)
  throw Error('Unsupported documentation catalog')
const seen = new Set()
await mkdir(out, { recursive: true })
for (const entry of data.entries) {
  if (!/^[a-z0-9][a-z0-9-]{1,70}$/.test(entry.slug) || seen.has(entry.slug))
    throw Error('Invalid or duplicate doc slug')
  seen.add(entry.slug)
  for (const field of ['title', 'summary', 'audience', 'group', 'status']) {
    if (typeof entry[field] !== 'string' || !entry[field] || entry[field].length > 300)
      throw Error('Invalid docs catalog metadata')
  }
  if (!['supported', 'partial', 'preview', 'research'].includes(entry.status))
    throw Error('Invalid docs status')
  const content = await readFile(path.join(docs, entry.slug + '.md'), 'utf8')
  if (!content.trim().startsWith('# ')) throw Error('Markdown needs a title heading')
  await writeFile(path.join(out, entry.slug + '.md'), content)
}
await writeFile(path.join(out, 'index.json'), JSON.stringify(data, null, 2) + '\n')
for (const existing of await readdir(out)) {
  if (existing.endsWith('.md') && !seen.has(existing.slice(0, -3)))
    await unlink(path.join(out, existing))
}
console.log('Synced', seen.size, 'docs to Next static content')
