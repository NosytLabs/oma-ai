import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/tmp/pw-flows';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const allErrors = [];
page.on('pageerror', (e) => allErrors.push({ page: page.url(), msg: e.message }));
page.on('console', (m) => { if (m.type() === 'error') allErrors.push({ page: page.url(), console: m.text().slice(0,200) }); });
page.on('requestfailed', (r) => allErrors.push({ page: page.url(), reqfail: `${r.url()} ${r.failure()?.errorText}` }));

const PAGES = [
  { path: '/', name: '01-home' },
  { path: '/models', name: '02-models' },
  { path: '/chat', name: '03-chat' },
  { path: '/pricing', name: '04-pricing' },
  { path: '/docs', name: '05-docs' },
  { path: '/login', name: '06-login' },
  { path: '/dashboard', name: '07-dashboard' },
  { path: '/settings', name: '08-settings' },
  { path: '/admin', name: '09-admin' },
  { path: '/deposit', name: '10-deposit' },
  { path: '/getting-started', name: '11-getting-started' },
  { path: '/glossary', name: '12-glossary' },
  { path: '/faq', name: '13-faq' },
];

for (const p of PAGES) {
  console.log(`\n=== ${p.path} ===`);
  const before = allErrors.length;
  try {
    const start = Date.now();
    const resp = await page.goto(`http://localhost:3000${p.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const ms = Date.now() - start;
    const status = resp?.status();
    console.log(`  status: ${status} (${ms}ms)`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: false });
    
    // Try to capture any visible errors
    const visibleErrors = await page.locator('[role="alert"]').allTextContents().catch(() => []);
    if (visibleErrors.length > 0) {
      console.log(`  ⚠ alerts: ${visibleErrors.length}`);
      visibleErrors.forEach(e => console.log(`    - ${e.slice(0, 100)}`));
    }
    
    const newErrors = allErrors.slice(before);
    if (newErrors.length > 0) {
      console.log(`  ⚠ ${newErrors.length} new errors:`);
      newErrors.forEach(e => console.log(`    - ${JSON.stringify(e).slice(0, 200)}`));
    }
    
    // Get page title
    const title = await page.title();
    console.log(`  title: ${title.slice(0, 60)}`);
    
    // Get h1
    const h1 = await page.locator('h1').first().textContent().catch(() => '');
    if (h1) console.log(`  h1: ${h1.trim().slice(0, 80)}`);
    
  } catch (e) {
    console.log(`  ✗ ERROR: ${e.message.slice(0, 200)}`);
  }
}

console.log('\n=== SUMMARY ===');
console.log(`Total errors: ${allErrors.length}`);
const errorTypes = {};
for (const e of allErrors) {
  const key = Object.keys(e)[0];
  errorTypes[key] = (errorTypes[key] || 0) + 1;
}
console.log('By type:', errorTypes);

await browser.close();
