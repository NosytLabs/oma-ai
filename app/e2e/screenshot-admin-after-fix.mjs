#!/usr/bin/env node
/**
 * Quick screenshot: re-take the admin dashboard after the layout fix
 * (BUG-B) to verify the kill-switch + rate-limit cards no longer
 * overflow on desktop.
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

// Sign in as admin using the LATEST magic link from the dev log
const logContent = fs.readFileSync(LOG, 'utf8');
// Pino's pretty logger wraps the key in ANSI color codes (e.g.
// "\x1b[35mmagicLink\x1b[39m: \"...\""). Strip them before matching.
const stripped = logContent.replace(/\x1b\[[0-9;]*m/g, '');
const matches = [...stripped.matchAll(/magicLink:\s+"([^"]+)"/g)];
const m = matches.length ? matches[matches.length - 1] : null;
if (!m) {
  console.error('No magic link in log; trigger one via:');
  console.error('  curl -X POST http://localhost:3000/api/auth/sign-in/magic-link \\');
  console.error('    -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \\');
  console.error('    -d \'{"email":"tyson@nosytlabs.com","callbackURL":"/dashboard"}\'');
  process.exit(1);
}
const url = m[1].replace(/\\u0026/g, '&');
console.log('Magic link:', url.slice(0, 100) + '...');

await page.goto(url);
await page.waitForTimeout(2000);

// Take the admin page
await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('h1', { timeout: 15000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOTS}/admin-after-fix.png`, fullPage: true });
console.log('Admin screenshot saved');

// Also check the kill switch + rate limit sections specifically
const killSwitches = await page.locator('[aria-label="Site settings"]').first();
await killSwitches.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await killSwitches.screenshot({ path: `${SHOTS}/admin-killswitches-after-fix.png` });
console.log('Kill switches screenshot saved');

const rateLimit = await page.locator('[aria-label="Rate-limit overrides"]').first();
await rateLimit.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await rateLimit.screenshot({ path: `${SHOTS}/admin-ratelimit-after-fix.png` });
console.log('Rate limit screenshot saved');

console.log('\nConsole errors:');
if (errs.length === 0) console.log('  (none)');
errs.forEach((e) => console.log('  ' + e));

await browser.close();
