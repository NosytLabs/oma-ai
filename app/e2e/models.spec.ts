import { test, expect } from '@playwright/test';

test.describe('Models Page', () => {
  test('loads and displays model cards', async ({ page }) => {
    await page.goto('/models');
    
    // Check that the page loaded successfully
    await expect(page).toHaveURL(/.*\/models/);

    // Look for indicative text of model cards, or specific elements
    // Adjust selector to match actual Model card elements
    const modelCard = page.locator('text=Model').first();
    await expect(modelCard).toBeVisible();
  });
});
