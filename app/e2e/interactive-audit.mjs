import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`PE: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`CE: ${m.text().slice(0,200)}`); });

// =========== CHAT FLOW ===========
console.log('=== CHAT END-TO-END ===');
await page.goto('http://localhost:3000/chat');
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(800);

// Open dropdown, pick free model
await page.click('button[aria-label*="Select AI model"]');
await page.waitForTimeout(300);
const labels = await page.locator('[role="option"]').all().then(els => Promise.all(els.map(e => e.getAttribute('aria-label'))));
const freeIdx = labels.findIndex(l => l?.includes('free'));
console.log(`Free model selected: ${labels[freeIdx]}`);
await page.locator('[role="option"]').nth(freeIdx).click();
await page.waitForTimeout(300);

// Type message
const ta = page.locator('textarea').first();
const hasTa = await ta.count();
if (hasTa > 0) {
  await ta.fill('Reply with just "hello"');
  await page.keyboard.press('Enter');
  console.log('Sent message, waiting for response...');
  await page.waitForTimeout(6000);
  
  // Check for assistant text
  const allText = await page.locator('body').textContent();
  const hasResponse = allText?.includes('hello') || allText?.includes('Hello') || allText?.includes('Hi') || allText?.includes('greet');
  console.log(`Response received: ${hasResponse}`);
  
  // Check for sources if WEB mode was on
  await page.screenshot({ path: '/tmp/pw-flows/chat-after-send.png' });
}

// =========== WEB SEARCH ===========
console.log('\n=== WEB SEARCH FLOW ===');
// Toggle web search
const webBtn = await page.locator('button:has-text("WEB"), button:has-text("Web")').first().getAttribute('aria-pressed').catch(() => null);
if (webBtn !== null) {
  await page.locator('button:has-text("WEB"), button:has-text("Web")').first().click();
  await page.waitForTimeout(300);
  console.log('Toggled WEB mode');
}

await ta.fill('latest AI news');
await page.keyboard.press('Enter');
console.log('Sent web-search message, waiting...');
await page.waitForTimeout(8000);
await page.screenshot({ path: '/tmp/pw-flows/chat-websearch.png' });
const webText = await page.locator('body').textContent();
const hasSources = webText?.includes('Source') || webText?.includes('wikipedia') || webText?.includes('http');
console.log(`Sources/citations present: ${hasSources}`);

// =========== SETTINGS PANEL ===========
console.log('\n=== SETTINGS PANEL ===');
await page.goto('http://localhost:3000/chat');
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
const paramsBtn = page.locator('button[aria-label*="parameters" i], button[aria-label*="settings" i]').first();
const paramsCount = await paramsBtn.count();
console.log(`Settings button: ${paramsCount > 0 ? 'found' : 'missing'}`);
if (paramsCount > 0) {
  await paramsBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/pw-flows/chat-settings.png' });
}

// =========== MODELS PAGE ===========
console.log('\n=== MODELS CATALOG ===');
await page.goto('http://localhost:3000/models');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/pw-flows/models-page.png' });

const modelCount = await page.locator('a[href*="/models/"]').count();
console.log(`Model cards found: ${modelCount}`);

// =========== MOBILE VIEW ===========
console.log('\n=== MOBILE (375x812 iPhone X) ===');
const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const mobile = await mobileCtx.newPage();
await mobile.goto('http://localhost:3000/');
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: '/tmp/pw-flows/mobile-home.png' });
await mobile.goto('http://localhost:3000/chat');
await mobile.waitForTimeout(2000);
await mobile.screenshot({ path: '/tmp/pw-flows/mobile-chat.png' });
await mobile.goto('http://localhost:3000/models');
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: '/tmp/pw-flows/mobile-models.png' });

console.log('\n\n=== ALL ERRORS ===');
errors.forEach(e => console.log(`  ${e}`));
if (errors.length === 0) console.log('  (none)');

await browser.close();
