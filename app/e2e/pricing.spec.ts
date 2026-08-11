import { test, expect } from '@playwright/test';

test.describe('Pricing Page', () => {
  test('loads and displays the pricing table', async ({ page }) => {
    await page.goto('/pricing');
    
    // Check that the page loaded successfully
    await expect(page).toHaveURL(/.*\/pricing/);

    // Look for indicative elements of a pricing table, e.g., words like "Pricing", "Plan", "$", or table elements
    const pricingHeading = page.locator('text=Pricing').first();
    await expect(pricingHeading).toBeVisible();

    // Check for a Plan or Price indicator
    const priceElement = page.locator('text=$').first();
    await expect(priceElement).toBeVisible();
  });
});
