import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("mobile docs search stays readable and can be closed with the keyboard", async ({ page }) => {
    await page.goto("/docs");
    const trigger = page.getByRole("button", { name: "Search docs ⌘K" });
    await expect(trigger.getByText("Search docs", { exact: true })).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Search documentation" });
    const query = dialog.getByRole("textbox", { name: "Search query" });
    await query.fill("streaming");
    await expect(query).toBeFocused();
    await query.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close search" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("chat parameters are available before the first message on mobile", async ({ page }) => {
    await page.goto("/chat");
    const model = page.getByRole("button", { name: /Select AI model/ });
    await expect(model).toBeVisible();
    expect((await model.boundingBox())!.width).toBeGreaterThan(190);
    await page.getByRole("button", { name: "More chat actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Parameters", exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Compare models", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
