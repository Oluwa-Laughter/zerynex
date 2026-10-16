import { test, expect } from '@playwright/test'

test('homepage navigates to Zerynex developer tooling', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Zerynex/)
  await expect(page.getByRole('heading', { name: /privacy is/i })).toBeVisible()
  await page.locator('.topbar').getByRole('button', { name: 'Developer Tools' }).click()
  await expect(page).toHaveURL(/\/tools/)
  await expect(page.getByRole('heading', { name: /Build with privacy/i })).toBeVisible()
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
})

test('real local WebAssembly analysis catches a synthetic disclosure', async ({ page }) => {
  await page.goto('/tools')
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.getByRole('button', { name: /Flagged v6/i }).click()
  await expect(page.getByText('flagged-synthetic-v6.pczt')).toBeVisible()
  await page.getByRole('button', { name: /RUN PRIVACY ANALYSIS/i }).click()
  await expect(page.getByText('1 finding')).toBeVisible()
  await expect(page.getByText('PCZT-GLOBAL-METADATA')).toBeVisible()
  await expect(page.getByText('global.proprietary')).toBeVisible()
})

test('a clean synthetic PCZT passes implemented privacy policies', async ({ page }) => {
  await page.goto('/tools')
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.getByRole('button', { name: /Clean v6/i }).click()
  await page.getByRole('button', { name: /RUN PRIVACY ANALYSIS/i }).click()
  await expect(page.getByText('Policy checks passed')).toBeVisible()
  await expect(page.getByText('PCZT-GLOBAL-METADATA')).toHaveCount(0)
})

test('mobile navigation is accessible and uses icon components', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only navigation check')
  await page.goto('/')
  const menu = page.getByRole('button', { name: 'Open menu' })
  await menu.click()
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(page.getByRole('navigation', {name:'Primary'}).getByRole('link', { name: /Documentation/ })).toBeVisible()
  await page.locator('.topbar').getByRole('button', { name: 'Developer Tools' }).click()
  await expect(page).toHaveURL(/\/tools/)
})

test('privacy invariants are enforced by Rust and exportable as JSON', async ({ page }) => {
  await page.goto('/tools')
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.getByLabel('Deny transparent components').check()
  await page.getByLabel('Deny Sapling components').check()
  await page.getByRole('button', {name:/Clean v6/}).click()
  await page.getByRole('button', {name:/RUN PRIVACY ANALYSIS/}).click()
  await expect(page.getByText('Policy checks passed')).toBeVisible()
  await expect(page.getByText('DENIED', {exact:true})).toHaveCount(2)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', {name:/EXPORT JSON POLICY/}).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('zerynex-policy.json')
})

test('shielded-only privacy policy rejects an actual synthetic transparent output', async ({ page }) => {
  await page.goto('/tools')
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.getByLabel('Deny transparent components').check()
  await page.getByRole('button', { name: /Transparent v6/ }).click()
  await page.getByRole('button', { name: /RUN PRIVACY ANALYSIS/ }).click()
  await expect(page.getByText('PCZT-TRANSPARENT-OUTPUTS')).toBeVisible()
  await expect(page.getByText('transparent.outputs', {exact: true})).toBeVisible()
})

test('locally imports a valid policy file and applies its restrictions', async ({ page }) => {
  await page.goto('/tools')
  await page.getByLabel('Select JSON policy file').setInputFiles({
    name: 'strict-policy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      profile: 'restricted_handoff',
      deny_transparent: true,
      deny_sapling: true,
    })),
  })
  await expect(page.getByRole('status')).toContainText('Policy loaded locally')
  await expect(page.getByLabel('Deny transparent components')).toBeChecked()
  await expect(page.getByLabel('Deny Sapling components')).toBeChecked()
  await page.getByRole('button', { name: /Transparent v6/ }).click()
  await page.getByRole('button', { name: /RUN PRIVACY ANALYSIS/ }).click()
  await expect(page.getByText('PCZT-TRANSPARENT-OUTPUTS')).toBeVisible()
})

test('rejects malformed policy imports without weakening the current policy', async ({ page }) => {
  await page.goto('/tools')
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.getByLabel('Deny transparent components').check()
  await page.getByLabel('Select JSON policy file').setInputFiles({
    name: 'invalid-policy.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"deny_tranparent": false}'),
  })
  await expect(page.getByRole('status')).toContainText('Invalid policy file')
  await expect(page.getByLabel('Deny transparent components')).toBeChecked()
})

