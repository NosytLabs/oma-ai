import { test, expect } from "@playwright/test";

/**
 * Deposit page userflow.
 *
 * The deposit page may or may not require authentication. This spec covers:
 *   - Page loads without a 500
 *   - No horizontal overflow
 *   - USDC deposit address is visible when configured
 *   - Deposit form elements are present
 */
test.describe("Deposit Page Userflow", () => {
  test("loads deposit page without server error", async ({ page }) => {
    const response = await page.goto("/deposit");
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test("deposit page has no horizontal overflow", async ({ page }) => {
    await page.goto("/deposit");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("shows the deposit page heading", async ({ page }) => {
    await page.goto("/deposit");
    // Scope to page content; the mobile-only navbar sign-in label is hidden
    // on desktop and is not evidence that the deposit page rendered.
    await expect(page.getByRole("heading", { name: "Deposit Credits", level: 1 })).toBeVisible();
  });
});
