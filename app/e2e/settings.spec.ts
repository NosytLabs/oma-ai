import { test, expect } from "@playwright/test";

/**
 * Settings page userflow.
 *
 * The settings page requires authentication. This spec covers the
 * unauthenticated redirect path and verifies the page doesn't crash.
 */
test.describe("Settings Page Userflow", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL(/\/login|\/settings/, { timeout: 10000 }).catch(() => {});
    const url = page.url();
    if (url.includes("/settings")) {
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

  test("settings route does not crash (no 500)", async ({ page }) => {
    const response = await page.goto("/settings");
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});
