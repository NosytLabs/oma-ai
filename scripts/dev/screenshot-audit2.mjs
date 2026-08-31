import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const DIR = '/tmp/oma-audit';

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  // Chat page needs 'load' instead of 'networkidle' (streaming)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 15000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${DIR}/chat-desktop.png`, fullPage: false });
  console.log('✓ chat desktop');
  await p.close();
  await ctx.close();

  // Mobile chat
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mp = await mctx.newPage();
  await mp.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 15000 });
  await mp.waitForTimeout(3000);
  await mp.screenshot({ path: `${DIR}/chat-mobile.png`, fullPage: false });
  console.log('✓ chat mobile');
  await mp.close();
  await mctx.close();

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