test('ecosystem atlas navigation and language onboarding are functional', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('navigation', {name:'Primary'}).getByRole('button', { name: 'Ecosystem' }).click()
  await expect(page).toHaveURL(/\/ecosystem/)
  await expect(page.getByRole('heading', { name: /Find your.*entry point/i })).toBeVisible()
  await page.getByRole('button', { name: /Python developer/i }).click()
  await expect(page.getByText('from zerynex_py import ZerynexClient', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: /Z3 \/ node operator/i }).click()
  await expect(page.getByText('zerynex-z3-check', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('DOCS-BASED · NOT LIVE TELEMETRY')).toBeVisible()
})

test('ecosystem atlas works in small viewport', async ({ page }) => {
  await page.goto('/ecosystem')
  await expect(page.getByRole('heading', { name: /One toolchain/i })).toBeVisible()
  await page.getByRole('button', { name: /Agent builder/i }).click()
  await expect(page.getByText('ZERYNEX_AGENT_ALLOWED_ROOT', { exact: false }).first()).toBeVisible()
  const sizes = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(sizes.body).toBeLessThanOrEqual(sizes.viewport + 1)
})

test('cinematic homepage keeps real navigation and readable content', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {name: 'Privacy is a property. Not a promise.'})).toBeVisible()
  await expect(page.getByText('LOCAL ANALYSIS · NO HOSTED PCZT PROCESSING')).toBeVisible()
  await expect(page.getByRole('link', {name:/Explore GitHub/})).toHaveAttribute('href', 'https://github.com/Oluwa-Laughter/zerynex')
  await expect(page.getByRole('heading', {name:/Built for the unseen/})).toBeVisible()
  const sizes = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
  expect(sizes.pageWidth).toBeLessThanOrEqual(sizes.viewportWidth + 1)
  if (isMobile) {
    await page.getByRole('button', {name:'Open menu'}).click()
    await expect(page.getByRole('navigation', {name:'Primary'})).toBeVisible()
  }
})

test('carousel and FAQ controls are keyboard-accessible', async ({ page }) => {
  await page.goto('/')
  const next = page.getByRole('button', {name:'Next tool'})
  await expect(next).toBeEnabled()
  await next.click()
  await expect(page.getByRole('button', {name:'Previous tool'})).toBeEnabled()
  const faq = page.getByRole('button', {name:'Does a passing report prove a transaction is private?'})
  await faq.focus()
  await page.keyboard.press('Enter')
  await expect(faq).toHaveAttribute('aria-expanded','true')
  await expect(page.getByText('Zerynex checks specific disclosure rules in intermediate PCZTs.')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(faq).toHaveAttribute('aria-expanded','false')
})

test('reduced-motion mode retains visible hero and stops continuous aurora motion', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/')
  await expect(page.getByRole('heading', {name:'Privacy is a property. Not a promise.'})).toBeVisible()
  const animation = await page.locator('.cinema-hero .aurora-layer-a').evaluate(el => getComputedStyle(el).animationName)
  expect(animation).toBe('none')
  await page.getByRole('region', {name:'Zerynex privacy infrastructure'}).getByRole('button', {name:'Open Developer Tools'}).click()
  await expect(page).toHaveURL(/\/tools/)
})

test('Developer tooling retains real WASM analysis after visual overhaul', async ({ page }) => {
  await page.goto('/tools')
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.getByRole('button',{name:/Flagged v6/}).click()
  await page.getByRole('button',{name:/RUN PRIVACY ANALYSIS/}).click()
  await expect(page.getByText('PCZT-GLOBAL-METADATA')).toBeVisible()
})

test('legacy Studio and Console URLs redirect to Developer Tools', async ({ page }) => {
  await page.goto('/studio')
  await expect(page).toHaveURL(/\/tools/)
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.goto('/console')
  await expect(page).toHaveURL(/\/tools/)
})

test('tooling integrator tabs expose setup instructions', async ({ page }) => {
  await page.goto('/tools')
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.getByRole('tab', {name:/Python SDK/}).click()
  await expect(page.getByText('from zerynex_py import ZerynexClient', {exact:false})).toBeVisible()
  await page.getByRole('tab', {name:/AI agents/}).click()
  await expect(page.getByText('ZERYNEX_AGENT_ALLOWED_ROOT', {exact:false})).toBeVisible()
  await page.getByRole('tab', {name:/Z3/}).click()
  await expect(page.getByText('zerynex-z3-check', {exact:false})).toBeVisible()
})


