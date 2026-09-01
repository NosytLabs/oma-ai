import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(`PE: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errs.push(`CE: ${m.text().slice(0,200)}`); });

await page.goto('http://localhost:3000/chat');
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(800);

// Enable UI mode (A2UI)
console.log('=== Enabling UI mode ===');
await page.click('button[aria-label*="Toggle UI mode"]');
await page.waitForTimeout(300);
const uiPressed = await page.locator('button[aria-label*="Toggle UI mode"]').getAttribute('aria-pressed');
console.log(`UI mode aria-pressed: ${uiPressed}`);

// Send a UI-requiring prompt
await page.locator('textarea').first().fill('Design a contact form with name, email, and submit button');
await page.keyboard.press('Enter');
console.log('Sent UI-mode request...');

// Wait for A2UI surface
await page.waitForTimeout(20000);
await page.screenshot({ path: '/tmp/pw-flows/a2ui-result.png', fullPage: false });

// Check for A2UI rendered components
const a2uiSurface = await page.locator('[data-a2ui-version]').count();
console.log(`A2UI surfaces rendered: ${a2uiSurface}`);

const textFields = await page.locator('input[type="text"]').count();
console.log(`TextField inputs in chat: ${textFields}`);

const a2uiVersion = await page.locator('[data-a2ui-version]').first().getAttribute('data-a2ui-version').catch(() => null);
console.log(`A2UI version: ${a2uiVersion}`);

console.log('\nErrors:');
errs.forEach(e => console.log(`  ${e}`));
if (errs.length === 0) console.log('  (none)');

await browser.close();
