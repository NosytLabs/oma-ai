import { test, expect } from '@playwright/test';

/**
 * Tap-target audit for the pricing table's sort controls.
 *
 * Measured live at a narrow viewport: the four header sort buttons were
 * uneven — "Model" and "Ctx" rendered 16px tall while "Input / 1M" and
 * "Output / 1M" rendered 32px, because button height followed text
 * wrapping. Two consequences:
 *
 *   1. 16px is below the WCAG 2.5.8 Target Size (Minimum) floor of
 *      24x24 CSS px, so the only way to re-sort the table on a phone was
 *      an undersized control.
 *   2. Side by side in one header row, the controls looked mismatched.
 *
 * This asserts the real rendered box in a real browser, which jsdom
 * cannot do (it applies no Tailwind, so computed sizes are meaningless).
 */
const MIN_TAP_PX = 24;

test.describe('Pricing table sort controls', () => {
  test('every sort button meets the WCAG 2.5.8 minimum tap size', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('thead button').first()).toBeVisible();

    const buttons = page.locator('thead button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    const undersized: string[] = [];
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      const label = (await buttons.nth(i).innerText()).trim();
      if (!box) continue;
      if (box.height < MIN_TAP_PX || box.width < MIN_TAP_PX) {
        undersized.push(`${label} (${Math.round(box.width)}x${Math.round(box.height)})`);
      }
    }
    expect(undersized, `sort buttons below ${MIN_TAP_PX}px: ${undersized.join(', ')}`).toEqual([]);
  });

  test('sort buttons share one uniform height at desktop AND narrow widths', async ({ page }) => {
    // The mismatch only appeared once the header text wrapped: at a narrow
    // width "Input / 1M" and "Output / 1M" became two lines (32px) while
    // "Model" and "Ctx" stayed one line (16px). Assert both viewports.
    for (const width of [1280, 500]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/pricing');
      await expect(page.locator('thead button').first()).toBeVisible();

      const heights = await page.locator('thead button').evaluateAll((els) =>
        els.map((el) => ({
          label: (el.textContent ?? '').trim().slice(0, 14),
          h: Math.round(el.getBoundingClientRect().height),
        })),
      );

      const unique = [...new Set(heights.map((h) => h.h))];
      expect(
        unique.length,
        `at ${width}px, sort buttons have mismatched heights: ${heights
          .map((h) => `${h.label}=${h.h}`)
          .join(', ')}`,
      ).toBe(1);
    }
  });
});
