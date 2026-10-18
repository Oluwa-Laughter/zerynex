#!/usr/bin/env node
/**
 * Verify the actual npm tarball in a temporary, unrelated application.
 * No monorepo aliases, mock engine, or network. Synthetic test vectors only.
 */
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sdk = join(repo, 'packages/sdk')
const working = await mkdtemp(join(tmpdir(), 'zerynex-sdk-consumer-'))
try {
  const artifacts = join(working, 'artifacts')
  const app = join(working, 'unrelated-project')
  await mkdir(artifacts, { recursive: true })
  await mkdir(app, { recursive: true })
  execFileSync('npm', ['pack', '--pack-destination', artifacts, '--ignore-scripts', '--silent'], {
    cwd: sdk, stdio: 'pipe', timeout: 45_000,
  })
  const packages = (await readdir(artifacts)).filter(name => name.endsWith('.tgz'))
  if (packages.length !== 1) throw new Error('Expected one distributable SDK archive.')
  const archive = join(artifacts, packages[0])
  await writeFile(join(app, 'package.json'), JSON.stringify({
    name: 'independent-zcash-consumer', type: 'module', private: true,
  }, null, 2))
  execFileSync('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
    archive], { cwd: app, stdio: 'pipe', timeout: 60_000 })
  for (const filename of ['clean-v6.bin', 'transparent-v6.bin', 'flagged-v6.bin'])
    await copyFile(join(repo, 'apps/web/public/examples', filename), join(app, filename))
  const vectors = join(repo, 'tests/fixtures/rules')
  const vectorFiles = (await readdir(vectors)).filter(name => name.endsWith('.bin'))
  if (vectorFiles.length !== 8) throw new Error('Rule conformance fixtures are incomplete.')
  for (const name of vectorFiles) await copyFile(join(vectors, name), join(app, name))
  await copyFile(join(vectors, 'expectations.json'), join(app, 'rule-expectations.json'))
  await copyFile(join(repo, 'tests/fixtures/node/chain-readiness.json'), join(app, 'node-readiness.json'))
  await copyFile(join(repo, 'tests/fixtures/transactions/rpc-observations.json'), join(app, 'transaction-observations.json'))
  await copyFile(join(repo, 'scripts/fixtures/sdk-consumer.mjs'), join(app, 'check.mjs'))
  const output = execFileSync(process.execPath, ['check.mjs'], {
    cwd: app, encoding: 'utf8', timeout: 30_000,
  })
  process.stdout.write(output)
  console.log('Package installed exclusively from local tarball:', packages[0])
  console.log('Package size in bytes:', (await readFile(archive)).byteLength)
} finally {
  if (process.env.ZERYNEX_KEEP_CONSUMER !== '1')
    await rm(working, { recursive: true, force: true })
}
