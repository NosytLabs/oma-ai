import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const DIR = '/tmp/oma-audit';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  // Dashboard with demo mode (bypasses auth)
  await p.goto(`${BASE}/dashboard?demo=1`, { waitUntil: 'networkidle', timeout: 20000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${DIR}/dashboard-demo-desktop.png`, fullPage: true });
  console.log('✓ dashboard demo');

  // Dashboard unauthenticated (sign-in gate)
  await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${DIR}/dashboard-gate-desktop.png`, fullPage: true });
  console.log('✓ dashboard gate');

  // Settings unauthenticated
  await p.goto(`${BASE}/settings`, { waitUntil: 'networkidle', timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${DIR}/settings-gate-desktop.png`, fullPage: true });
  console.log('✓ settings gate');

  // Admin unauthenticated
  await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${DIR}/admin-desktop.png`, fullPage: true });
  console.log('✓ admin');

  // Deposit
  await p.goto(`${BASE}/deposit`, { waitUntil: 'networkidle', timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${DIR}/deposit-desktop.png`, fullPage: true });
  console.log('✓ deposit');

  // Docs
  await p.goto(`${BASE}/docs`, { waitUntil: 'networkidle', timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${DIR}/docs-desktop.png`, fullPage: true });
  console.log('✓ docs');

  // Chat full
  await p.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 20000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${DIR}/chat-fullpage-desktop.png`, fullPage: true });
  console.log('✓ chat full');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
