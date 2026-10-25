#!/usr/bin/env node
/**
 * Opt-in public-release consumer verification against the actual registries.
 * Uses only checked-in, nonspendable fixtures. No developer secrets required.
 * Usage: node scripts/smoke-published.mjs [0.2.0]
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2] || '0.2.0'
if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version))
  throw new Error('Specify a released semver, e.g. 0.2.0')
const work = await mkdtemp(join(tmpdir(), 'zerynex-public-smoke-'))
const python = process.env.PYTHON || (process.platform === 'win32' ? 'py' : 'python3')
const run = (command, args, timeout = 90_000) =>
  execFileSync(command, args, { cwd: work, timeout, encoding: 'utf8' })

try {
  await writeFile(join(work, 'package.json'), '{"name":"zerynex-public-smoke","private":true,"type":"module"}\n')
  for (const filename of ['clean-v6.bin', 'transparent-v6.bin'])
    await copyFile(join(source, 'apps/web/public/examples', filename), join(work, filename))
  for (const filename of ['isolated.json', 'risky.json'])
    await copyFile(join(source, 'tests/fixtures/swap-refund', filename), join(work, filename))

  console.log('Checking @zerynex/sdk@' + version + ' from public npm')
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact',
    '@zerynex/sdk@' + version], 120_000)
  const consumer = [
    "import {readFileSync} from 'node:fs'",
    "import {createRequire} from 'node:module'",
    "import {createBrowserZerynexClient} from '@zerynex/sdk/browser'",
    "const req=createRequire(import.meta.url)",
    "const wasm=readFileSync(req.resolve('@zerynex/sdk/wasm/zerynex_bg.wasm'))",
    "const client=createBrowserZerynexClient({wasm})",
    "await client.ready()",
    "const clean=await client.analyzeBytes(readFileSync('clean-v6.bin'),{deny_transparent:true})",
    "const flagged=await client.analyzeBytes(readFileSync('transparent-v6.bin'),{deny_transparent:true})",
    "if(clean.findings.length || !flagged.findings.some(f=>f.rule==='PCZT-TRANSPARENT-OUTPUTS'))",
    "  throw Error('Published Rust/WASM did not match reviewed PCZT expectations')",
    "console.log('PASS published npm Rust/WASM policy checks')",
    "",
  ].join('\n')
  await writeFile(join(work, 'check.mjs'), consumer)
  process.stdout.write(run(process.execPath, ['check.mjs']))
  const executable = join(work, 'node_modules', '.bin',
    process.platform === 'win32' ? 'zerynex-refund-check.cmd' : 'zerynex-refund-check')
  const checkRefund = file => spawnSync(executable, ['--manifest', file, '--json'],
    { cwd: work, encoding: 'utf8', timeout: 20_000 })
  const safe = checkRefund('isolated.json')
  const risky = checkRefund('risky.json')
  if (safe.status !== 0 || JSON.parse(safe.stdout).passed !== true ||
      risky.status !== 2 || JSON.parse(risky.stdout).finding_count !== 5)
    throw Error('Public npm CLI entry point, output or exit status failed')
  console.log('PASS npm-installed refund CLI (clean + expected policy finding)')

  console.log('Checking zerynex-python==' + version + ' from public PyPI')
  const venv = join(work, '.venv')
  run(python, ['-m', 'venv', venv])
  const pythonBin = join(venv, process.platform === 'win32' ? 'Scripts' : 'bin',
    process.platform === 'win32' ? 'python.exe' : 'python')
  run(pythonBin, ['-m', 'pip', 'install', '--no-input', '--disable-pip-version-check',
    'zerynex-python==' + version], 120_000)
  process.stdout.write(run(pythonBin, ['-c',
    'from importlib.metadata import version; from zerynex_py import ZerynexClient,Policy;'
    + ' assert version("zerynex-python")=="' + version
    + '"; print("PASS published PyPI wheel and Python imports")']))
  const cli = process.env.ZERYNEX_CLI || join(source, 'target', 'release',
    process.platform === 'win32' ? 'zerynex.exe' : 'zerynex')
  const native = spawnSync(cli, ['--version'], { cwd: work, encoding: 'utf8', timeout: 10_000 })
  if (native.status === 0) {
    const pySmoke = [
      'from zerynex_py import ZerynexClient, Policy',
      'client = ZerynexClient(cli=' + JSON.stringify(cli) + ')',
      "clean = client.analyze_file('clean-v6.bin', Policy(deny_transparent=True))",
      "flagged = client.analyze_file('transparent-v6.bin', Policy(deny_transparent=True))",
      'assert len(clean.findings) == 0',
      "assert any(f.rule == 'PCZT-TRANSPARENT-OUTPUTS' for f in flagged.findings)",
      "print('PASS published Python package invoking trusted Rust CLI')",
    ].join('\n')
    await writeFile(join(work, 'check.py'), pySmoke)
    process.stdout.write(run(pythonBin, ['check.py']))
  } else {
    console.log('SKIP Python → Rust check (set ZERYNEX_CLI to an installed trusted binary)')
  }

  console.log('Checking public Go module v' + version)
  const url = 'https://proxy.golang.org/github.com/!oluwa-!laughter/zerynex/packages/go/@v/v' + version + '.info'
  const metadata = JSON.parse(run('curl',
    ['--fail', '--silent', '--show-error', '--location', '--max-time', '20', url], 30_000))
  if (metadata.Version !== 'v' + version || metadata.Origin?.Subdir !== 'packages/go')
    throw Error('Go module proxy returned unexpected version or module path')
  console.log('PASS Go module proxy ' + metadata.Version + ' ' + metadata.Origin.Ref)
  console.log('PUBLIC RELEASE CONSUMER SMOKE PASS: ' + version)
} finally {
  await rm(work, { recursive: true, force: true })
}
