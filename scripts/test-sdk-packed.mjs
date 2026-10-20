#!/usr/bin/env node
/**
 * Verify the actual npm tarball in a temporary, unrelated application.
 * No monorepo aliases, mock engine, or network. Synthetic test vectors only.
 */
import { execFileSync, spawnSync } from 'node:child_process'
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
  for (const name of ['isolated','risky','regression-expanded'])
    await copyFile(join(repo, 'tests/fixtures/swap-refund', name + '.json'), join(app, 'refund-' + name + '.json'))
  await copyFile(join(repo, 'scripts/fixtures/sdk-consumer.mjs'), join(app, 'check.mjs'))
  const output = execFileSync(process.execPath, ['check.mjs'], {
    cwd: app, encoding: 'utf8', timeout: 30_000,
  })
  process.stdout.write(output)
  // Exercise the installed CLI entry point, not the source checkout.
  const command=join(app,'node_modules','@zerynex','sdk','bin','refund-check.mjs')
  const run=argv=>spawnSync(process.execPath,[command,...argv],{cwd:app,encoding:'utf8',timeout:15000})
  const safe=run(['--manifest','refund-isolated.json','--json'])
  if(safe.status!==0||JSON.parse(safe.stdout).passed!==true)
    throw new Error('Packed Node CLI rejected reviewed isolated metadata')
  const flagged=run(['--manifest','refund-risky.json','--json'])
  if(flagged.status!==2||JSON.parse(flagged.stdout).finding_count!==5)
    throw new Error('Packed Node CLI missed synthetic risks')
  const compared=run(['--baseline','refund-risky.json','--manifest','refund-regression-expanded.json','--sarif'])
  if(compared.status!==2||JSON.parse(compared.stdout).runs[0].results.length!==1)
    throw new Error('Packed Node CLI missed per-flow regression or SARIF output')
  const duplicate=join(app,'invalid-duplicate.json')
  await writeFile(duplicate,'{"schema_version":1,"schema_version":1,"secrets":"NEVER_LOG"}')
  const rejected=run(['--manifest','invalid-duplicate.json','--json'])
  if(rejected.status!==1||/NEVER_LOG|invalid-duplicate.json/.test(rejected.stderr+rejected.stdout))
    throw new Error('Packed Node CLI leaked or accepted duplicate metadata keys')
  console.log('PACKED REFUND CLI PASS: installed Node entry point, raw JSON safety, SARIF and exit statuses')
  // The public third-party Node example must work against the installed
  // archive, not against SDK source/monorepo aliases.
  const externalStarter=join(repo,'examples/consumer-integration')
  const standaloneScript=join(app,'zerynex-starter.mjs')
  await copyFile(join(externalStarter,'node/check.mjs'),standaloneScript)
  const starterRun=(oldName,newName,format='json')=>spawnSync(process.execPath,
    [standaloneScript,join(app,'refund-'+oldName+'.json'),join(app,'refund-'+newName+'.json'),format],
    {cwd:app,encoding:'utf8',timeout:15_000})
  const introduced=starterRun('isolated','risky')
  if(introduced.status!==2||JSON.parse(introduced.stdout).newRiskEvents!==8)
    throw new Error('Independent Node starter missed newly declared privacy risks')
  const resolved=starterRun('risky','isolated')
  if(resolved.status!==0||JSON.parse(resolved.stdout).resolvedRiskEvents!==8)
    throw new Error('Independent Node starter misclassified resolved risks')
  const starterSarif=starterRun('risky','regression-expanded','sarif')
  if(starterSarif.status!==2||JSON.parse(starterSarif.stdout).runs[0].results.length!==1)
    throw new Error('Independent Node starter SARIF output did not match the SDK')
  for(const result of [introduced,resolved,starterSarif])
    if(/11111111111111111111111111111111|22222222222222222222222222222222|refund_address_ref/.test(result.stdout+result.stderr))
      throw new Error('Independent Node starter revealed example flow references')
  console.log('PACKED NODE STARTER PASS: independent application install, regressions and sanitized SARIF')


  console.log('Package installed exclusively from local tarball:', packages[0])
  console.log('Package size in bytes:', (await readFile(archive)).byteLength)
} finally {
  if (process.env.ZERYNEX_KEEP_CONSUMER !== '1')
    await rm(working, { recursive: true, force: true })
}
