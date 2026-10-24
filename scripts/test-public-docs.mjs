#!/usr/bin/env node
// Guard the boundary between published API docs and internal repository notes.
import { readFile, access, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(await readFile(path.join(root, 'docs/catalog.json'), 'utf8'))
const groups = ['Start here', 'Core concepts', 'SDKs & APIs', 'Automation', 'Reference']
const privateSlugs = [
  'documentation-workflow', 'deployment', 'product-experience',
  'responsive-design', 'ecosystem-research-2026-10',
  'ecosystem-integration-roadmap', 'integration-contracts',
  'sdk-distribution', 'package-managers',
]
const mandatory = ['quickstart', 'installation', 'project-integration', 'cli-reference', 'rust-api', 'typescript-api',
  'python-api', 'report-reference', 'rule-registry', 'sarif', 'node-readiness', 'transaction-observations', 'payment-requests', 'wallet-handoffs', 'refund-privacy-audit', 'zcash-app-recipes', 'github-action', 'agents', 'privacy-model']
if (catalog.version !== 1 || !Array.isArray(catalog.entries)) throw Error('Invalid docs catalog')
const publicSlugs = new Set()
// Registry administration is not a developer-facing documentation route.
if (catalog.entries.some(entry => entry.slug === 'publishing'))
  throw Error('Publishing administration must not appear in developer docs')
let lastGroup = -1
for (const guide of catalog.entries) {
  const groupIndex = groups.indexOf(guide.group)
  if (groupIndex < 0 || groupIndex < lastGroup) throw Error('Public guide group is invalid or out of order')
  lastGroup = groupIndex
  if (guide.status === 'research') throw Error('Research documents must stay in the repository')
  if (guide.slug.toLowerCase().includes('readme') || privateSlugs.includes(guide.slug))
    throw Error('Internal material cannot be published in developer docs: ' + guide.slug)
  if (publicSlugs.has(guide.slug)) throw Error('Duplicate public guide')
  publicSlugs.add(guide.slug)
  await access(path.join(root, 'docs', guide.slug + '.md'))
  await access(path.join(root, 'apps/web/content/docs', guide.slug + '.md'))
}
for (const slug of mandatory) if (!publicSlugs.has(slug)) throw Error('Missing public API or onboarding guide: ' + slug)
for (const slug of privateSlugs) {
  // Internal source is preserved for maintainers but excluded from deployment.
  await access(path.join(root, 'docs', slug + '.md'))
  if (publicSlugs.has(slug)) throw Error('Private source accidentally published')
}
const output = await readdir(path.join(root, 'apps/web/content/docs'))
const markdown = output.filter(name => name.endsWith('.md')).map(name => name.slice(0, -3))
if (markdown.length !== publicSlugs.size || markdown.some(slug => !publicSlugs.has(slug)))
  throw Error('Generated content includes an internal or missing public guide')
console.log('Validated curated public docs:', publicSlugs.size, 'guides;', privateSlugs.length, 'internal notes excluded')

// Ensure the public identity remains a reusable Zcash ecosystem product.
const forbiddenBranding = ['zec' + 'athon', 'hack' + 'athon']
const tracked = execFileSync('git', ['ls-files', '-z'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean)
for (const file of tracked) {
  if (!/\.(?:md|mdx|rst|txt|tsx|ts|jsx|js|py|rs|json|ya?ml|toml|html|css)$/.test(file)) continue
  const source = await readFile(path.join(root, file), 'utf8')
  if (forbiddenBranding.some(term => source.toLowerCase().includes(term)))
    throw Error('Event-specific terminology in Zcash developer product source: ' + file)
}
console.log('Product-positioning guard checked', tracked.length, 'tracked paths')
