import { defineConfig } from '@playwright/test';

/**
 * Smoke tests for the storefront, admin and driver apps.
 * Expects the app to be running (`npm run dev`), or set E2E_BASE_URL to a deployed site.
 * Uses the locally installed Chrome so no browser download is needed
 * (override with E2E_BROWSER_CHANNEL=msedge, or "chromium" after `npx playwright install chromium`).
 */
const channel = process.env.E2E_BROWSER_CHANNEL || 'chrome';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    locale: 'ar-EG',
    trace: 'retain-on-failure',
    ...(channel === 'chromium' ? {} : { channel }),
  },
});
