import { test, expect } from '@playwright/test'

test('homepage navigates to Zerynex developer tooling', async ({ page, isMobile }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Zerynex/)
  await expect(page.getByRole('heading', { name: /Build for Zcash/i })).toBeVisible()
  if(isMobile){
    await page.getByRole('button',{name:'Open menu'}).click()
    await page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'Open workbench'}).click()
  } else {
    await page.locator('.topbar').getByRole('link', { name: 'Open workbench' }).click()
  }
  await expect(page).toHaveURL(/\/tools/)
  await expect(page.getByRole('heading', { name: /Inspect Zcash transaction privacy/i })).toBeVisible()
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
  await page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'Open workbench'}).click()
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
  await page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'SDKs'}).click()
  await expect(page).toHaveURL(/\/ecosystem/)
  await expect(page.getByRole('heading',{name:/Bring Zcash privacy checks/i})).toBeVisible()
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
  await expect(page.getByRole('heading',{name:/Agent tooling for Zcash privacy workflows/i})).toBeVisible()
  await expect(page.locator('.zn-agent-code')).toContainText('ZERYNEX_AGENT_ALLOWED_ROOT')
})

test('new homepage has working tool links and no personal repository CTA',async ({page,isMobile})=>{
  await page.goto('/')
  await expect(page.getByRole('heading',{name:/Build for Zcash.*Privacy comes first/i})).toBeVisible()
  await expect(page.getByRole('link',{name:/Explore developer tools/})).toBeVisible()
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
  await expect(page.getByRole('heading',{name:/Build for Zcash/})).toBeVisible()
  await expect(page.getByRole('link',{name:/Explore developer tools/})).toBeVisible()
  await page.getByRole('link',{name:/Explore developer tools/}).click()
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
  await expect(page.getByRole('heading', { name: /Learn the core.*Build with confidence/ })).toBeVisible()
  await expect(page.locator('.docs-guide-card').filter({ hasText: 'Go SDK' })).toBeVisible()
})

test('documentation search filters guide cards and handles empty searches', async ({ page }) => {
  await page.goto('/docs')
  await page.getByRole('textbox', { name: 'Search documentation' }).fill('OpenRPC')
  await expect(page.locator('.docs-guide-card')).toHaveCount(1)
  await page.locator('.docs-guide-card').first().click()
  await expect(page).toHaveURL(/\/docs\/rpc-contracts/)
  await expect(page.getByText('This tool does not test parameter types', { exact:false })).toBeVisible()
  await page.locator('.docs-breadcrumb').getByRole('link', { name: 'Documentation' }).click()
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
  await page.getByRole('link',{name:/Explore developer tools/}).click()
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
  await expect(page.getByRole('heading',{name:/Agent tooling for/})).toBeVisible()
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


test('download documentation describes independently tested packages',async ({page})=>{
  await page.goto('/docs/releases')
  await expect(page.getByRole('heading',{name:/Download Zerynex without cloning/})).toBeVisible()
  await expect(page.getByText('npm install ./zerynex-sdk-0.1.0.tgz',{exact:false})).toBeVisible()
  await expect(page.getByText('not automatically publish',{exact:false})).toBeVisible()
})

test('TypeScript onboarding uses bundled WebAssembly SDK and flags unpublished registry',async ({page})=>{
  await page.goto('/ecosystem')
  await page.getByRole('button',{name:/^TypeScript/}).click()
  await expect(page.getByText('createBrowserZerynexClient',{exact:false}).first()).toBeVisible()
  await expect(page.getByText('Public npm registry publication',{exact:false})).toBeVisible()
  const guide = page.getByRole('link',{name:'Read integration guide'})
  await expect(guide).toHaveAttribute('href', '/docs/typescript-api')
  await guide.click()
  await expect(page).toHaveURL(/\/docs\/typescript-api/)
})


test('SDK download flow points to the matching source-free artifact guide',async ({page})=>{
  await page.goto('/ecosystem')
  await expect(page.getByRole('heading',{name:/Keep the code.*Skip the clone/i})).toBeVisible()
  await page.getByRole('link',{name:'Explore downloads'}).click()
  await expect(page).toHaveURL(/\/docs\/releases$/)
  await expect(page.getByRole('heading',{name:/Download Zerynex without cloning/})).toBeVisible()
})


test('responsive Zcash product pages respect max-width and avoid viewport overflow',async ({page})=>{
  test.slow()
  const paths=['/','/ecosystem','/agents','/docs','/tools','/tools/stages','/tools/handoff']
  for(const width of [360,768,1024,1440,1920]){
    await page.setViewportSize({width,height:900})
    for(const route of paths){
      await page.goto(route)
      const shape=await page.evaluate(()=>({
        viewport:document.documentElement.clientWidth,
        document:document.documentElement.scrollWidth,
        body:document.body.scrollWidth,
        heading:document.querySelector('h1')?.getBoundingClientRect().width??0,
        header:document.querySelector('.zn-site-header')?.getBoundingClientRect().width??0,
      }))
      expect(shape.document,route+' overflows at '+width).toBeLessThanOrEqual(shape.viewport+2)
      expect(shape.body,route+' body overflows at '+width).toBeLessThanOrEqual(shape.viewport+2)
      expect(shape.header).toBeLessThanOrEqual(width)
      expect(shape.heading).toBeGreaterThan(180)
    }
  }
})

test('phone hamburger navigation works from every product area and closes on Escape',async ({page})=>{
  await page.setViewportSize({width:390,height:844})
  for (const location of ['/','/tools','/ecosystem','/agents','/docs','/tools/stages']) {
    await page.goto(location)
    const open=page.getByRole('button',{name:'Open menu'})
    await expect(open).toBeVisible()
    await open.click()
    const nav=page.getByRole('navigation',{name:'Primary'})
    await expect(nav).toBeVisible()
    await expect(page.getByRole('button',{name:'Close menu'})).toHaveAttribute('aria-expanded','true')
    await page.keyboard.press('Escape')
    await expect(nav).toBeHidden()
    await expect(open).toHaveAttribute('aria-expanded','false')
  }
  await page.goto('/agents')
  await page.getByRole('button',{name:'Open menu'}).click()
  await page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'Docs'}).click()
  await expect(page).toHaveURL(/\/docs$/)
  await expect(page.getByRole('button',{name:'Open menu'})).toBeVisible()
})

