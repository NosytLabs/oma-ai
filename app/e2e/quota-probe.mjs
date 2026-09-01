import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const apiCalls = [];
page.on('response', async r => {
  if (r.url().includes('/v1/chat/completions') || r.url().includes('/api/chat')) {
    let body = '';
    try { body = await r.text(); } catch {}
    apiCalls.push({ url: r.url(), status: r.status(), body: body.slice(0, 600) });
  }
});

await page.goto('http://localhost:3000/chat');
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(1500);

console.log('=== Sending simple message as guest ===');
const ta = page.locator('textarea').first();
await ta.fill('Reply with the single word: ok');
await page.keyboard.press('Enter');

// Wait up to 30s for any response
const start = Date.now();
while (Date.now() - start < 30000 && apiCalls.length === 0) {
  await page.waitForTimeout(500);
}

console.log(`\nAPI calls: ${apiCalls.length}`);
apiCalls.forEach(c => {
  console.log(`\n--- ${c.status} ${c.url}`);
  console.log(c.body);
});

// Also look at any error banner
const errorText = await page.locator('[role="alert"], [data-error], .text-red-500, .text-danger').allTextContents();
console.log(`\nError banners: ${errorText.length}`);
errorText.slice(0, 3).forEach(t => console.log(`  ${t.slice(0, 200)}`));

// The actual chat response text
const lastMsg = page.locator('[data-message-author="assistant"]').last();
if (await lastMsg.count() > 0) {
  console.log(`\nLast assistant message:`);
  console.log(`  ${(await lastMsg.textContent())?.slice(0, 300)}`);
}

await page.screenshot({ path: '/tmp/pw-flows/quota-probe.png', fullPage: true });
await browser.close();
