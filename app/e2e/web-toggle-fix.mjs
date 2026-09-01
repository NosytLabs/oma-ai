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

// Send message to start streaming
const ta = page.locator('textarea').first();
await ta.fill('Tell me a long story about a dragon. Include many details.');
console.log('Sending message...');
await page.keyboard.press('Enter');

// Wait until streaming starts (loading=true) — the Stop button appears
await page.waitForSelector('button[aria-label="Stop generation"]', { timeout: 10000 });
console.log('Streaming started, Stop button visible');

// Now try clicking WEB toggle WHILE streaming
const webBtn = page.locator('button[aria-label*="Toggle web search"]');
const webVisible = await webBtn.isVisible();
console.log(`WEB toggle visible during stream: ${webVisible}`);

try {
  await webBtn.click({ timeout: 5000 });
  console.log('✅ WEB toggle clicked successfully during stream');
  const pressed = await webBtn.getAttribute('aria-pressed');
  console.log(`   aria-pressed: ${pressed}`);
} catch (e) {
  console.log(`❌ WEB toggle click failed: ${e.message.slice(0, 200)}`);
}

// Also try clicking UI toggle
const uiBtn = page.locator('button[aria-label*="Toggle UI mode"]');
try {
  await uiBtn.click({ timeout: 3000 });
  console.log('✅ UI toggle clicked successfully during stream');
} catch (e) {
  console.log(`❌ UI toggle click failed: ${e.message.slice(0, 200)}`);
}

await page.screenshot({ path: '/tmp/pw-flows/stream-with-web-on.png' });

console.log('\nErrors:');
errs.forEach(e => console.log(`  ${e}`));
if (errs.length === 0) console.log('  (none)');

await browser.close();