test('phone docs hamburger opens full sections and navigates to the guide',async ({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/docs')
  const toggle=page.getByRole('button',{name:'Browse documentation sections'})
  await expect(toggle).toBeVisible()
  const sections=page.getByLabel('Documentation sections')
  await expect(sections).toBeHidden()
  await toggle.click()
  await expect(sections).toBeVisible()
  await expect(page.getByRole('button',{name:'Close documentation menu'})).toHaveAttribute('aria-expanded','true')
  await sections.getByRole('link',{name:'Privacy policy format'}).click()
  await expect(page).toHaveURL(/\/docs\/policy-format$/)
  await expect(page.getByRole('button',{name:'Browse documentation sections'})).toBeVisible()
  await expect(sections).toBeHidden()
})

test('large-screen Zcash headline and workflow overview use the available content width',async ({page})=>{
  await page.setViewportSize({width:1600,height:950})
  await page.goto('/')
  await expect(page.getByRole('heading',{name:/Build for Zcash.*Privacy comes first/i})).toBeVisible()
  await expect(page.getByRole('heading',{name:/One toolkit.*Across the ecosystem/i})).toBeVisible()
  await expect(page.getByRole('link',{name:/Zcash node and RPC integrations/i})).toBeVisible()
  await expect(page.getByRole('link',{name:/Wallets and signing handoffs/i})).toBeVisible()
  const widths=await page.evaluate(()=>({
    hero:document.querySelector('.zn-hero h1')?.getBoundingClientRect().width??0,
    workflow:document.querySelector('.zn-workflows-heading h2')?.getBoundingClientRect().width??0,
  }))
  expect(widths.hero).toBeGreaterThan(650)
  expect(widths.workflow).toBeGreaterThan(650)
})

test('all product routes remain usable at 320px with complete max-width and no horizontal overflow', async ({page})=>{
  test.slow()
  await page.setViewportSize({width:320,height:720})
  for(const route of ['/', '/ecosystem', '/agents', '/docs', '/docs/installation', '/docs/agents',
    '/tools', '/tools/stages', '/tools/handoff']){
    await page.goto(route)
    const layout=await page.evaluate(()=>({
      viewport:document.documentElement.clientWidth,
      document:document.documentElement.scrollWidth,
      body:document.body.scrollWidth,
      header:document.querySelector('.zn-site-header')?.getBoundingClientRect().width??0,
    }))
    expect(layout.document,route+' horizontal overflow').toBeLessThanOrEqual(layout.viewport+2)
    expect(layout.body,route+' body overflow').toBeLessThanOrEqual(layout.viewport+2)
    expect(layout.header).toBeLessThanOrEqual(layout.viewport)
    await expect(page.getByRole('button',{name:'Open menu'})).toBeVisible()
  }
})

test('mobile integration tabs are all discoverable without sideways scrolling',async ({page})=>{
  await page.setViewportSize({width:320,height:740})
  await page.goto('/tools')
  const tabs=page.getByRole('tablist',{name:'Choose integration'})
  await expect(tabs.getByRole('tab')).toHaveCount(13)
  const dimensions=await tabs.evaluate(element=>{
    const rect=element.getBoundingClientRect()
    const buttons=[...element.querySelectorAll('button')].map(button=>button.getBoundingClientRect())
    return {
      display:getComputedStyle(element).display,
      totalWidth:element.scrollWidth,
      viewportWidth:rect.width,
      allWithin:buttons.every(button=>button.left>=rect.left-1&&button.right<=rect.right+1),
    }
  })
  expect(dimensions.display).toBe('grid')
  expect(dimensions.totalWidth).toBeLessThanOrEqual(dimensions.viewportWidth+2)
  expect(dimensions.allWithin).toBe(true)
  await tabs.getByRole('tab',{name:/AI agents \/ MCP/}).click()
  await expect(page.getByRole('tabpanel').getByText('Agent-assisted privacy regressions')).toBeVisible()
})

test('mobile hamburger traps keyboard focus and dismisses on outside click',async ({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/agents')
  await page.getByRole('button',{name:'Open menu'}).click()
  await expect(page.getByRole('navigation',{name:'Primary'})).toBeVisible()
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden')
  const focused=await page.evaluate(()=>document.activeElement?.textContent?.trim())
  expect(focused).toBe('Overview')
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button',{name:'Close menu'})).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'Overview'})).toBeFocused()
  await page.mouse.click(9,260)
  await expect(page.getByRole('navigation',{name:'Primary'})).toBeHidden()
  expect(await page.evaluate(()=>document.body.style.overflow)).toBe('')
  await page.getByRole('button',{name:'Open menu'}).click()
  await page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'Open workbench'}).click()
  await expect(page).toHaveURL(/\/tools$/)
  await expect(page.getByRole('button',{name:'Open menu'})).toBeVisible()
})

