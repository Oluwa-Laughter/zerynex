import { test, expect } from '@playwright/test'

test('home page is usable and studio navigation is functional', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Zerynex/)
  await expect(page.getByRole('heading', { name: /privacy is/i })).toBeVisible()
  await page.getByRole('button', { name: /launch studio/i }).click()
  await expect(page).toHaveURL(/\/studio/)
  await expect(page.getByRole('heading', { name: /inspect the/i })).toBeVisible()
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
})

test('real local WebAssembly analysis catches a synthetic disclosure', async ({ page }) => {
  await page.goto('/studio')
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.getByRole('button', { name: /Flagged v6/i }).click()
  await expect(page.getByText('flagged-synthetic-v6.pczt')).toBeVisible()
  await page.getByRole('button', { name: /RUN PRIVACY ANALYSIS/i }).click()
  await expect(page.getByText('1 finding')).toBeVisible()
  await expect(page.getByText('PCZT-GLOBAL-METADATA')).toBeVisible()
  await expect(page.getByText('global.proprietary')).toBeVisible()
})

test('a clean synthetic PCZT passes implemented privacy policies', async ({ page }) => {
  await page.goto('/studio')
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
  await expect(page.getByRole('link', { name: /Documentation/ })).toBeVisible()
  await page.getByRole('button', { name: /launch studio/i }).click()
  await expect(page).toHaveURL(/\/studio/)
})

test('privacy invariants are enforced by Rust and exportable as JSON', async ({ page }) => {
  await page.goto('/studio')
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
  await page.goto('/studio')
  await expect(page.getByText('RUST ENGINE READY')).toBeVisible()
  await page.getByLabel('Deny transparent components').check()
  await page.getByRole('button', { name: /Transparent v6/ }).click()
  await page.getByRole('button', { name: /RUN PRIVACY ANALYSIS/ }).click()
  await expect(page.getByText('PCZT-TRANSPARENT-OUTPUTS')).toBeVisible()
  await expect(page.getByText('transparent.outputs', {exact: true})).toBeVisible()
})

test('locally imports a valid policy file and applies its restrictions', async ({ page }) => {
  await page.goto('/studio')
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
  await page.goto('/studio')
  await page.getByLabel('Deny transparent components').check()
  await page.getByLabel('Select JSON policy file').setInputFiles({
    name: 'invalid-policy.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"deny_tranparent": false}'),
  })
  await expect(page.getByRole('status')).toContainText('Invalid policy file')
  await expect(page.getByLabel('Deny transparent components')).toBeChecked()
})
