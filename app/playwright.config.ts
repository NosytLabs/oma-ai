import { defineConfig, devices } from '@playwright/test'

/**
 * OMA AI — Playwright config
 *
 * Two test directories are scanned:
 *   - `./e2e/**\/*.spec.ts`      — focused user-journey specs (deposit, login,
 *                                   pricing, navbar, wallet picker, 404).
 *   - `./tests/e2e/**\/*.e2e.spec.ts` — the original suite (hydration, WCAG
 *                                   audit). The `.e2e.` infix keeps these
 *                                   visually distinct from vitest unit tests
 *                                   (`*.test.{ts,tsx}` under `src/`).
 *
 * Boots the Next.js dev server if none is running on the configured base URL.
 * The Hono API server is NOT required — these tests exercise the rendered UI
 * only, and the frontend gracefully handles a missing backend (it shows
 * loading/error states for fetch calls).
 *
 * Run:  npx playwright test                (everything)
 *       npx playwright test e2e/           (just the deposit-flow suite)
 *       npx playwright test --headed       (debug)
 * Skip:  OMA_SKIP_E2E=1
 */

const PORT = Number(process.env.PORT ?? 3000)
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  // Use a single testDir + testMatch regex so we can scan both
  // directories in one config. `testDir` is the root the regex
  // resolves against. The `(?:^|\/)` anchors prevent accidentally
  // matching `e2e/` inside an unrelated path segment.
  testDir: '.',
  testMatch: /(?:^|\/)(?:e2e\/[^/]+\.spec\.ts|tests\/e2e\/[^/]+\.e2e\.spec\.ts)$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `npm run dev` runs from the same directory this config lives in (the
    // Next.js app root). reuseExistingServer lets a developer already running
    // `npm run dev` skip the boot.
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})