test('docs mobile contents menu can be dismissed with Escape and outside click',async ({page})=>{
  await page.setViewportSize({width:360,height:760})
  await page.goto('/docs/installation')
  const browse=page.getByRole('button',{name:'Browse documentation sections'})
  await browse.click()
  await expect(page.getByLabel('Documentation sections')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Documentation sections')).toBeHidden()
  await expect(browse).toBeFocused()
  await browse.click()
  await page.mouse.click(4,5)
  await expect(page.getByLabel('Documentation sections')).toBeHidden()
})

test('developer docs prioritize quickstart, API paths and curated categories', async ({ page }) => {
  await page.goto('/docs')
  await expect(page.getByRole('heading', { name: 'Choose your path' })).toBeVisible()
  await expect(page.getByRole('link', { name: /First privacy check/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Integrate an SDK/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Automate a workflow/ })).toBeVisible()
  await expect(page.locator('.docs-guide-card')).toHaveCount(26)
  await expect(page.getByRole('navigation', { name: 'Documentation sections' }).getByRole('heading', { name: 'Research' })).toHaveCount(0)
  await page.getByRole('button', { name: 'SDKs & APIs' }).click()
  await expect(page.locator('.docs-guide-card')).toHaveCount(9)
  await expect(page.getByRole('link', { name: /TypeScript and browser API/ }).first()).toBeVisible()
  await page.getByRole('textbox', { name: 'Search documentation' }).fill('Python')
  await expect(page.locator('.docs-guide-card')).toHaveCount(1)
  await expect(page.getByRole('link', { name: /Python SDK API/ }).first()).toBeVisible()
})

test('developer docs guide new users into source-backed API references', async ({ page }) => {
  await page.goto('/docs')
  const quickstart = page.locator('.docs-entry-card').first()
  await expect(quickstart).toHaveAttribute('href', '/docs/quickstart')
  await quickstart.click()
  await expect(page).toHaveURL(/\/docs\/quickstart/)
  await expect(page.getByText('zerynex --capabilities', { exact: false })).toBeVisible()
  await page.getByRole('navigation', { name: 'Adjacent documentation' }).getByRole('link', { name: /Install and integrate/ }).click()
  await expect(page).toHaveURL(/\/docs\/installation/)
  const apiGuide = page.locator('.docs-markdown').getByRole('link', { name: /language API guides/ })
  await expect(apiGuide).toHaveAttribute('href', '/docs/typescript-api')
  await page.goto('/docs/typescript-api')
  await expect(page).toHaveURL(/\/docs\/typescript-api/)
  await expect(page.getByText('createBrowserZerynexClient', { exact: false }).first()).toBeVisible()
})

test('internal repository notes are not published as product docs routes', async ({ page }) => {
  for (const slug of ['deployment', 'product-experience', 'responsive-design', 'documentation-workflow', 'ecosystem-research-2026-10']) {
    const response = await page.request.get('/docs/' + slug)
    expect(response.status(), slug).toBe(404)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/docs')
  await page.getByRole('button', { name: 'Browse documentation sections' }).click()
  await expect(page.getByRole('navigation', { name: 'Documentation sections' })).toHaveCount(0)
  await expect(page.getByLabel('Documentation sections')).toBeVisible()
  await expect(page.getByLabel('Documentation sections').getByText('Product design and release policy')).toHaveCount(0)
  await expect(page.getByLabel('Documentation sections').getByText('Deploy the developer frontend')).toHaveCount(0)
  await expect(page.getByLabel('Documentation sections').getByText('Python SDK API')).toBeVisible()
})

test('Zcash node readiness workbench checks public chain state locally', async ({ page }) => {
  await page.goto('/tools/node')
  await expect(page.getByRole('heading',{name:/Is your Zcash node ready/})).toBeVisible()
  await page.getByRole('button',{name:'Ready node'}).click()
  await page.getByRole('button',{name:/Analyze readiness/}).click()
  await expect(page.getByText('NODE READINESS CONFIRMED')).toBeVisible()
  await expect(page.getByText('NETWORK MATCH')).toBeVisible()
  await page.getByRole('button',{name:'Wrong network'}).click()
  await page.getByRole('button',{name:/Analyze readiness/}).click()
  await expect(page.getByText('NODE IS NOT READY')).toBeVisible()
  await expect(page.getByText('CHECK FAILED').first()).toBeVisible()
  await page.getByLabel('Blockchain info JSON').fill('not valid JSON')
  await page.getByRole('button',{name:/Analyze readiness/}).click()
  await expect(page.locator('[role="alert"]').filter({hasText:'Cannot evaluate this response'})).toBeVisible()
  await expect(page.getByText('NODE READINESS CONFIRMED')).toHaveCount(0)
})

test('mobile Zcash node workbench supports local synthetic readiness checks', async ({ page }) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/tools/node')
  await page.getByRole('button',{name:'Syncing node'}).click()
  await page.getByRole('button',{name:/Analyze readiness/}).click()
  await expect(page.getByText('NODE IS NOT READY')).toBeVisible()
  await expect(page.getByText('INITIAL SYNC')).toBeVisible()
  await expect(page.getByText('CHECK FAILED').first()).toBeVisible()
})

test('ZIP-321 payment workbench validates requests using local Rust/WASM', async ({ page }) => {
  await page.goto('/tools/payment')
  await expect(page.getByRole('heading',{name:/Inspect payment requests/i})).toBeVisible()
  await page.getByRole('button',{name:'Shielded example'}).click()
  await page.getByRole('button',{name:/Validate payment request/}).click()
  await expect(page.getByText('ZIP-321 REQUEST STRUCTURE VALID')).toBeVisible()
  await expect(page.getByText('100000000 ZAT')).toBeVisible()
  await expect(page.locator('[aria-labelledby="payment-output"]')).not.toContainText('ztestsapling10yy2ex5')
  await page.getByRole('button',{name:'Multiple recipients'}).click()
  await page.getByRole('button',{name:/Validate payment request/}).click()
  await expect(page.getByText('PAYMENT 1')).toBeVisible()
  await page.getByRole('button',{name:'Unsupported required field'}).click()
  await page.getByRole('button',{name:/Validate payment request/}).click()
  await expect(page.getByRole('alert').first()).toContainText('Payment request rejected')
})

test('mobile payment workbench fails closed on wrong Zcash network', async ({ page }) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/tools/payment')
  await page.getByRole('button',{name:'Shielded example'}).click()
  await page.getByLabel('Expected Zcash network').selectOption('main')
  await page.getByRole('button',{name:/Validate payment request/}).click()
  await expect(page.getByRole('alert').first()).toContainText('Payment request rejected')
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:document.documentElement.clientWidth}))
  expect(widths.scroll).toBeLessThanOrEqual(widths.view+1)
})
