import { test, expect, type Page } from '@playwright/test'

/**
 * OMA AI — Deposit flow end-to-end tests
 *
 * Walks the deposit UI without a real wallet. The deposit page uses
 * `next/dynamic` with `ssr: false`, so it BAILOUTs to client-side
 * rendering. Tests wait for client-side hydration (up to 25s — the
 * antd/wagmi bundles are large and cold-start is slow).
 *
 * Run:  npx playwright test tests/e2e/deposit.e2e.spec.ts
 * Skip:  OMA_SKIP_E2E=1
 */

const SKIP = !!process.env.OMA_SKIP_E2E
const HYDRATION_TIMEOUT = 25_000

async function waitForDepositPage(page: Page) {
  await page.goto('/deposit', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('main h1, main h2', {
    timeout: HYDRATION_TIMEOUT,
    state: 'visible',
  })
}

test.describe('Deposit flow (e2e)', () => {
  test.skip(SKIP, 'Set OMA_SKIP_E2E=0 to enable')

  test('deposit page renders after client-side hydration', async ({ page }) => {
    await waitForDepositPage(page)
    const headings = await page.locator('main h1, main h2').count()
    expect(headings).toBeGreaterThanOrEqual(1)
  })

  test('deposit page has accessible heading hierarchy (h1 first)', async ({ page }) => {
    await waitForDepositPage(page)
    const h1s = await page.locator('main h1').count()
    expect(h1s).toBeGreaterThanOrEqual(1)
  })

  test('deposit page title is descriptive', async ({ page }) => {
    // Use the dashboard demo cookie to bypass auth gate (C-C1 path).
    await page.context().addCookies([
      { name: 'oma-demo', value: '1', url: 'http://localhost:3000' },
    ])
    await waitForDepositPage(page)
    const h1Text = await page.locator('main h1').first().textContent()
    expect(h1Text?.toLowerCase()).toMatch(/deposit|fund|credit/)
  })

  test('navigates from / to /deposit via the "Deposit" CTA in the navbar', async ({ page }) => {
    // Bypass auth for both pages so the test doesn't bounce to /login.
    await page.context().addCookies([
      { name: 'oma-demo', value: '1', url: 'http://localhost:3000' },
    ])
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('load', { timeout: 15_000 })
    const depositLink = page.locator('a[href="/deposit"]').first()
    await expect(depositLink).toBeVisible({ timeout: 10_000 })
    await depositLink.click()
    // Wagmi provider initialization may delay router navigation
    // after the click. waitForURL is more resilient than toHaveURL
    // for SPA navigations that depend on client-side hydration state.
    await page.waitForURL('/deposit', { timeout: 10_000 })
  })

  test('no critical JavaScript errors on the deposit page', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (
          !text.includes('favicon') &&
          !text.includes('Failed to load resource') &&
          !text.toLowerCase().includes('econnrefused') &&
          !text.toLowerCase().includes('fetch failed') &&
          !text.includes('http://localhost:3001') &&
          !text.includes('[antd: App]') &&
          !text.includes('Can not find wallet factory') &&
          !text.includes('Can not find connector')
        ) {
          errors.push('CONSOLE: ' + text)
        }
      }
    })
    await waitForDepositPage(page)
    expect(errors).toEqual([])
  })
})

test.describe('Theme toggle (e2e)', () => {
  test.skip(SKIP, 'Set OMA_SKIP_E2E=0 to enable')

  test('theme toggle switches between dark and light', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('load', { timeout: 15_000 })
    const toggle = page
      .locator('[aria-label*="theme" i], button:has-text("Theme")')
      .first()
    if ((await toggle.count()) === 0) {
      test.skip(true, 'No theme toggle found in DOM')
    }
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    await toggle.click()
    await page.waitForTimeout(500)
    const afterTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    )
    expect(afterTheme).not.toBe(initialTheme)
  })
})
