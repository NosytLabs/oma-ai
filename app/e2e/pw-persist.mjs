import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const FREE_DEFAULT = 'gemini-3-flash-preview';
const TARGET = 'mistral-small-2603';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', e => errs.push(`PE: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errs.push(`CE: ${m.text().slice(0,200)}`); });

const results = [];
function pass(name) { results.push(`✅ ${name}`); console.log(`✅ ${name}`); }
function fail(name, detail) { results.push(`❌ ${name} — ${detail}`); console.log(`❌ ${name} — ${detail}`); }

async function getModelFromLocalStorage() {
  return await page.evaluate(() => {
    return localStorage.getItem('oma_chat_model:guest');
  });
}

async function getModelFromDropdown() {
  // The model selector is a button showing the current model name.
  // Open it and read the selected value via the trigger's text.
  await page.locator('button[aria-label*="Select AI model"]').click();
  await page.waitForTimeout(300);
  // The picker uses the ARIA menu/menuitemradio pattern.
  const checked = page.locator('[role="menuitemradio"][aria-checked="true"]').first();
  let id = null;
  if (await checked.count() > 0) {
    id = await checked.getAttribute('data-model-id') || await checked.getAttribute('value');
  }
  // Fall back: read the trigger text.
  if (!id) {
    id = await page.locator('button[aria-label*="Select AI model"]').textContent();
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  return id?.trim();
}

async function pickModelFromDropdown(modelId) {
  await page.locator('button[aria-label*="Select AI model"]').click();
  await page.waitForTimeout(300);
  // Try by data-model-id first
  let opt = page.locator(`[role="menuitemradio"][data-model-id="${modelId}"]`);
  if (await opt.count() === 0) {
    // Fallback: search-by-text. Use the search input if present.
    const search = page.locator('input[placeholder*="earch" i], input[type="search"]').first();
    if (await search.count() > 0) {
      await search.fill(modelId);
      await page.waitForTimeout(200);
    }
    opt = page.locator(`[role="menuitemradio"]:has-text("${modelId}")`).first();
  }
  await opt.click();
  await page.waitForTimeout(500);
  await page.waitForURL((url) => url.searchParams.get('model') === modelId, { timeout: 5000 });
}

async function readUrl() {
  return page.url();
}

// Clear the prior preference so this is a genuine cold-load assertion.
await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('oma_chat_model:guest'));

// --- TEST 1: cold load → default model, URL stays clean
await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(800);

const coldModel = await getModelFromDropdown();
if (coldModel && coldModel.includes('Gemini') || coldModel === FREE_DEFAULT) {
  pass(`Cold load shows default model (${coldModel?.slice(0,40)})`);
} else {
  fail('Cold load default model', `got "${coldModel}"`);
}

const coldUrl = await readUrl();
if (!coldUrl.includes('?model=')) {
  pass(`Cold load URL stays clean (${coldUrl.replace(BASE, '')})`);
} else {
  fail('Cold load URL clean', `got ${coldUrl}`);
}

// --- TEST 2: switch → saves to localStorage
await pickModelFromDropdown(TARGET);
const stored = await getModelFromLocalStorage();
if (stored === TARGET) {
  pass(`Switching model saves to localStorage (${stored})`);
} else {
  fail('Persist on switch', `expected ${TARGET}, got ${stored}`);
}

const switchUrl = await readUrl();
if (switchUrl.includes(`model=${TARGET}`)) {
  pass(`URL mirrors selection (?model=${TARGET})`);
} else {
  fail('URL mirror on switch', `got ${switchUrl}`);
}

// --- TEST 3: reload → restores saved model
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(1000);
const reloadModel = await getModelFromDropdown();
if (reloadModel && (reloadModel.includes('Mistral') || reloadModel === TARGET)) {
  pass(`Reload restores saved model (${reloadModel?.slice(0,40)})`);
} else {
  fail('Restore on reload', `got "${reloadModel}"`);
}

// --- TEST 4: deep link ?model=minimax-m2-7 wins
await page.goto(`${BASE}/chat?model=minimax-m2-7`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(1000);
const deepModel = await getModelFromDropdown();
if (deepModel && (deepModel.includes('MiniMax') || deepModel.includes('M2.7'))) {
  pass(`Deep link ?model=minimax-m2-7 loads (${deepModel?.slice(0,40)})`);
} else {
  fail('Deep link wins', `got "${deepModel}"`);
}

// --- TEST 5: invalid ?model=does-not-exist falls back to storage
const storedBefore = await getModelFromLocalStorage();
await page.goto(`${BASE}/chat?model=does-not-exist`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button[aria-label*="Select AI model"]', { timeout: 15000 });
await page.waitForTimeout(1000);
const fallbackModel = await getModelFromDropdown();
const storedAfter = await getModelFromLocalStorage();
if (storedAfter === storedBefore) {
  pass(`Invalid ?model= doesn't clobber localStorage (still ${storedAfter})`);
} else {
  fail('Invalid URL clobber check', `before=${storedBefore} after=${storedAfter}`);
}
if (fallbackModel && (fallbackModel.includes('Mistral') || fallbackModel === TARGET)) {
  pass(`Invalid ?model= falls back to stored value (${fallbackModel?.slice(0,40)})`);
} else {
  // Acceptable: if storage was empty, falls back to default — still not the bogus model
  if (fallbackModel && (fallbackModel.includes('Gemini') || fallbackModel === FREE_DEFAULT)) {
    pass(`Invalid ?model= falls back to default (${fallbackModel?.slice(0,40)})`);
  } else {
    fail('Invalid URL fallback', `got "${fallbackModel}"`);
  }
}

console.log('\n=== Errors ===');
if (errs.length === 0) console.log('  (none)');
errs.forEach(e => console.log(`  ${e}`));

console.log('\n=== Summary ===');
const passed = results.filter(r => r.startsWith('✅')).length;
const failed = results.filter(r => r.startsWith('❌')).length;
console.log(`  ${passed} passed, ${failed} failed`);

await browser.close();
process.exit(failed === 0 ? 0 : 1);
