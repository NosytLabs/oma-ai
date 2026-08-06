import { createRequire } from "node:module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
// Playwright lives in app/ workspace (devDependency), not monorepo root.
const require = createRequire(path.join(root, "app/package.json"));
const { chromium } = require("@playwright/test");

const out =
	process.env.VISUAL_AUDIT_OUT
		? path.resolve(process.env.VISUAL_AUDIT_OUT)
		: path.resolve(root, ".visual-audit");
fs.mkdirSync(out, { recursive: true });

const pages = [
	{ name: "home", url: "http://127.0.0.1:3001/" },
	{ name: "models", url: "http://127.0.0.1:3001/models" },
	{ name: "pricing", url: "http://127.0.0.1:3001/pricing" },
	{ name: "docs", url: "http://127.0.0.1:3001/docs" },
	{ name: "chat", url: "http://127.0.0.1:3001/chat" },
	{ name: "compare", url: "http://127.0.0.1:3001/compare" },
	{ name: "login", url: "http://127.0.0.1:3001/login" },
	{ name: "dashboard", url: "http://127.0.0.1:3001/dashboard" },
	{ name: "deposit", url: "http://127.0.0.1:3001/deposit" },
	{ name: "settings", url: "http://127.0.0.1:3001/settings" },
	{ name: "capabilities", url: "http://127.0.0.1:3001/capabilities" },
	{ name: "faq", url: "http://127.0.0.1:3001/faq" },
	{ name: "getting-started", url: "http://127.0.0.1:3001/getting-started" },
	{ name: "about", url: "http://127.0.0.1:3001/about" },
	{ name: "observability", url: "http://127.0.0.1:3001/observability" },
	{ name: "changelog", url: "http://127.0.0.1:3001/changelog" },
	{ name: "contact", url: "http://127.0.0.1:3001/contact" },
	{ name: "admin", url: "http://127.0.0.1:3001/admin" },
	{ name: "glossary", url: "http://127.0.0.1:3001/glossary" },
	{ name: "privacy", url: "http://127.0.0.1:3001/privacy" },
	{ name: "terms", url: "http://127.0.0.1:3001/terms" },
];

const findings = [];

async function pageMetrics(page) {
	return page.evaluate(() => {
		const body = document.body;
		const html = document.documentElement;
		const scrollW = Math.max(body.scrollWidth, html.scrollWidth);
		const clientW = Math.max(body.clientWidth, html.clientWidth);
		const overflowX = scrollW > clientW + 2;
		const nav = document.querySelector('nav[aria-label="Main navigation"]');
		const navRect = nav?.getBoundingClientRect();
		const h1 = document.querySelector("h1");
		const footer = document.querySelector("footer");
		const main = document.querySelector("main") || document.querySelector("[role=main]");
		// Check for elements overflowing viewport width
		let wideEls = 0;
		for (const el of document.querySelectorAll("body *")) {
			const r = el.getBoundingClientRect();
			if (r.width > clientW + 4 && r.right > clientW + 4) wideEls++;
		}
		return {
			overflowX,
			scrollW,
			clientW,
			wideEls,
			title: document.title,
			h1: h1?.textContent?.trim().slice(0, 140) || null,
			hasNav: !!nav,
			hasFooter: !!footer,
			hasMain: !!main,
			navHeight: navRect?.height || 0,
			bodyTextLen: (body.innerText || "").length,
		};
	});
}

const browser = await chromium.launch({ headless: true });

const desktop = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	colorScheme: "dark",
	deviceScaleFactor: 1,
});
const page = await desktop.newPage();
page.on("pageerror", (e) =>
	findings.push({ type: "pageerror", msg: e.message, url: page.url() }),
);
page.on("console", (msg) => {
	if (msg.type() === "error")
		findings.push({ type: "console", msg: msg.text(), url: page.url() });
});

