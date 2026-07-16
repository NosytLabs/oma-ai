// axe-core a11y audit for OMA-AI public pages
// Usage: node scripts/axe-audit.mjs
// Uses playwright + axe-core from the app workspace.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "../app/package.json"));
const { chromium } = require("playwright");

const PAGES = [
  { url: '/', name: 'home' },
  { url: '/models', name: 'models' },
  { url: '/pricing', name: 'pricing' },
  { url: '/docs', name: 'docs' },
  { url: '/privacy', name: 'privacy' },
  { url: '/terms', name: 'terms' },
  { url: '/login', name: 'login' },
  { url: '/chat', name: 'chat' },
  { url: '/network', name: 'network' },
  { url: '/changelog', name: 'changelog' },
  { url: '/dashboard', name: 'dashboard', demo: true },
  { url: '/settings', name: 'settings', demo: true },
  { url: '/deposit', name: 'deposit', demo: true },
  { url: '/admin', name: 'admin', demo: true },
  { url: '/image-generation', name: 'image-generation' },
  { url: '/video-generation', name: 'video-generation' },
];

const AXE_PATH = join(process.cwd(), 'app/node_modules/axe-core/axe.min.js');
const axeSource = readFileSync(AXE_PATH, 'utf8');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const STANDARDS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const results = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  pages: [],
  summary: { total: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 }, violations: 0, pagesClean: 0, pagesWithViolations: 0 },
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

for (const page of PAGES) {
  const url = BASE_URL + page.url;
  const tab = await ctx.newPage();
  try {
    // Set demo cookie for authenticated pages so middleware lets us through
    if (page.demo) {
      await tab.context().addCookies([{
        name: 'oma-demo',
        value: '1',
        domain: new URL(BASE_URL).hostname,
        path: '/',
      }]);
    }
    const resp = await tab.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    const status = resp?.status() ?? 0;
    if (status >= 300) {
      results.pages.push({ name: page.name, url: page.url, status, skipped: `HTTP ${status}` });
      await tab.close();
      continue;
    }
    // Inject axe-core
    await tab.addScriptTag({ content: axeSource });
    const axeResult = await tab.evaluate(async (standards) => {
      // @ts-ignore axe is injected
      return await window.axe.run(document, { runOnly: { type: 'tag', values: standards } });
    }, STANDARDS);

    const violations = (axeResult.violations ?? []).map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      description: v.description,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));

    const pageResult = {
      name: page.name,
      url: page.url,
      status,
      violationCount: violations.length,
      violations,
    };
    results.pages.push(pageResult);
    results.summary.total += 1;
    results.summary.violations += violations.length;
    if (violations.length === 0) {
      results.summary.pagesClean += 1;
    } else {
      results.summary.pagesWithViolations += 1;
      for (const v of violations) {
        if (results.summary.byImpact[v.impact]) results.summary.byImpact[v.impact] += 1;
      }
    }
    process.stdout.write(`${page.name}: ${violations.length} violations\n`);
  } catch (err) {
    results.pages.push({ name: page.name, url: page.url, error: err.message });
    process.stdout.write(`${page.name}: ERROR ${err.message}\n`);
  }
  await tab.close();
}

await browser.close();
await ctx.close();

const reportPath = join(process.cwd(), '.opencode/audit-2026-06-13v2/axe-core-audit.json');
const { writeFileSync, mkdirSync } = await import('node:fs');
mkdirSync(join(process.cwd(), '.opencode/audit-2026-06-13v2'), { recursive: true });
writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n=== AXE-CORE AUDIT SUMMARY ===`);
console.log(`Pages scanned: ${results.summary.total}`);
console.log(`Pages clean (0 violations): ${results.summary.pagesClean}`);
console.log(`Pages with violations: ${results.summary.pagesWithViolations}`);
console.log(`Total violations: ${results.summary.violations}`);
console.log(`By impact: critical=${results.summary.byImpact.critical} serious=${results.summary.byImpact.serious} moderate=${results.summary.byImpact.moderate} minor=${results.summary.byImpact.minor}`);
console.log(`\nReport written to: ${reportPath}`);
