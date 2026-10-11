import { test, expect } from "@playwright/test";

test.describe("Unified account settings", () => {
  test("preserves demo isolation through legacy settings bookmarks", async ({ page }) => {
    await page.goto("/settings?demo=1&tab=privacy");
    await expect(page).toHaveURL(/\/dashboard\?.*tab=settings.*section=danger/);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete account", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Download JSON" })).toBeDisabled();
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/demo=1/);
  });

  test("opens API key bookmarks in their dashboard tab", async ({ page }) => {
    await page.goto("/settings?demo=1&tab=keys");
    await expect(page).toHaveURL(/\/dashboard\?.*tab=api-keys/);
    await expect(page.getByRole("tab", { name: "API Keys", exact: true })).toHaveAttribute("aria-selected", "true");
  });
});
