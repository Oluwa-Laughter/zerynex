import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const port = process.env.ZERYNEX_E2E_PORT || '3100'

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  // A developer laptop may run real browsers and Rust builds simultaneously.
  // Keep local UI suites sequential; CI can still use two workers.
  workers: process.env.CI ? 2 : 1,
  expect: { timeout: 15_000 },
  use: {
    ...(process.env.CI || !existsSync('/usr/bin/google-chrome') ? {} : {launchOptions: {executablePath: '/usr/bin/google-chrome'}}),
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
