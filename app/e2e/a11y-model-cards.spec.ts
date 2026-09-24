import { test, expect } from '@playwright/test';

/**
 * Tap-target audit beyond the pricing header.
 *
 * The standalone controls on a model card are the page's primary actions —
 * open the detail page, and launch a chat with that model — and they render
 * 18-19px tall, under the WCAG 2.5.8 Target Size (Minimum) floor of 24x24.
 * Measured on /models at every width: "Try in chat" is 91x18.
 *
 * Scope note: this deliberately does NOT assert on inline prose links. Links
 * inside a sentence are explicitly exempt from 2.5.8, and the FAQ's answer
 * links measure 17px while being perfectly valid. Anchoring on standalone
 * controls keeps the test meaningful instead of noisy.
 */
const MIN_TAP_PX = 24;

test.describe('Model card controls', () => {
  test('"Try in chat" meets the minimum tap size', async ({ page }) => {
    await page.goto('/models');
    const cta = page.getByRole('link', { name: /try in chat/i }).first();
    await expect(cta).toBeVisible();

    const box = await cta.boundingBox();
    expect(box, 'the first available model must expose a Try in chat CTA').not.toBeNull();
    expect(
      box!.height,
      `"Try in chat" is ${Math.round(box!.width)}x${Math.round(box!.height)}, under ${MIN_TAP_PX}px tall`,
    ).toBeGreaterThanOrEqual(MIN_TAP_PX);
  });

  test('model name links meet the minimum tap size', async ({ page }) => {
    await page.goto('/models');
    const link = page.locator('article a[href^="/models/"]').first();
    await expect(link).toBeVisible();

    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(
      box!.height,
      `model title link is ${Math.round(box!.height)}px tall`,
    ).toBeGreaterThanOrEqual(MIN_TAP_PX);
  });

  test('no standalone control on a model card is under the minimum', async ({ page }) => {
    await page.goto('/models');
    const offenders = await page.locator('article').first().evaluate((card) => {
      const bad: string[] = [];
      card.querySelectorAll('a[href],button,[role=button]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // inline links inside a sentence are exempt
        if (el.tagName === 'A' && el.closest('p')) return;
        if (r.height < 24 || r.width < 24) {
          bad.push(`${(el.textContent ?? '').trim().slice(0, 18) || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      });
      return bad;
    });
    expect(offenders, `undersized controls: ${offenders.join(', ')}`).toEqual([]);
  });
});
