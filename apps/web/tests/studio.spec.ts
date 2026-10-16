import { test, expect } from '@playwright/test'

test('homepage navigates to Zerynex developer tooling', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Zerynex/)
  await expect(page.getByRole('heading', { name: /Privacy tooling/i })).toBeVisible()
  await page.locator('.topbar').getByRole('button', { name: 'Open workbench' }).click()
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
  await expect(page.getByRole('navigation', {name:'Primary'}).getByRole('link', { name: 'Docs' })).toBeVisible()
  await page.locator('.topbar').getByRole('button', { name: 'Open workbench' }).click()
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

test('SDK navigation shows language-only labels and a working Python quickstart', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) await page.getByRole('button',{name:'Open menu'}).click()
  await page.getByRole('navigation',{name:'Primary'}).getByRole('button',{name:'SDKs'}).click()
  await expect(page).toHaveURL(/\/ecosystem/)
  await expect(page.getByRole('heading',{name:/Speak your.*language/i})).toBeVisible()
  await page.getByRole('button',{name:/^Python/}).click()
  await expect(page.getByText('from zerynex_py import ZerynexClient',{exact:false})).toBeVisible()
  await expect(page.getByRole('button',{name:/^Rust/})).toBeVisible()
  await expect(page.getByRole('button',{name:/^Go/})).toBeVisible()
  await expect(page.getByRole('button',{name:/^TypeScript/})).toBeVisible()
  await expect(page.getByRole('button',{name:/Go engineer/})).toHaveCount(0)
})

test('language SDK page and agent route fit small viewports',async ({page})=>{
  await page.goto('/ecosystem')
  const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,view:document.documentElement.clientWidth}))
  expect(size.width).toBeLessThanOrEqual(size.view+1)
  await page.getByRole('link',{name:/MCP \+ agent skills/}).click()
  await expect(page).toHaveURL(/\/agents/)
  await expect(page.getByRole('heading',{name:/Automation.*with limits/i})).toBeVisible()
  await expect(page.locator('.zn-agent-code')).toContainText('ZERYNEX_AGENT_ALLOWED_ROOT')
})

test('new homepage has working tool links and no personal repository CTA',async ({page,isMobile})=>{
  await page.goto('/')
  await expect(page.getByRole('heading',{name:/Privacy tooling.*without friction/i})).toBeVisible()
  await expect(page.getByRole('link',{name:/Launch workbench/})).toBeVisible()
  await expect(page.getByRole('link',{name:/Explore GitHub/})).toHaveCount(0)
  await expect(page.getByRole('link',{name:/Inspect a PCZT/})).toBeVisible()
  const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,view:document.documentElement.clientWidth}))
  expect(size.width).toBeLessThanOrEqual(size.view+1)
  if(isMobile){
    await page.getByRole('button',{name:'Open menu'}).click()
    await expect(page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'Agents'})).toBeVisible()
  }
})

test('homepage actually detects transparent fixture with the Rust WASM parser',async ({page})=>{
  await page.goto('/')
  await page.getByRole('button',{name:'Run synthetic check'}).click()
  await expect(page.getByText('PCZT-TRANSPARENT-OUTPUTS')).toBeVisible()
  await expect(page.getByText('transparent.outputs',{exact:true})).toBeVisible()
})

test('reduced-motion keeps hero and application controls accessible',async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/')
  await expect(page.getByRole('heading',{name:/Privacy tooling/})).toBeVisible()
  await expect(page.getByRole('link',{name:/Launch workbench/})).toBeVisible()
  await page.getByRole('link',{name:/Launch workbench/}).click()
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
  await expect(page.getByRole('link',{name:/READ INTEGRATION DOCUMENTATION/})).toHaveAttribute('href', '/docs/github-action')
})


test('Zerynex stage regression onboarding provides source-backed workflow', async ({ page }) => {
  await page.goto('/tools')
  await page.getByRole('tab', {name:/PCZT Stage Regression/}).click()
  await expect(page.getByText('--compare-with', {exact:false})).toBeVisible()
  await expect(page.getByText('cryptographic equivalence', {exact:false})).toBeVisible()
  await expect(page.getByRole('link',{name:/READ INTEGRATION DOCUMENTATION/}))
    .toHaveAttribute('href', '/docs/pczt-stage-regression')
})


test('upstream PCZT role harness onboarding exposes executable manifest workflow', async ({ page }) => {
  await page.goto('/tools')
  await page.getByRole('tab', {name:/Wallet Role Harness/}).click()
  await expect(page.getByText('zerynex-handoff', {exact:false})).toBeVisible()
  await expect(page.getByText('scenario-manifest', {exact:false})).toBeVisible()
  await expect(page.getByRole('link',{name:/READ INTEGRATION DOCUMENTATION/}))
    .toHaveAttribute('href', '/docs/handoff-harness')
})