for (const p of pages) {
	try {
		// Retry once on 404/5xx — Next dev can briefly serve not-found during HMR.
		let res = await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 45000 });
		if (res && res.status() >= 400) {
			await page.waitForTimeout(800);
			res = await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 45000 });
		}
		// Chat shell is client-only (dynamic import) — wait for composer so
		// screenshots are not the empty shimmer bar.
		if (p.name === "chat") {
			await page
				.waitForSelector("#chat-message-input, textarea[aria-label*='message' i]", {
					timeout: 30010,
				})
				.catch(() => null);
			await page.waitForTimeout(400);
		} else if (["settings", "admin", "dashboard", "deposit", "login"].includes(p.name)) {
			// Auth-gated / client-session pages: wait for gate or real content
			// (h1) so we do not capture the pre-session spinner shell.
			await page
				.waitForFunction(
					() => {
						const h1 = document.querySelector("h1");
						return Boolean(h1 && h1.textContent && h1.textContent.trim().length > 0);
					},
					{ timeout: 12000 },
				)
				.catch(() => null);
			await page.waitForTimeout(400);
		} else {
			await page.waitForTimeout(1000);
		}
		const status = res?.status();
		const metrics = await pageMetrics(page);
		await page.screenshot({
			path: path.join(out, `desktop-${p.name}.png`),
			fullPage: false,
		});
		// also full page for home/pricing
		if (["home", "pricing", "models", "docs"].includes(p.name)) {
			await page.screenshot({
				path: path.join(out, `desktop-${p.name}-full.png`),
				fullPage: true,
			});
		}
		findings.push({ type: "page", name: p.name, status, ...metrics });
		console.log(
			"desktop",
			p.name,
			status,
			metrics.overflowX ? "OVERFLOW_X" : "ok",
			(metrics.h1 || "").slice(0, 50),
		);
	} catch (e) {
		console.log("FAIL desktop", p.name, e.message);
		findings.push({ type: "fail", name: p.name, msg: e.message });
	}
}

const mobile = await browser.newContext({
	viewport: { width: 390, height: 844 },
	colorScheme: "dark",
	isMobile: true,
	hasTouch: true,
});
const mpage = await mobile.newPage();
for (const p of [
	{ name: "home", url: "http://127.0.0.1:3001/" },
	{ name: "models", url: "http://127.0.0.1:3001/models" },
	{ name: "chat", url: "http://127.0.0.1:3001/chat" },
	{ name: "pricing", url: "http://127.0.0.1:3001/pricing" },
	{ name: "docs", url: "http://127.0.0.1:3001/docs" },
	{ name: "login", url: "http://127.0.0.1:3001/login" },
	{ name: "compare", url: "http://127.0.0.1:3001/compare" },
]) {
	try {
		await mpage.goto(p.url, { waitUntil: "domcontentloaded", timeout: 45000 });
		await mpage.waitForTimeout(800);
		const metrics = await pageMetrics(mpage);
		await mpage.screenshot({
			path: path.join(out, `mobile-${p.name}.png`),
			fullPage: false,
		});
		if (p.name === "home") {
			const btn = mpage.locator('button[aria-label*="Open navigation"]');
			if ((await btn.count()) > 0) {
				await btn.click();
				await mpage.waitForTimeout(500);
				await mpage.screenshot({
					path: path.join(out, "mobile-home-menu.png"),
					fullPage: false,
				});
			}
		}
		console.log("mobile", p.name, metrics.overflowX ? "OVERFLOW_X" : "ok", "wide", metrics.wideEls);
		findings.push({ type: "mobile", name: p.name, ...metrics });
	} catch (e) {
		console.log("FAIL mobile", p.name, e.message);
		findings.push({ type: "fail", name: p.name, viewport: "mobile", msg: e.message });
	}
}

fs.writeFileSync(path.join(out, "findings.json"), JSON.stringify(findings, null, 2));
await browser.close();
const issues = findings.filter(
	(f) => f.type === "console" || f.type === "pageerror" || f.overflowX || f.type === "fail",
);
console.log("ISSUE_COUNT", issues.length);
console.log(JSON.stringify(issues.slice(0, 40), null, 2));
