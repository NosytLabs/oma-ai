#!/usr/bin/env node
/**
 * Screenshot the chat model picker to verify the open-question fixes:
 * - "Default" badge on gemini-3-flash-preview
 * - "Free*" badge with tooltip on mistral-small-2603
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const LOG = '/tmp/oma-dev.log';
const SHOTS = '/tmp/pw-flows/uf';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Read the latest magic link from the dev log
const stripped = fs.readFileSync(LOG, 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
const matches = [...stripped.matchAll(/magicLink:\s+"([^"]+)"/g)];
const url = matches.length ? matches[matches.length - 1][1].replace(/\\u0026/g, '&') : null;

if (url) {
  console.log('Signing in as admin...');
  await page.goto(url);
  await page.waitForTimeout(1500);
} else {
  console.log('No magic link in log; loading /chat as guest');
}

await page.goto('http://localhost:3000/chat', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(1500);

// Open the dropdown
await page.click('button[aria-label*="Select AI model"]');
await page.waitForTimeout(500);

// Full dropdown screenshot
await page.screenshot({ path: `${SHOTS}/model-picker-defaults.png`, fullPage: false });
console.log('Model picker dropdown saved');

// Filter to "free" so the DEFAULT + Free* badges are clearly visible
const freeBtn = page.locator('button[aria-label="Filter models by budget tier"]');
if (await freeBtn.count() > 0) {
  await freeBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/model-picker-budget.png`, fullPage: false });
  console.log('Budget tier filtered screenshot saved');
}

// Hover mistral to surface the tooltip
const mistralOpt = page.locator('[role="option"]:has-text("Mistral")');
if (await mistralOpt.count() > 0) {
  await mistralOpt.first().hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/model-picker-mistral-tooltip.png`, fullPage: false });
  console.log('Mistral tooltip screenshot saved');
}

// Just the dropdown content
const listbox = page.locator('[role="listbox"]').first();
if (await listbox.count() > 0) {
  await listbox.screenshot({ path: `${SHOTS}/model-picker-listbox.png` });
  console.log('Listbox screenshot saved');
}

await browser.close();
