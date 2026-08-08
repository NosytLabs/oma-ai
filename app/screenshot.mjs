/* eslint-disable no-console */
import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const routes = ['/', '/pricing', '/models', '/chat'];
  
  for (const route of routes) {
    try {
      console.log(`Navigating to http://localhost:3000${route}`);
      await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({ path: `screenshot-${route === '/' ? 'home' : route.substring(1)}.png`, fullPage: true });
      console.log(`Screenshot saved for ${route}`);
    } catch (e) {
      console.error(`Failed to capture ${route}:`, e.message);
    }
  }
  
  await browser.close();
})();