test('documentation navigation and guide discovery work from homepage', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Docs' }).click()
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


test('Go SDK onboarding and ZK guidance are separated',async ({page})=>{
  await page.goto('/ecosystem')
  await page.getByRole('button',{name:/^Go/}).click()
  await expect(page.getByText('zerynex.Client',{exact:false})).toBeVisible()
  await page.getByRole('link',{name:'Read integration guide'}).click()
  await expect(page).toHaveURL(/\/docs\/go-sdk/)
  await page.goto('/ecosystem')
  await page.getByRole('link',{name:/ZK \/ proving research/}).click()
  await expect(page).toHaveURL(/\/docs\/zk-prover-handoffs/)
})

test('real WebAssembly stage comparison flags new metadata and exports JSON', async ({ page }) => {
  await page.goto('/tools/stages')
  await expect(page.getByRole('heading', { name: /See what changed/ })).toBeVisible()
  await page.getByRole('button', { name: /New metadata/ }).click()
  await expect(page.getByText('clean-synthetic-v6.pczt')).toBeVisible()
  await expect(page.getByText('flagged-synthetic-v6.pczt')).toBeVisible()
  await page.getByRole('button', { name: /COMPARE PCZT STAGES/ }).click()
  await expect(page.getByText('PCZT-GLOBAL-METADATA')).toBeVisible()
  await expect(page.getByText('global.proprietary')).toBeVisible()
  await expect(page.getByText('Review stage observations')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export JSON/ }).click()
  expect((await download).suggestedFilename()).toBe('zerynex-stage-regression.json')
})

test('stage comparison rejects a newly introduced transparent output even without deny-transparent', async ({ page }) => {
  await page.goto('/tools/stages')
  await page.getByRole('button', { name: /Pool topology/ }).click()
  await page.getByRole('button', { name: /COMPARE PCZT STAGES/ }).click()
  await expect(page.getByRole('heading', { name: /Pool component changes/ })).toContainText('1')
  await expect(page.getByText('transparent.outputs')).toBeVisible()
  await expect(page.getByText('0 → 1')).toBeVisible()
})

test('stage comparison detects a disclosure that was resolved', async ({ page }) => {
  await page.goto('/tools/stages')
  await page.getByRole('button', { name: /Resolved finding/ }).click()
  await page.getByRole('button', { name: /COMPARE PCZT STAGES/ }).click()
  await expect(page.getByText('No remaining findings')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Resolved findings/ })).toContainText('1')
})

test('invalid local PCZT snapshots cannot yield a fake passing report', async ({ page }) => {
  await page.goto('/tools/stages')
  await page.getByRole('button', { name: /New metadata/ }).click()
  await expect(page.getByText('clean-synthetic-v6.pczt')).toBeVisible()
  await expect(page.getByText('flagged-synthetic-v6.pczt')).toBeVisible()
  await page.getByLabel('Baseline PCZT file').setInputFiles({
    name:'invalid.pczt',mimeType:'application/octet-stream',buffer:Buffer.from('not a PCZT'),
  })
  await expect(page.getByText('invalid.pczt')).toBeVisible()
  await page.getByRole('button', { name: /COMPARE PCZT STAGES/ }).click()
  await expect(page.locator('.wb-error[role="alert"]')).toContainText('Comparison failed')
  await expect(page.getByText('No remaining findings')).toHaveCount(0)
})

test('role-handoff workbench executes all four synthetic PCZT scenarios', async ({ page }) => {
  await page.goto('/tools/handoff')
  await expect(page.getByRole('heading', { name: /Test the handoff/ })).toBeVisible()
  await page.getByRole('button', { name: /RUN SYNTHETIC HANDOFF SUITE/ }).click()
  await expect(page.getByText('4 / 4 scenarios matched')).toBeVisible()
  await page.getByRole('button', { name: /creator to updater introduces proprietary/i }).click()
  await expect(page.getByText('PCZT-GLOBAL-METADATA')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export sanitized JSON/ }).click()
  expect((await download).suggestedFilename()).toBe('zerynex-role-scenario-results.json')
})

test('documentation and tools link to real browser workbenches', async ({ page }) => {
  await page.goto('/docs/pczt-stage-regression')
  await page.getByRole('link', { name: 'Open Stage Comparator' }).click()
  await expect(page).toHaveURL(/\/tools\/stages$/)
  await page.getByRole('link', { name: 'Read guide' }).click()
  await expect(page).toHaveURL(/\/docs\/pczt-stage-regression$/)
  await page.goto('/tools')
  await page.getByRole('link', { name: /Role Handoff Tests/ }).first().click()
  await expect(page).toHaveURL(/\/tools\/handoff$/)
})


