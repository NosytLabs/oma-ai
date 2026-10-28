import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const DIR = process.env.DIR || `${process.env.TMPDIR || process.env.TEMP || '/tmp'}/oma-audit`;
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'models', path: '/models' },
  { name: 'models-detail-claude', path: '/models/claude-opus-5' },
  { name: 'models-detail-kimi', path: '/models/kimi-k3' },
  { name: 'pricing', path: '/pricing' },
  { name: 'chat', path: '/chat' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'settings', path: '/settings' },
  { name: 'docs', path: '/docs' },
  { name: 'deposit', path: '/deposit' },
  { name: 'about', path: '/about' },
  { name: 'faq', path: '/faq' },
  { name: 'contact', path: '/contact' },
  { name: 'getting-started', path: '/getting-started' },
  { name: 'login', path: '/login' },
  { name: 'terms', path: '/terms' },
  { name: 'privacy', path: '/privacy' },
  { name: 'glossary', path: '/glossary' },
];

async function main() {
	mkdirSync(DIR, { recursive: true });

	const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  let failures = 0;
  try {
    for (const [label, viewport] of [
      ['desktop', { width: 1440, height: 900 }],
      ['mobile', { width: 375, height: 812 }],
    ]) {
      console.log(`\n=== ${label.toUpperCase()} (${viewport.width}x${viewport.height}) ===`);
      const context = await browser.newContext({ viewport });
      try {
        for (const page of PAGES) {
          let tab;
          try {
            tab = await context.newPage();
            // /chat can hold a stream open, so networkidle is not suitable.
            const response = await tab.goto(`${BASE}${page.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            if (!response || !response.ok()) throw new Error(`Navigation failed: HTTP ${response?.status() ?? 'no response'}`);
            await tab.waitForTimeout(2500);
            const path = `${DIR}/${page.name}-${label}.png`;
            await tab.screenshot({ path, fullPage: true });
            console.log(`  ✓ ${page.name}: ${path}`);
          } catch (error) {
            failures++;
            console.error(`  ✗ ${page.name}: ${error.message}`);
          } finally {
            await tab?.close();
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\nScreenshots saved to ${DIR}; ${failures} capture(s) failed.`);
  if (failures) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
