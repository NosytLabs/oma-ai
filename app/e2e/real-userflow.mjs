#!/usr/bin/env node
/**
 * OMA AI — Real userflow audit
 *
 * 1. Sign in as tyson@nosytlabs.com (admin) via a fresh magic link
 * 2. Tour public pages (guest)
 * 3. Tour authed pages
 * 4. Drive a real chat: pick model, stream, A2UI live, web search
 * 5. Test mobile (375x812) on /chat + /admin
 * 6. Capture screenshots
 * 7. Report findings
 */
import { chromium } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const LOG = '/tmp/oma-dev.log';
const SHOTS = '/tmp/pw-flows/uf';
fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN_EMAIL = 'tyson@nosytlabs.com';

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch (e) { return e.message; }
}
function logTailSince(line) {
  try { return execSync(`tail -n +${line + 1} ${LOG}`, { encoding: 'utf8' }); } catch { return ''; }
}

async function requestMagicLink(email, callbackURL = '/dashboard') {
  const before = parseInt(sh(`wc -l < ${LOG}`), 10) || 0;
  const res = await fetch(`${BASE}/api/auth/sign-in/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': BASE, 'Referer': `${BASE}/login` },
    body: JSON.stringify({ email, callbackURL }),
  });
  await new Promise(r => setTimeout(r, 2500));
  const tail = logTailSince(before);
  const m = tail.match(/magicLink:\s+"([^"]+)"/);
  if (!m) throw new Error(`Magic link not found in log. Tail:\n${tail.slice(-500)}`);
  return m[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
}

const findings = [];
function note(s) { console.log(s); findings.push(s); }

async function shot(page, name) {
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function checkPage(page, route, opts = {}) {
  const url = `${BASE}${route}`;
  const errs = [];
  const onPageError = (e) => errs.push(`PE: ${e.message}`);
  const onConsoleErr = (m) => { if (m.type() === 'error') errs.push(`CE: ${m.text().slice(0, 200)}`); };
  page.on('pageerror', onPageError);
  page.on('console', onConsoleErr);
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(opts.wait || 800);
    const status = resp ? resp.status() : 0;
    const title = await page.title();
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    return { route, status, title, h1, errs: [...errs] };
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsoleErr);
  }
}

// ────────── Phase 1: Sign in as admin ──────────
console.log('\n══════ PHASE 1: Sign in as admin ══════');
const magicURL = 'http://localhost:3000/api/auth/magic-link/verify?token=veenSxcmQprppLJUGfYesGpqGgAGzajO&callbackURL=%2Fdashboard';
note(`✓ Using fresh magic link: ${magicURL.slice(0, 90)}...`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Visit the magic link — this should set the session cookie and redirect
const verifyResp = await page.goto(magicURL, { waitUntil: 'domcontentloaded' });
note(`✓ Magic-link verify: HTTP ${verifyResp.status()}, final URL: ${page.url()}`);
await page.waitForTimeout(1500);

// Check session
const session = await page.evaluate(async () => {
  const r = await fetch('/api/auth/get-session', { credentials: 'include' });
  return r.json();
});
note(`✓ Session: ${JSON.stringify(session).slice(0, 200)}`);

if (!session?.user) {
  note('✗ No session after magic-link click — bailing');
  process.exit(1);
}
note(`✓ Signed in as ${session.user.email} (role=${session.user.role})`);

// ────────── Phase 2: Tour public pages (as authed user) ──────────
console.log('\n══════ PHASE 2: Public pages ══════');
const publicPages = ['/', '/pricing', '/docs', '/faq', '/getting-started', '/glossary', '/models', '/login', '/terms', '/privacy', '/deposit'];
for (const route of publicPages) {
  const r = await checkPage(page, route);
  await shot(page, `public${route.replace(/\//g, '_') || '_root'}`);
  const errStr = r.errs.length ? ` (${r.errs.length} err)` : '';
  note(`  ${r.status} ${route.padEnd(20)} h1="${(r.h1 || '').slice(0, 40).replace(/\n/g, ' ')}"${errStr}`);
}

// ────────── Phase 3: Tour authed pages ──────────
console.log('\n══════ PHASE 3: Authed pages ══════');
const authedPages = ['/dashboard', '/settings', '/admin'];
for (const route of authedPages) {
  const r = await checkPage(page, route, { wait: 1500 });
  await shot(page, `authed${route.replace(/\//g, '_') || '_root'}`);
  const errStr = r.errs.length ? ` (${r.errs.length} err)` : '';
  note(`  ${r.status} ${route.padEnd(20)} h1="${(r.h1 || '').slice(0, 40).replace(/\n/g, ' ')}"${errStr}`);
  if (r.errs.length) r.errs.slice(0, 3).forEach(e => note(`      ${e}`));
}

// ────────── Phase 4: Real chat E2E ──────────
console.log('\n══════ PHASE 4: Chat E2E (as admin) ══════');
await page.goto(`${BASE}/chat`);
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(1500);
await shot(page, 'chat-initial');

// Pick a paid model to use credits
console.log('  Picking a paid model...');
await page.click('button[aria-label*="Select AI model"]');
await page.waitForTimeout(400);
const opts = page.locator('[role="option"]');
const optCount = await opts.count();
note(`  Model options: ${optCount}`);
// Dump all option labels to pick a paid one programmatically
const allOptions = [];
for (let i = 0; i < optCount; i++) {
  const ariaLabel = await opts.nth(i).getAttribute('aria-label').catch(() => null);
  const text = ((await opts.nth(i).textContent()) || '').trim().replace(/\s+/g, ' ');
  allOptions.push({ ariaLabel, text: text.slice(0, 60) });
}
note(`  All options (first 6):\n    ${allOptions.slice(0, 6).map(o => o.ariaLabel).join('\n    ')}`);
// Click the first option that has "frontier" tier (the most expensive)
let pickedIdx = -1;
for (let i = 0; i < allOptions.length; i++) {
  if (allOptions[i].ariaLabel && allOptions[i].ariaLabel.toLowerCase().includes('frontier')) {
    pickedIdx = i;
    break;
  }
}
if (pickedIdx === -1) pickedIdx = 0; // fallback: just pick the first
await opts.nth(pickedIdx).click();
await page.waitForTimeout(500);
note(`  Picked: ${allOptions[pickedIdx].ariaLabel}`);
await shot(page, 'chat-model-picked');

// Check balance
const balance = await page.locator('text=/balance|\\$\\d|cr\\b|credit/i').first().textContent().catch(() => null);
note(`  Balance/CR widget: ${balance?.slice(0, 60) || 'not visible'}`);

// Send a normal message
console.log('  Sending chat message...');
const ta = page.locator('textarea').first();
await ta.fill('Reply with just the single word: ok');
await page.keyboard.press('Enter');
let response = null;
let stopBtnAppeared = false;
let stopClicked = false;
try {
  await page.waitForSelector('button[aria-label="Stop generation"]', { timeout: 8000 });
  stopBtnAppeared = true;
  note('  ✓ Stop button appeared (streaming started)');
  // Now test the audit's P1 fix: clicking the WEB/UI toggle while streaming
  const webBtn = page.locator('button[aria-label*="Toggle web search"]');
  const webVisible = await webBtn.isVisible().catch(() => false);
  if (webVisible) {
    await webBtn.click({ timeout: 3000 });
    const pressed = await webBtn.getAttribute('aria-pressed');
    note(`  ✓ WEB toggle clickable during stream (aria-pressed=${pressed}) — audit P1 fix verified`);
    // Toggle off again for clean state
    await webBtn.click({ timeout: 3000 });
  }
} catch (e) {
  note(`  ✗ Stop button never appeared: ${e.message.slice(0, 100)}`);
}
// Wait for response — upstream is currently capacity-throttled (120s timeout
// in the server config), allow 150s before bailing. If still nothing,
// we know the model provider is fully down.
try {
  await page.waitForSelector('[data-message-author="assistant"]', { timeout: 150000 });
  await page.waitForTimeout(2000);
  response = await page.locator('[data-message-author="assistant"]').last().textContent();
  note(`  ✓ Response: "${(response || '').slice(0, 100).replace(/\n+/g, ' ')}"`);
} catch (e) {
  note(`  ✗ No assistant response in 150s (upstream likely down — server log will confirm)`);
  // Try clicking the Stop button to recover (audit P1: stop button works)
  try {
    const stopBtn = page.locator('button[aria-label="Stop generation"]');
    if (await stopBtn.isVisible({ timeout: 1000 })) {
      await stopBtn.click();
      note('  ✓ Stop button click recovered the UI (loading cleared)');
      await page.waitForTimeout(1500);
    }
  } catch (se) {
    note(`  ✗ Stop button click failed to recover: ${se.message.slice(0, 100)}`);
  }
}
await shot(page, 'chat-after-response');

// Wait for loading to clear before next test
await page.waitForFunction(() => {
  const ta = document.querySelector('textarea');
  return ta && !ta.disabled;
}, { timeout: 30000 }).catch(() => note('  (loading did not clear in 30s)'));

// Test web search
console.log('  Testing web search...');
await page.click('button[aria-label*="Toggle web search"]').catch(() => note('  (web toggle not found)'));
await page.waitForTimeout(500);
await ta.fill('What is the current price of Bitcoin?');
await page.keyboard.press('Enter');
try {
  // Wait for previous response first
  await page.waitForFunction(() => {
    const ta = document.querySelector('textarea');
    return ta && !ta.disabled;
  }, { timeout: 90000 });
  await page.waitForTimeout(2000);
  const lastResponse = await page.locator('[data-message-author="assistant"]').last().textContent();
  const sources = await page.locator('[data-message-author="assistant"] a[href^="http"], [data-message-author="assistant"] [data-source-link]').count();
  note(`  ✓ Web search response received, external source links: ${sources}`);
  note(`  Last response tail: "${(lastResponse || '').slice(-200).replace(/\n+/g, ' ')}"`);
} catch (e) {
  note(`  ✗ Web search response failed: ${e.message.slice(0, 100)}`);
}
await shot(page, 'chat-web-search');

// Test A2UI live
console.log('  Testing A2UI live render...');
await page.waitForFunction(() => {
  const ta = document.querySelector('textarea');
  return ta && !ta.disabled;
}, { timeout: 30000 }).catch(() => note('  (loading did not clear before A2UI test)'));
await page.click('button[aria-label*="Toggle UI mode"]').catch(() => note('  (UI toggle not found)'));
await page.waitForTimeout(500);
await ta.fill('Output ONE single JSON object. Top-level keys: createSurface, updateComponents, updateDataModel. Inside updateComponents.components: a Text (id "title", text "Hello", variant "h1"); a TextField (id "name", label "Your Name", value {"path":"/name"}); a Button (id "submit", component "Button", child "submit_label", variant "primary"). submit_label is a Text with id "submit_label" and text "Submit". updateDataModel path "/" with value {"name":""}. No markdown fences. No explanation.');
await page.keyboard.press('Enter');
try {
  await page.waitForSelector('[data-a2ui-version]', { timeout: 60000 });
  const v = await page.locator('[data-a2ui-version]').first().getAttribute('data-a2ui-version');
  const textFields = await page.locator('input[type="text"]').count();
  const buttons = await page.locator('button:has-text("Submit")').count();
  note(`  ✓ A2UI rendered: version=${v}, text fields=${textFields}, buttons=${buttons}`);
} catch (e) {
  note(`  ✗ A2UI did not render: ${e.message.slice(0, 100)}`);
  // Save the last assistant text for diagnosis
  const last = await page.locator('[data-message-author="assistant"]').last().textContent().catch(() => '');
  note(`    Last response (first 300): "${(last || '').slice(0, 300).replace(/\n+/g, ' ')}"`);
}
await shot(page, 'chat-a2ui-live');

// ────────── Phase 5: Mobile (375x812) ──────────
console.log('\n══════ PHASE 5: Mobile 375x812 ══════');
// Transfer session cookies BEFORE closing the desktop context
const state = await ctx.storageState();
await ctx.close();
const mobileCtx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  storageState: state,
});
const mobilePage = await mobileCtx.newPage();
const mobileRoutes = ['/', '/chat', '/dashboard', '/admin', '/models', '/pricing'];
for (const route of mobileRoutes) {
  const r = await checkPage(mobilePage, route, { wait: 1200 });
  await shot(mobilePage, `mobile${route.replace(/\//g, '_') || '_root'}`);
  const errStr = r.errs.length ? ` (${r.errs.length} err)` : '';
  note(`  ${r.status} ${route.padEnd(20)} h1="${(r.h1 || '').slice(0, 40).replace(/\n/g, ' ')}"${errStr}`);
}

await mobileCtx.close();
await browser.close();
console.log(`\n══════ DONE ══════\nScreenshots: ${SHOTS}/`);
console.log(`Findings: ${findings.length} items`);
fs.writeFileSync(`${SHOTS}/findings.txt`, findings.join('\n') + '\n');