test('color themes switch and persist through navigation and reload',async ({page})=>{
  await page.goto('/')
  await page.getByRole('button',{name:'Change color theme'}).click()
  await page.getByRole('button',{name:'Light'}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  await page.getByRole('link',{name:/Launch workbench/}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  await page.getByRole('button',{name:'Change color theme'}).click()
  await page.getByRole('button',{name:'Dark'}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await page.goto('/docs')
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await page.getByRole('button',{name:'Change color theme'}).click()
  await page.getByRole('button',{name:'System'}).click()
  expect(await page.evaluate(()=>localStorage.getItem('zerynex-theme'))).toBeNull()
})

test('system color theme tracks OS preference and is keyboard accessible',async ({page})=>{
  await page.emulateMedia({colorScheme:'light'})
  await page.goto('/docs')
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  await page.emulateMedia({colorScheme:'dark'})
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await page.getByRole('button',{name:'Change color theme'}).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('group',{name:'Color theme'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Light'})).toBeVisible()
})

test('new agent page shows scoped MCP/skill/CI interfaces',async ({page})=>{
  await page.goto('/agents')
  await expect(page.getByRole('heading',{name:/Automation/})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Local MCP server'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Portable agent skill'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'CI policy gate'})).toBeVisible()
  await expect(page.locator('.zn-agent-code')).toContainText('ZERYNEX_AGENT_ALLOWED_ROOT')
  await expect(page.getByText('No wallet keys, arbitrary filesystem access',{exact:false})).toBeVisible()
})


test('agent setup builds correct Cursor and VS Code MCP host configs locally',async ({page})=>{
  await page.goto('/agents')
  await page.getByLabel('MCP executable').fill('/opt/zerynex/bin/zerynex-mcp')
  await page.getByLabel('Trusted Rust CLI').fill('/opt/zerynex/bin/zerynex')
  await page.getByLabel('Allowed synthetic fixture root').fill('/tmp/approved-synthetic')
  const snippet=page.locator('.zn-agent-code')
  await expect(snippet).toContainText('"mcpServers"')
  await expect(snippet).toContainText('/opt/zerynex/bin/zerynex-mcp')
  await expect(snippet).toContainText('/tmp/approved-synthetic')
  await page.getByRole('button',{name:'VS Code'}).click()
  await expect(snippet).toContainText('"servers"')
  await expect(snippet).not.toContainText('"mcpServers"')
  await expect(snippet).toContainText('"type": "stdio"')
  await page.getByRole('button',{name:'Claude Desktop'}).click()
  await expect(snippet).toContainText('"mcpServers"')
  await page.getByLabel('Allowed synthetic fixture root').fill('relative/bad')
  await expect(page.locator('.zn-agent-invalid[role="alert"]')).toContainText('absolute local paths')
  await expect(page.getByRole('button',{name:'Copy JSON'})).toBeDisabled()
})

test('agent demo executes actual Rust WASM synthetic policy findings locally',async ({page})=>{
  await page.goto('/agents')
  const demo=page.locator('.zn-agent-demo')
  await demo.getByRole('button',{name:/Transparent output/}).click()
  await demo.getByRole('button',{name:/Run local policy check/}).click()
  await expect(demo.getByText('PCZT-TRANSPARENT-OUTPUTS')).toBeVisible()
  await expect(demo.getByText('transparent.outputs',{exact:true})).toBeVisible()
  await demo.getByRole('button',{name:/Clean/}).click()
  await demo.getByRole('button',{name:/Run local policy check/}).click()
  await expect(demo.getByText('NO POLICY FINDINGS')).toBeVisible()
})

test('agent onboarding does not claim in-browser MCP connectivity',async ({page})=>{
  await page.goto('/agents')
  await expect(page.getByText('it is not an MCP connection',{exact:false})).toBeVisible()
  await expect(page.getByText('The website cannot access your filesystem',{exact:false})).toBeVisible()
  await page.getByRole('link',{name:'Complete setup and trust model'}).click()
  await expect(page).toHaveURL(/\/docs\/agents$/)
  await expect(page.getByText('zerynex-mcp-doctor',{exact:false}).first()).toBeVisible()
})


test('manual PCZT upload wins over delayed synthetic preset requests',async ({page})=>{
  await page.route('**/examples/clean-v6.bin',async route=>{
    await new Promise(resolve=>setTimeout(resolve,450))
    await route.continue()
  })
  await page.goto('/tools/stages')
  await page.getByRole('button',{name:/New metadata/}).click()
  await page.getByLabel('Baseline PCZT file').setInputFiles({
    name:'manual-invalid.pczt',mimeType:'application/octet-stream',buffer:Buffer.from('invalid'),
  })
  await expect(page.getByText('manual-invalid.pczt')).toBeVisible()
  await page.waitForTimeout(650)
  await expect(page.getByText('manual-invalid.pczt')).toBeVisible()
  await expect(page.getByText('clean-synthetic-v6.pczt')).toHaveCount(0)
  await expect(page.getByText('flagged-synthetic-v6.pczt')).toHaveCount(0)
})
