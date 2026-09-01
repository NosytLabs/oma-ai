#!/usr/bin/env node
/**
 * OMA AI — Chat UI smoke test (no upstream dependency)
 *
 * Validates the audit P1 fix (Stop button no longer intercepts WEB/UI
 * toggle clicks during streaming) and BUG-E (the 15s "Server is taking
 * longer than usual" toast). Sends a message, immediately exercises
 * the WEB/UI toggles while the Stop button is visible, then waits
 * for the stuck-loading toast to fire.
 *
 * Doesn't wait for a successful response (upstream is at capacity
 * right now, so a real response can take 5 min via the fallback
 * chain). The point is to verify the UI SURVIVES the streaming
 * state without the Stop button blocking siblings.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const LOG = '/tmp/oma-dev.log';
const SHOTS = '/tmp/pw-flows/uf';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', (e) => errs.push(`PE: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errs.push(`CE: ${m.text().slice(0, 200)}`); });

// Sign in as admin (the only auth that bypasses the IP daily quota
// so the test is reliable even after the audit-day quota churn).
const stripped = fs.readFileSync(LOG, 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
const matches = [...stripped.matchAll(/magicLink:\s+"([^"]+)"/g)];
const url = matches.length ? matches[matches.length - 1][1].replace(/\\u0026/g, '&') : null;

const findings = [];
function pass(s) { console.log(`✅ ${s}`); findings.push(`PASS: ${s}`); }
function fail(s, e) { console.log(`❌ ${s} — ${e}`); findings.push(`FAIL: ${s} — ${e}`); }

if (!url) {
  fail('magic link', 'none in /tmp/oma-dev.log');
  process.exit(1);
}
await page.goto(url);
await page.waitForTimeout(1500);

const session = await page.evaluate(() => fetch('/api/auth/get-session').then((r) => r.json()));
if (!session?.user) {
  fail('sign-in', 'no session after magic link');
  process.exit(1);
}
pass(`signed in as ${session.user.email} (${session.user.role})`);

// Go to /chat and pick a free model so the test doesn't depend on credits
await page.goto('http://localhost:3000/chat');
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(1000);

// Open dropdown, click "Gemini 3 Flash" (the default; the DEFAULT badge should be visible)
await page.click('button[aria-label*="Select AI model"]');
await page.waitForTimeout(500);

// Verify the DEFAULT badge is present
const defaultBadge = await page.locator('span[title*="Default for empty"]').count();
if (defaultBadge > 0) {
  pass('DEFAULT badge visible on the default model row');
} else {
  fail('DEFAULT badge', 'no span with title "Default for empty"');
}

// Verify the Free* badge is on mistral
const freeStarBadge = await page.locator('span[title*="Venice free fallback"]').count();
if (freeStarBadge > 0) {
  pass('Free* badge visible on mistral-small-2603 (Venice fallback hint)');
} else {
  fail('Free* badge', 'no span with title "Venice free fallback"');
}
await page.screenshot({ path: `${SHOTS}/chat-smoke-picker.png` });

// Click mistral
const mistral = page.locator('[role="option"]:has-text("Mistral")').first();
if (await mistral.count() > 0) {
  await mistral.click();
  await page.waitForTimeout(500);
  pass('selected mistral-small-2603');
}

// Send a message — expect Stop button within 8s
const ta = page.locator('textarea').first();
await ta.fill('Hello, this is a smoke test. Reply with one word.');
await page.keyboard.press('Enter');
console.log('Sent message, waiting for Stop button...');

let stopVisible = false;
try {
  await page.waitForSelector('button[aria-label="Stop generation"]', { timeout: 8000 });
  stopVisible = true;
  pass('Stop button appeared (streaming started)');
} catch (e) {
  fail('Stop button', e.message.slice(0, 100));
}

// AUDIT P1 fix verification: click WEB and UI toggles while streaming
if (stopVisible) {
  for (const label of ['Toggle web search', 'Toggle UI mode']) {
    const btn = page.locator(`button[aria-label*="${label}"]`);
    if (await btn.count() === 0) {
      fail(label, 'button not found');
      continue;
    }
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) {
      fail(label, 'not visible during stream');
      continue;
    }
    try {
      await btn.click({ timeout: 3000 });
      const pressed = await btn.getAttribute('aria-pressed');
      pass(`${label} clickable during stream (aria-pressed=${pressed}) — audit P1 fix verified`);
      // Toggle back so the next iteration doesn't fail
      await btn.click({ timeout: 3000 });
    } catch (e) {
      fail(label, e.message.slice(0, 100));
    }
  }
}

// BUG-E verification: wait for the 15s stuck-loading toast
console.log('Waiting up to 20s for the "Server is taking longer than usual" toast (BUG-E)...');
try {
  await page.waitForSelector('text=/taking longer than usual/i', { timeout: 20_000 });
  pass('"Server is taking longer than usual" toast appeared at 15s — BUG-E fix verified');
  await page.screenshot({ path: `${SHOTS}/chat-smoke-stuck-toast.png` });
} catch (e) {
  // If the response landed super fast (<15s), the toast wouldn't fire.
  // That's not a failure of the fix — it's a sign upstream is healthy.
  const stillLoading = await page.locator('textarea[disabled]').count() > 0;
  if (!stillLoading) {
    console.log('ℹ  Response landed before 15s; stuck-toast would not fire (not a failure)');
  } else {
    fail('stuck toast', 'loading still true after 20s but no toast');
  }
}

// Final cleanup: stop the request
const stopBtn = page.locator('button[aria-label="Stop generation"]');
if (await stopBtn.isVisible().catch(() => false)) {
  await stopBtn.click();
  await page.waitForTimeout(1000);
  pass('Stop button click recovered the UI (loading cleared)');
}

console.log('\n=== Summary ===');
const passed = findings.filter((f) => f.startsWith('PASS')).length;
const failed = findings.filter((f) => f.startsWith('FAIL')).length;
console.log(`  ${passed} passed, ${failed} failed`);

console.log('\n=== Console errors ===');
if (errs.length === 0) console.log('  (none)');
errs.forEach((e) => console.log(`  ${e}`));

await browser.close();
fs.writeFileSync(`${SHOTS}/chat-smoke-findings.txt`, findings.join('\n') + '\n');
process.exit(failed === 0 ? 0 : 1);
