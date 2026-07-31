#!/usr/bin/env node
/**
 * Comprehensive site audit — visits every page, captures screenshot,
 * console errors, network failures, and writes a JSON report.
 *
 * Uses the locally-installed Playwright with the system Chrome.
 */

const { chromium } = require('/Users/tyson/Desktop/Code/products/OMA-AI/app/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/Users/tyson/Desktop/Code/products/OMA-AI/audit-screenshots/2026-07-31';
const REPORT_PATH = path.join(OUT_DIR, 'audit-report.json');
const SUMMARY_PATH = path.join(OUT_DIR, 'audit-summary.md');

fs.mkdirSync(OUT_DIR, { recursive: true });

const PAGES = [
  { path: '/', name: 'home', critical: true },
  { path: '/models', name: 'models', critical: true },
  { path: '/pricing', name: 'pricing', critical: true },
  { path: '/docs', name: 'docs', critical: false },
  { path: '/chat', name: 'chat', critical: true },
  { path: '/compare', name: 'compare', critical: false },
  { path: '/login', name: 'login', critical: true },
  { path: '/settings', name: 'settings', critical: false },
  { path: '/about', name: 'about', critical: false },
  { path: '/contact', name: 'contact', critical: false },
  { path: '/changelog', name: 'changelog', critical: false },
  { path: '/terms', name: 'terms', critical: false },
  { path: '/privacy', name: 'privacy', critical: false },
  { path: '/observability', name: 'observability', critical: false },
  { path: '/network', name: 'network', critical: false },
  { path: '/image-generation', name: 'image-generation', critical: false },
  { path: '/video-generation', name: 'video-generation', critical: false },
];

const CHAT_USER_FLOWS = [
  { msg: 'What is the capital of France?', expect: 'Paris' },
  { msg: 'And what country is that in?', expect: 'France' },
];

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const report = { pages: {}, chatFlow: null, startedAt: new Date().toISOString() };

  for (const p of PAGES) {
    const page = await ctx.newPage();
    const consoleMsgs = [];
    const networkErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleMsgs.push({ type: msg.type(), text: msg.text().slice(0, 600) });
      }
    });
    page.on('pageerror', (err) => {
      consoleMsgs.push({ type: 'pageerror', text: err.message.slice(0, 600) });
    });
    page.on('requestfailed', (req) => {
      networkErrors.push({
        url: req.url(),
        failure: req.failure()?.errorText || 'unknown',
      });
    });
    page.on('response', (resp) => {
      if (resp.status() >= 400 && !resp.url().includes('favicon')) {
        networkErrors.push({ url: resp.url(), status: resp.status() });
      }
    });

    const started = Date.now();
    let status = null;
    let title = '';
    try {
      const resp = await page.goto(`http://localhost:3000${p.path}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
      status = resp?.status() ?? 0;
      title = await page.title();
      await page.waitForTimeout(1500);
    } catch (e) {
      consoleMsgs.push({ type: 'goto-error', text: e.message.slice(0, 600) });
    }
    const elapsed = Date.now() - started;
    const screenshotPath = path.join(OUT_DIR, `${p.name}.png`);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: false });
    } catch (e) {
      consoleMsgs.push({ type: 'screenshot-error', text: e.message });
    }

    // Check for key text presence
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) || '');

    report.pages[p.name] = {
      path: p.path,
      status,
      title,
      elapsedMs: elapsed,
      consoleMsgs,
      networkErrors,
      screenshotPath,
      bodySnippet: bodyText.replace(/\s+/g, ' ').trim(),
    };
    console.log(`✓ ${p.name} (${p.path}) status=${status} ${consoleMsgs.length} msgs ${networkErrors.length} neterr ${elapsed}ms`);
    await page.close();
  }

  // Chat user flow
  console.log('\n=== Chat user flow ===');
  const chatPage = await ctx.newPage();
  const chatLogs = [];
  chatPage.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      chatLogs.push({ type: msg.type(), text: msg.text().slice(0, 400) });
    }
  });
  chatPage.on('pageerror', (err) => {
    chatLogs.push({ type: 'pageerror', text: err.message.slice(0, 400) });
  });
  chatPage.on('response', (resp) => {
    if (resp.url().includes('/v1/chat/completions')) {
      chatLogs.push({ type: 'chat-network', status: resp.status(), url: resp.url() });
    }
  });

  await chatPage.goto('http://localhost:3000/chat', { waitUntil: 'networkidle', timeout: 20000 });
  await chatPage.waitForTimeout(2000);
  await chatPage.screenshot({ path: path.join(OUT_DIR, 'chat-0-initial.png') });

  const chatFlow = { turns: [] };
  for (let i = 0; i < CHAT_USER_FLOWS.length; i++) {
    const flow = CHAT_USER_FLOWS[i];
    try {
      const textarea = await chatPage.locator('textarea[aria-label*="message"], textarea[aria-label*="Send"], textarea').first();
      await textarea.fill(flow.msg);
      await chatPage.keyboard.press('Enter');
      // Wait for the send button to swap back from "Stop" to "Send"
      // (i.e. the stream has completed). Up to 45s per turn.
      try {
        await chatPage.waitForSelector('button[aria-label="Send message"]', { timeout: 45000 });
      } catch {
        // Fallback: just wait 45s if the locator is still loading.
        await chatPage.waitForTimeout(45000);
      }
      await chatPage.waitForTimeout(1500);
      const bodyText = await chatPage.evaluate(() => document.body?.innerText || '');
      // Verify TRUNCATED badge is present when the response was cut off
      const hasTruncated = bodyText.includes('TRUNCATED');
      const gotExpected = flow.expect
        ? bodyText.toLowerCase().includes(flow.expect.toLowerCase())
        : true;
      await chatPage.screenshot({ path: path.join(OUT_DIR, `chat-turn-${i + 1}.png`) });
      chatFlow.turns.push({
        index: i + 1,
        sent: flow.msg,
        expected: flow.expect,
        gotExpected,
        hasTruncated,
        bodySnippet: bodyText.slice(-1500).replace(/\s+/g, ' ').trim(),
      });
      console.log(`  turn ${i + 1}: ${flow.msg} → expected "${flow.expect}" got=${gotExpected} truncated=${hasTruncated}`);
    } catch (e) {
      chatFlow.turns.push({ index: i + 1, error: e.message });
      console.log(`  turn ${i + 1}: ERROR ${e.message}`);
    }
  }
  chatFlow.consoleLogs = chatLogs;
  report.chatFlow = chatFlow;
  await chatPage.close();

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  // Summary
  let summary = `# OMA-AI Site Audit — 2026-07-31\n\n`;
  summary += `Total pages: ${Object.keys(report.pages).length}\n\n`;
  summary += `## Page results\n\n`;
  summary += `| Page | Status | Time | Console errors | Network errors |\n|---|---|---|---|---|\n`;
  for (const p of PAGES) {
    const r = report.pages[p.name];
    summary += `| ${p.name} | ${r.status} | ${r.elapsedMs}ms | ${r.consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror').length} | ${r.networkErrors.length} |\n`;
  }
  summary += `\n## Chat flow\n\n`;
  for (const t of chatFlow.turns) {
    summary += `- Turn ${t.index}: ${t.gotExpected ? '✓' : '✗'} sent "${t.sent}" expected "${t.expected}"\n`;
  }
  summary += `\n## Errors per page\n\n`;
  for (const p of PAGES) {
    const r = report.pages[p.name];
    const errs = r.consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror');
    if (errs.length > 0) {
      summary += `### ${p.name}\n`;
      for (const e of errs) {
        summary += `- [${e.type}] ${e.text.slice(0, 200)}\n`;
      }
    }
  }
  fs.writeFileSync(SUMMARY_PATH, summary);

  await browser.close();
  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`Summary: ${SUMMARY_PATH}`);
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
