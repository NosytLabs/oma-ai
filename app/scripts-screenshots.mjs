// Quick screenshot script for OMA-AI pages
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "/tmp/oma-screenshots";
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE || "http://localhost:3000";
const PAGES = [
  { path: "/", name: "01-home" },
  { path: "/pricing", name: "02-pricing" },
  { path: "/models", name: "03-models" },
  { path: "/dashboard", name: "04-dashboard" },
  { path: "/chat", name: "05-chat" },
  { path: "/docs", name: "06-docs" },
  { path: "/about", name: "07-about" },
  { path: "/deposit", name: "08-deposit" },
  { path: "/login", name: "09-login" },
  { path: "/compare", name: "10-compare" },
  { path: "/changelog", name: "11-changelog" },
  { path: "/contact", name: "12-contact" },
  { path: "/terms", name: "13-terms" },
  { path: "/privacy", name: "14-privacy" },
  { path: "/admin", name: "15-admin" },
  { path: "/settings", name: "16-settings" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.name === "mobile"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
        : undefined,
    });
    const page = await context.newPage();
    for (const p of PAGES) {
      try {
        const resp = await page.goto(`${BASE}${p.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        const status = resp?.status() ?? 0;
        // wait a bit for animations/SSE to settle
        await page.waitForTimeout(vp.name === "mobile" ? 800 : 1500);
        const file = `${OUT}/${vp.name}-${p.name}.png`;
        await page.screenshot({ path: file, fullPage: false });
        console.log(`${vp.name} ${p.path} -> ${status} (${file})`);
      } catch (e) {
        console.log(`${vp.name} ${p.path} -> ERR: ${e.message}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`\nScreenshots saved to ${OUT}`);