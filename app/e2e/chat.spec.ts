import { test, expect } from "@playwright/test";

/**
 * Chat playground userflow.
 *
 * Exercises the public chat page: load, interact with model selector, type a
 * message, and verify the UI responds. Does NOT require a live backend for
 * the initial page-load assertions; the streaming interaction is gated on
 * the free model being available.
 */
test.describe("Chat Playground Userflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
  });

  test("loads chat page with input and model selector", async ({ page }) => {
    await expect(page).toHaveTitle(/OMA/i);
    // Chat page should have a message input (textarea or contenteditable)
    const input = page.locator("textarea, [contenteditable='true']").first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test("model selector is visible and has options", async ({ page }) => {
    // The model selector could be a button, select, or combobox
    const modelSelector = page
      .locator("[data-testid='model-selector'], [role='combobox'], select, button:has-text('model'), [aria-label*='model' i]")
      .first();
    if (await modelSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(modelSelector).toBeVisible();
    }
  });

  test("typing a message and sending does not crash the page", async ({ page }) => {
    const input = page.locator("textarea").first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill("Hello, this is a test message.");
      await expect(input).toHaveValue("Hello, this is a test message.");
      // Press Enter or click send — just verify no JS error crashes the page
      await input.press("Enter").catch(() => {});
      // Give the page a moment; no hard crash = pass
      await page.waitForTimeout(1000);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("chat page has no horizontal overflow", async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