test('developer onboarding includes copyable external GitHub Action checks', async ({ page }) => {
  await page.goto('/tools')
  await page.getByRole('tab', {name:/GitHub Actions/}).click()
  await expect(page.getByText('Oluwa-Laughter/zerynex@main', {exact:false})).toBeVisible()
  await expect(page.getByText('Never upload real PCZTs', {exact:false})).toBeVisible()
  await expect(page.getByRole('link',{name:/READ INTEGRATION DOCUMENTATION/})).toHaveAttribute('href', /docs\/github-action\.md/)
})


test('Zerynex stage regression onboarding provides source-backed workflow', async ({ page }) => {
  await page.goto('/tools')
  await page.getByRole('tab', {name:/PCZT Stage Regression/}).click()
  await expect(page.getByText('--compare-with', {exact:false})).toBeVisible()
  await expect(page.getByText('cryptographic equivalence', {exact:false})).toBeVisible()
  await expect(page.getByRole('link',{name:/READ INTEGRATION DOCUMENTATION/}))
    .toHaveAttribute('href', /docs\/pczt-stage-regression\.md/)
})


test('upstream PCZT role harness onboarding exposes executable manifest workflow', async ({ page }) => {
  await page.goto('/tools')
  await page.getByRole('tab', {name:/Wallet Role Harness/}).click()
  await expect(page.getByText('zerynex-handoff', {exact:false})).toBeVisible()
  await expect(page.getByText('scenario-manifest', {exact:false})).toBeVisible()
  await expect(page.getByRole('link',{name:/READ INTEGRATION DOCUMENTATION/}))
    .toHaveAttribute('href', /docs\/handoff-harness\.md/)
})


test('documentation navigation and guide discovery work from homepage', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /Documentation/ }).click()
  await expect(page).toHaveURL(/\/docs$/)
  await expect(page.getByRole('heading', { name: /Build with confidence/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Go SDK/ }).first()).toBeVisible()
})

test('documentation search filters guide cards and handles empty searches', async ({ page }) => {
  await page.goto('/docs')
  await page.getByRole('textbox', { name: 'Search documentation' }).fill('OpenRPC')
  await expect(page.locator('.docs-guide-card')).toHaveCount(1)
  await page.locator('.docs-guide-card').first().click()
  await expect(page).toHaveURL(/\/docs\/rpc-contracts/)
  await expect(page.getByText('This tool does not test parameter types', { exact:false })).toBeVisible()
  await page.getByRole('link', { name: 'Documentation index' }).click()
  await page.getByRole('textbox', { name: 'Search documentation' }).fill('no_such_fake_feature_xyz')
  await expect(page.getByText('No matching guides')).toBeVisible()
})

test('canonical documentation links and markdown render on mobile', async ({ page }) => {
  await page.goto('/docs/installation')
  await expect(page.getByRole('heading', { name: 'Install and integrate Zerynex' }).first()).toBeVisible()
  await expect(page.getByText('cargo install --git', { exact:false })).toBeVisible()
  await page.locator('.docs-markdown').getByRole('link', { name: /Privacy model/ }).first().click()
  await expect(page).toHaveURL(/\/docs\/privacy-model/)
  const widths = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1)
})

test('developer tools show Go and RPC guidance with internal docs', async ({ page }) => {
  await page.goto('/tools')
  await page.getByRole('tab', { name: /Go SDK/ }).click()
  await expect(page.getByText('zerynex.Client', { exact:false })).toBeVisible()
  await page.getByRole('link', { name: /READ INTEGRATION DOCUMENTATION/ }).click()
  await expect(page).toHaveURL(/\/docs\/go-sdk/)
  await page.goto('/tools')
  await page.getByRole('tab', { name: /RPC Contracts/ }).click()
  await expect(page.getByText('scripts/check_rpc_contract.py', { exact:false })).toBeVisible()
  await page.getByRole('link', { name: /READ INTEGRATION DOCUMENTATION/ }).click()
  await expect(page).toHaveURL(/\/docs\/rpc-contracts/)
})


test('ecosystem onboarding supports Go and ZK engineering with correct limitations', async ({ page }) => {
  await page.goto('/ecosystem')
  await page.getByRole('button', { name: /Go engineer/ }).click()
  await expect(page.getByText('zerynex.Client', { exact:false })).toBeVisible()
  await expect(page.getByText('No reimplementation of Zcash protocol cryptography', { exact:false })).toBeVisible()
  await page.getByRole('button', { name: /ZK engineer/ }).click()
  await expect(page.getByText('ZK proof generation and verification are NOT implemented', { exact:false })).toBeVisible()
  await page.getByRole('link',{ name: /ZK \/ PROVER/ }).click()
  await expect(page).toHaveURL(/\/docs\/zk-prover-handoffs/)
})
