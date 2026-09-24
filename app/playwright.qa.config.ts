import { defineConfig, devices } from '@playwright/test';

/**
 * QA-only Playwright config.
 *
 * The repo's playwright.config.ts hardcodes baseURL http://localhost:3000,
 * which is the developer's own long-running `next dev`. That instance was
 * wedged (every request returned http=000 after a 30s hang), so running the
 * suite against it produced nine 35.0s timeouts that said nothing about the
 * code under test.
 *
 * This config points the same specs at an isolated dev server on :3001 so a
 * run is attributable to the commit, not to whoever happens to be holding
 * :3000. The committed playwright.config.ts is deliberately untouched.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 45_000,
  use: {
    baseURL: process.env.QA_BASE_URL ?? 'http://localhost:3001',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
