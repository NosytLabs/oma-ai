import { chromium } from '/Users/tyson/Desktop/Code/products/OMA-AI/app/node_modules/@playwright/test/index.mjs';
import { mkdirSync } from 'fs';

const OUT = '/Users/tyson/Desktop/Code/products/OMA-AI/.audit-r5/screenshots';
mkdirSync(OUT, { recursive: true });

const pages = [
  { name: 'home', url: '/' },
  { name: 'chat', url: '/chat' },
  { name: 'chat-mode-image', url: '/chat?mode=image' },
  { name: 'chat-mode-video', url: '/chat?mode=video' },
  { name: 'login', url: '/login' },
  { name: 'models', url: '/models' },
  { name: 'pricing', url: '/pricing' },
  { name: 'docs', url: '/docs' },
  { name: 'getting-started', url: '/getting-started' },
  { name: 'deposit', url: '/deposit' },
  { name: 'dashboard', url: '/dashboard' },
  { name: 'settings', url: '/settings' },
  { name: 'admin', url: '/admin' },
  { name: 'about', url: '/about' },
  { name: 'faq', url: '/faq' },
  { name: 'glossary', url: '/glossary' },
  { name: 'privacy', url: '/privacy' },
  { name: 'terms', url: '/terms' },
];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`[${page.url()}] ${msg.text()}`);
});
page.on('pageerror', (err) => consoleErrors.push(`[${page.url()}] PAGEERROR ${err.message}`));

for (const p of pages) {
  try {
    await page.goto(`http://localhost:3002${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${p.name}-1440.jpeg`, fullPage: false });
    console.log(`✓ ${p.name}`);
  } catch (e) {
    console.log(`✗ ${p.name}: ${e.message.slice(0, 80)}`);
  }
}

// Mobile
await ctx.close();
const mctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const mpage = await mctx.newPage();
for (const p of ['', 'chat', 'models', 'pricing', 'login', 'deposit', 'docs']) {
  try {
    await mpage.goto(`http://localhost:3002/${p}`, { waitUntil: 'networkidle', timeout: 15000 });
    await mpage.waitForTimeout(500);
    await mpage.screenshot({ path: `${OUT}/${p}-mobile.jpeg`, fullPage: false });
    console.log(`✓ ${p} (mobile)`);
  } catch (e) {
    console.log(`✗ ${p} (mobile): ${e.message.slice(0, 80)}`);
  }
}

console.log('\n=== CONSOLE ERRORS ===');
if (consoleErrors.length === 0) console.log('  (none)');
else consoleErrors.forEach((e) => console.log('  ' + e));

await browser.close();
