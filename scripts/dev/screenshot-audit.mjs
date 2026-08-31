import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3000';
const DIR = '/tmp/oma-audit';
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'models', path: '/models' },
  { name: 'pricing', path: '/pricing' },
  { name: 'chat', path: '/chat' },
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
  const browser = await chromium.launch({ headless: true });
  
  // Desktop screenshots
  console.log('=== DESKTOP (1440x900) ===');
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const page of PAGES) {
    try {
      const p = await desktopCtx.newPage();
      await p.goto(`${BASE}${page.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await p.waitForTimeout(1000);
      const path = `${DIR}/${page.name}-desktop.png`;
      await p.screenshot({ path, fullPage: true });
      console.log(`  ✓ ${page.name}: ${path}`);
      await p.close();
    } catch (e) {
      console.log(`  ✗ ${page.name}: ${e.message}`);
    }
  }
  await desktopCtx.close();

  // Mobile screenshots
  console.log('\n=== MOBILE (375x812) ===');
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  for (const page of PAGES) {
    try {
      const p = await mobileCtx.newPage();
      await p.goto(`${BASE}${page.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await p.waitForTimeout(1000);
      const path = `${DIR}/${page.name}-mobile.png`;
      await p.screenshot({ path, fullPage: true });
      console.log(`  ✓ ${page.name}: ${path}`);
      await p.close();
    } catch (e) {
      console.log(`  ✗ ${page.name}: ${e.message}`);
    }
  }
  await mobileCtx.close();
  
  await browser.close();
  console.log('\nDone! Screenshots saved to /tmp/oma-audit/');
}

main().catch(e => { console.error(e); process.exit(1); });
