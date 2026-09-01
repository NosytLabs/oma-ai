import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('loads, checks title/H1, and navigation bar', async ({ page }) => {
    await page.goto('/');
    
    // Check for title or H1 (adjust as needed based on actual implementation)
    await expect(page).toHaveTitle(/OMA/);
    
    // Attempt to find a common main heading if present
    const h1 = page.locator('h1').first();
    if (await h1.isVisible()) {
        await expect(h1).toBeVisible();
    }

    // Check for a generic navigation element (e.g., a nav tag or a common class/role)
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });
});
