import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(`PE: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errs.push(`CE: ${m.text().slice(0,200)}`); });
page.on('response', r => { 
  if (r.url().includes('/v1/search') || r.url().includes('/v1/chat')) {
    console.log(`  ${r.status()} ${r.request().method()} ${r.url().slice(r.url().indexOf('/v1'))}`);
  }
});

await page.goto('http://localhost:3000/chat');
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(800);

// Turn on WEB mode first
await page.click('button[aria-label*="Toggle web search"]');
await page.waitForTimeout(200);

// Type a web-search-requiring message
await page.locator('textarea').first().fill('What is the latest news about AI?');
console.log('Sending web-search query...');
await page.keyboard.press('Enter');

// Wait for response
await page.waitForTimeout(15000);
await page.screenshot({ path: '/tmp/pw-flows/web-search-result.png', fullPage: false });

const bodyText = await page.locator('body').textContent();
const hasSources = /Source|via|search|web/i.test(bodyText || '');
const hasWikipedia = bodyText?.includes('wikipedia') || bodyText?.includes('http');
console.log(`Web search mentions sources: ${hasSources}`);
console.log(`Has URLs: ${hasWikipedia}`);

// Find source sections
const sourceElements = await page.locator('a[href*="http"], button:has-text("Source")').count();
console.log(`Source link/button count: ${sourceElements}`);

console.log('\nErrors:');
errs.forEach(e => console.log(`  ${e}`));
if (errs.length === 0) console.log('  (none)');

await browser.close();
