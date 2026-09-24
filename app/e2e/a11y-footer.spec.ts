import { test, expect } from '@playwright/test';

/**
 * Footer tap targets.
 *
 * The footer's bottom utility row renders a standalone "github" link at
 * 52x18 — below the WCAG 2.5.8 Target Size (Minimum) floor of 24x24. It is
 * the only undersized control left in the shared chrome after the pricing
 * sort buttons and model card CTAs were fixed, and it repeats on every route
 * that renders a footer.
 *
 * Inline prose links are exempt from 2.5.8 and are deliberately not asserted
 * on here; only standalone controls in the footer are checked.
 */

test.describe('Footer controls', () => {
  test('the github link meets the minimum tap size', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /github/i }).last();
    await expect(link).toBeVisible();

    const box = await link.boundingBox();
    expect(box, 'footer github link has no box').not.toBeNull();
    expect(
      box!.height,
      `footer github link is ${Math.round(box!.width)}x${Math.round(box!.height)}, under 24px tall`,
    ).toBeGreaterThanOrEqual(24);
  });

  test('no standalone footer control is under the minimum', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    const offenders = await footer.evaluate((el) => {
      const bad: string[] = [];
      el.querySelectorAll('a[href],button,[role=button]').forEach((n) => {
        const r = n.getBoundingClientRect();
        if (!r.width || !r.height) return;
        // links inside a sentence are exempt from 2.5.8
        if (n.tagName === 'A' && n.closest('p,li,dd')) return;
        if (r.height < 24 || r.width < 24) {
          bad.push(`${(n.textContent ?? '').trim().slice(0, 20) || n.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      });
      return bad;
    });
    expect(offenders, `undersized footer controls: ${offenders.join(', ')}`).toEqual([]);
  });

  test('the enlarged link does not break the footer layout', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /github/i }).last();
    const box = await link.boundingBox();
    // still a compact inline affordance, just now actually hittable
    expect(box!.width, 'link grew unreasonably wide').toBeLessThan(120);
  });
});
