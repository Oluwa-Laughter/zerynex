#!/usr/bin/env node
/**
 * Real-browser smoke for the deployed product and its user-facing developer path.
 * Uses public, nonspendable synthetic fixtures only. Does not upload local files.
 *
 * pnpm verify:live
 * pnpm verify:live --capture-dir /tmp/zerynex-capture
 */
import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
let captureDir
let origin = 'https://zerynex.vercel.app'
for (let index = 0; index < args.length; index++) {
  const arg = args[index]
  if (arg === '--capture-dir' && args[index + 1]) {
    captureDir = resolve(args[++index])
  } else if (arg === '--origin' && args[index + 1]) {
    origin = args[++index]
  } else {
    throw new Error('Usage: pnpm verify:live [--origin https://<deployment>.vercel.app] [--capture-dir /tmp/zerynex-capture]')
  }
}

const parsed = new URL(origin)
if (parsed.protocol !== 'https:' ||
    parsed.username || parsed.password || parsed.search || parsed.hash ||
    parsed.pathname !== '/' || !(
      parsed.hostname === 'zerynex.vercel.app' ||
      /^zerynex-[a-z0-9-]+\.(?:vercel\.app)$/.test(parsed.hostname)
    )) throw new Error('Only the HTTPS Zerynex production domain or a Zerynex Vercel deployment is allowed')
origin = parsed.origin
if (captureDir) await mkdir(captureDir, { recursive: true })

const chrome = process.platform === 'linux' && existsSync('/usr/bin/google-chrome')
  ? { executablePath: '/usr/bin/google-chrome' } : {}
const browser = await chromium.launch({ headless: true, ...chrome })
let checks = 0

async function verify(page, name, action) {
  await action()
  checks += 1
  console.log('PASS', name)
}
async function screenshot(page, name) {
  if (!captureDir) return
  const file = join(captureDir, name + '.png')
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled' })
  console.log('CAPTURE', file)
}
async function navigate(page, path) {
  const response = await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 40_000 })
  if (!response || response.status() !== 200) throw new Error('Unexpected status on ' + path)
}
async function text(locator) {
  await locator.waitFor({ state: 'visible', timeout: 18_000 })
}
async function checkWidth(page) {
  const state = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  if (state.scroll > state.client + 2) throw new Error('Horizontal overflow: ' + JSON.stringify(state))
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  page.setDefaultTimeout(18_000)
  const scriptErrors = []
  page.on('pageerror', error => scriptErrors.push(error.message))
  try {
    await verify(page, 'Homepage and actual synthetic Rust/WASM preview', async () => {
      await navigate(page, '/')
      await text(page.getByRole('heading', { name: /Build for Zcash/i }))
      await page.getByRole('button', { name: 'Run synthetic check' }).click()
      await text(page.getByText('PCZT-TRANSPARENT-OUTPUTS'))
      await screenshot(page, '01-homepage-synthetic-preview')
    })
    await verify(page, 'PCZT workbench flags synthetic transparent output', async () => {
      await navigate(page, '/tools')
      await text(page.getByText('RUST ENGINE READY'))
      await page.getByLabel('Deny transparent components').check()
      await page.getByRole('button', { name: /Transparent v6/i }).click()
      await text(page.getByText('transparent-synthetic-v6.pczt'))
      await page.getByRole('button', { name: /RUN PRIVACY ANALYSIS/i }).click()
      await text(page.getByText('PCZT-TRANSPARENT-OUTPUTS'))
      await screenshot(page, '02-privacy-finding')
    })
    await verify(page, 'Clean synthetic PCZT reports a policy pass', async () => {
      await page.getByRole('button', { name: /Clean v6/i }).click()
      await text(page.getByText('clean-synthetic-v6.pczt'))
      await page.getByRole('button', { name: /RUN PRIVACY ANALYSIS/i }).click()
      await text(page.getByText('Policy checks passed'))
      await screenshot(page, '03-clean-policy-result')
    })
    await verify(page, 'Stage regression catches newly introduced metadata', async () => {
      await navigate(page, '/tools/stages')
      await text(page.getByRole('heading', { name: /See what changed/i }))
      await page.getByRole('button', { name: /New metadata/i }).click()
      await text(page.getByText('flagged-synthetic-v6.pczt'))
      await page.getByRole('button', { name: /COMPARE PCZT STAGES/i }).click()
      await text(page.getByText('PCZT-GLOBAL-METADATA'))
      await screenshot(page, '04-stage-regression')
    })
    await verify(page, 'Public quickstart explains synthetic and security boundaries', async () => {
      await navigate(page, '/docs/quickstart')
      await text(page.getByRole('heading', { name: /Quickstart: your first PCZT privacy check/i }))
      await text(page.getByText('does not', { exact: false }).first())
      await screenshot(page, '05-developer-quickstart')
    })
    await verify(page, 'Published TypeScript Python and Go integration paths', async () => {
      await navigate(page, '/ecosystem')
      await text(page.getByText('npm install @zerynex/sdk@0.2.0', { exact: false }))
      await screenshot(page, '06-typescript-sdk')
      await page.getByRole('button', { name: /^Python/ }).click()
      await text(page.getByText('python3 -m pip install zerynex-python==0.2.0', { exact: false }))
      await screenshot(page, '07-python-sdk')
      await page.getByRole('button', { name: /^Go/ }).click()
      await text(page.getByText('go get github.com/Oluwa-Laughter/zerynex/packages/go@v0.2.0', { exact: false }))
      await screenshot(page, '08-go-sdk')
      await checkWidth(page)
    })
    if (scriptErrors.length) throw new Error('JavaScript exceptions: ' + scriptErrors.join('; ').slice(0, 500))
    console.log('PASS no uncaught JavaScript exceptions in desktop flow')
  } finally {
    await page.close()
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
  mobile.setDefaultTimeout(18_000)
  const mobileErrors = []
  mobile.on('pageerror', error => mobileErrors.push(error.message))
  try {
    await verify(mobile, 'Mobile homepage, docs, SDK and workbench fit viewport', async () => {
      const pages = [
        ['/', /Build for Zcash/i],
        ['/docs', /Learn the core|Build with confidence/i],
        ['/ecosystem', /Bring Zcash privacy checks/i],
        ['/tools', /Inspect Zcash transaction privacy/i],
        ['/tools/stages', /See what changed/i],
      ]
      for (const [path, heading] of pages) {
        await navigate(mobile, path)
        await text(mobile.getByRole('heading', { name: heading }).first())
        await checkWidth(mobile)
        console.log('PASS mobile route', path)
      }
      await screenshot(mobile, '09-mobile-stage-comparator')
      await navigate(mobile, '/tools')
      await text(mobile.getByText('RUST ENGINE READY'))
      await screenshot(mobile, '10-mobile-policy-inspector')
    })
    if (mobileErrors.length) throw new Error('Mobile JavaScript exceptions: ' + mobileErrors.join('; ').slice(0, 500))
    console.log('PASS no uncaught JavaScript exceptions in mobile flow')
  } finally {
    await mobile.close()
  }
  console.log('LIVE BROWSER VERIFICATION PASS:', checks, 'end-to-end checks on', origin)
} finally {
  await browser.close()
}
