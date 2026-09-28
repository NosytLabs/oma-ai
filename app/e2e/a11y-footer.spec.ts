import { test, expect } from "@playwright/test";

test.describe("Footer controls", () => {
  test("shared navigation omits GitHub and the site-online badge", async ({ page }) => {
    await page.goto("/");
    const chrome = page.locator("header, footer");
    await expect(chrome.getByRole("link", { name: /github/i })).toHaveCount(0);
    await expect(chrome.getByText(/site online/i)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Status", exact: true })).toBeVisible();
  });

  test("standalone footer links meet the minimum tap size", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo", { name: "Site footer" });
    await expect(footer).toBeVisible();
    const offenders = await footer.evaluate((element) =>
      Array.from(element.querySelectorAll("a[href],button")).flatMap((control) => {
        const box = control.getBoundingClientRect();
        if (!box.width || !box.height || (box.height >= 24 && box.width >= 24)) return [];
        return [`${control.textContent?.trim()}: ${Math.round(box.width)}×${Math.round(box.height)}`];
      }),
    );
    expect(offenders).toEqual([]);
  });
});
