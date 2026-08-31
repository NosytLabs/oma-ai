import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const DIR = '/tmp/oma-deep';
mkdir();

async function mkdir() {
  const { mkdirSync } = await import('fs');
  mkdirSync(DIR, { recursive: true });
}

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
  wide: { width: 1920, height: 1080 },
};

const PAGES_AUTHED = ['/dashboard?demo=1', '/dashboard?demo=1&tab=usage', '/dashboard?demo=1&tab=api-keys', '/settings'];
const PAGES_PUBLIC = ['/', '/models', '/models/openai-gpt-56-sol', '/pricing', '/chat', '/docs', '/docs#quickstart', '/deposit', '/login', '/about', '/faq', '/getting-started', '/glossary', '/contact', '/terms', '/privacy'];

const issues = [];

async function screenshotView(browser, vp, page, path, fullPage = true) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vp], deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const consoleErrors = [];
  p.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  p.on('pageerror', e => consoleErrors.push(`PAGE ERROR: ${e.message}`));
  try {
    await p.goto(`${BASE}${page}`, { waitUntil: 'load', timeout: 20000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${DIR}/${path}`, fullPage });
    if (consoleErrors.length) {
      issues.push({ page, vp, errors: consoleErrors });
    }
    console.log(`  ✓ ${vp.padEnd(7)} ${page}`);
  } catch (e) {
    console.log(`  ✗ ${vp.padEnd(7)} ${page}: ${e.message.slice(0, 80)}`);
    issues.push({ page, vp, errors: [e.message] });
  }
  await ctx.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  console.log('=== PUBLIC ROUTES × 4 BREAKPOINTS ===');
  for (const page of PAGES_PUBLIC) {
    const slug = page.replace(/[/?#=]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'home';
    for (const vp of Object.keys(VIEWPORTS)) {
      await screenshotView(browser, vp, page, `public-${slug}-${vp}.png`);
    }
  }

  console.log('\n=== DEMO ROUTES × 4 BREAKPOINTS ===');
  for (const page of PAGES_AUTHED) {
    const slug = page.replace(/[/?#=]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'auth';
    for (const vp of Object.keys(VIEWPORTS)) {
      await screenshotView(browser, vp, page, `auth-${slug}-${vp}.png`);
    }
  }

  console.log('\n=== CHAT INTERACTION FLOW ===');
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(`PAGE ERROR: ${e.message}`));
  try {
    await p.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 20000 });
    await p.waitForTimeout(2000);
    await p.screenshot({ path: `${DIR}/chat-initial.png`, fullPage: false });
    // Try to dismiss welcome
    const dismissBtn = await p.$('button[aria-label="Dismiss welcome banner"]');
    if (dismissBtn) {
      await dismissBtn.click();
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${DIR}/chat-after-dismiss.png`, fullPage: false });
    }
    // Type a message
    const textarea = await p.$('textarea');
    if (textarea) {
      await textarea.fill('What is OpenAI-compatible inference?');
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${DIR}/chat-typed.png`, fullPage: false });
    }
    console.log('  ✓ chat interaction captured');
  } catch (e) {
    console.log(`  ✗ chat flow: ${e.message.slice(0, 100)}`);
    issues.push({ page: '/chat', vp: 'interaction', errors: [e.message] });
  }
  await ctx.close();

  if (errs.length) {
    console.log('\n=== CHAT CONSOLE ERRORS ===');
    errs.forEach(e => console.log(`  ! ${e.slice(0, 200)}`));
    issues.push({ page: '/chat', vp: 'console', errors: errs });
  }

  await browser.close();

  writeFileSync(`${DIR}/issues.json`, JSON.stringify(issues, null, 2));
  console.log(`\n=== SUMMARY ===`);
  console.log(`Screenshots: ${DIR}`);
  console.log(`Issues found: ${issues.length}`);
  if (issues.length > 0) {
    issues.slice(0, 10).forEach(i => {
      console.log(`  [${i.vp}] ${i.page}: ${i.errors.length} error(s)`);
    });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
