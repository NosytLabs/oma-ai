import { test, expect } from '@playwright/test';

/**
 * The chat playground must fit the viewport.
 *
 * The root layout sets `min-h-dvh`, which lets the flex chain size to
 * content. Before the shell was explicitly bounded, the document grew past
 * the viewport and pushed the composer's metadata row — remaining guest
 * quota, token count, cost estimate — below the fold. Measured overflow was
 * 19px at 390x844, 74px at 1440x900 and 142px at 1280x720.
 *
 * The shell subtracts the 57px Navbar to get its height, so this suite
 * doubles as the guard on that constant: if the Navbar ever changes height,
 * these fail loudly instead of the composer being quietly clipped.
 */

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test.describe(`chat viewport: ${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('the page does not scroll the document', async ({ page }) => {
      await page.goto('/chat');
      await page.waitForSelector('textarea', { timeout: 20_000 });
      await page.waitForTimeout(1_500);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      expect(
        overflow,
        `document overflows the viewport by ${overflow}px; the message list should scroll instead`,
      ).toBeLessThanOrEqual(1);
    });

    test('the composer and its metadata stay on screen', async ({ page }) => {
      await page.goto('/chat');
      const textarea = page.locator('textarea').first();
      await expect(textarea).toBeVisible();

      // The quota/token/cost readout lives in the composer's footer. Locate
      // it by its stable copy rather than a test id.
      const meta = page.getByText(/cr est/i).first();
      await expect(meta).toBeVisible();

      const vh = page.viewportSize()!.height;
      for (const [label, locator] of [
        ['textarea', textarea],
        ['cost/quota readout', meta],
      ] as const) {
        const box = await locator.boundingBox();
        expect(box, `${label} has no box`).not.toBeNull();
        expect(
          box!.y + box!.height,
          `${label} bottom (${Math.round(box!.y + box!.height)}) is past the ${vh}px viewport`,
        ).toBeLessThanOrEqual(vh + 1);
        expect(box!.y, `${label} starts above the viewport`).toBeGreaterThanOrEqual(-1);
      }
    });

    test('the send button is reachable without page scroll', async ({ page }) => {
      await page.goto('/chat');
      const send = page.getByRole('button', { name: /send message/i }).first();
      await expect(send).toBeVisible();
      await send.scrollIntoViewIfNeeded();
      // After scrolling the button into view it must not require the
      // document itself to have scrolled.
      const scrolled = await page.evaluate(() => window.scrollY);
      expect(scrolled, `page scrolled ${scrolled}px to reach the send button`).toBeLessThanOrEqual(1);
    });
  });
}
