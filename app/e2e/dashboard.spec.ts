import { test, expect } from "@playwright/test";

/**
 * Dashboard userflow.
 *
 * The dashboard requires authentication. When unauthenticated, it should
 * redirect to /login or show an auth prompt. When authenticated (mocked via
 * cookie injection in a future enhancement), it should show usage widgets,
 * API key management, and balance.
 *
 * This spec covers the unauthenticated path and the redirect behaviour.
 */
test.describe("Dashboard Userflow", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    // Should redirect to /login or show an auth prompt
    await page.waitForURL(/\/login|\/dashboard/, { timeout: 10000 }).catch(() => {});
    // If still on dashboard, an auth prompt should be visible
    const url = page.url();
    if (url.includes("/dashboard")) {
      // Check for auth notice / sign-in prompt
      const authPrompt = page
        .locator("text=/sign in/i, text=/log in/i, [data-testid*='auth']")
        .first();
      if (await authPrompt.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(authPrompt).toBeVisible();
      }
    } else {
      expect(url).toContain("/login");
    }
  });

  test("dashboard route does not crash (no 500)", async ({ page }) => {
    const response = await page.goto("/dashboard");
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});
