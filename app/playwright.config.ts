import { defineConfig, devices } from "@playwright/test";

/**
 * OMA AI — Playwright config
 *
 * Scans e2e/ (user journeys) and tests/e2e/ (WCAG audits).
 * Boots the Next.js dev server if none is running on the configured base URL.
 * The Hono API server is NOT required — these tests exercise the rendered UI
 * only, and the frontend gracefully handles a missing backend.
 *
 * Run:  npx playwright test
 *       npx playwright test e2e/
 *       npx playwright test --headed
 * Skip:  OMA_SKIP_E2E=1
 */

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: ".",
	// Match both e2e layouts without picking up vitest unit tests under src/.
	testMatch: [
		"**/e2e/**/*.spec.ts",
		"**/tests/e2e/**/*.e2e.spec.ts",
	],
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		// `npm run dev` runs from the same directory this config lives in (the
		// Next.js app root). reuseExistingServer lets a developer already running
		// `npm run dev` skip the boot.
		command: "npm run dev",
		url: BASE_URL,
		reuseExistingServer: true,
		timeout: 120_000,
	},
});
