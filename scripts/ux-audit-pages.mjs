/**
 * Full-page UX capture for authenticated + public surfaces.
 * Writes screenshots + DOM metrics to /tmp/oma-ux-audit/
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(join(__dirname, "../app/package.json"));
const { chromium } = require("playwright");
const JWT = readFileSync(
	existsSync(resolve(root, "data/seed/session.jwt"))
		? resolve(root, "data/seed/session.jwt")
		: "/tmp/oma-jwt.txt",
	"utf8",
).trim();

const outDir = "/tmp/oma-ux-audit";
mkdirSync(outDir, { recursive: true });

const publicPaths = [
	"/",
	"/login",
	"/pricing",
	"/models",
	"/docs",
	"/compare",
	"/about",
	"/contact",
];

const authedPaths = [
	"/dashboard",
	"/dashboard?tab=usage",
	"/dashboard?tab=api-keys",
	"/dashboard?tab=health",
	"/dashboard/api-keys",
	"/dashboard/credits",
	"/settings",
	"/deposit",
	"/chat",
];

async function auditPage(page, path, label) {
	const url = `http://localhost:3000${path}`;
	const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
	await page.waitForTimeout(2200);
	const status = res?.status() ?? 0;
	const metrics = await page.evaluate(() => {
		const body = document.body;
		const main = document.querySelector("main") || body;
		const text = (body.innerText || "").replace(/\s+/g, " ").slice(0, 800);
		const h1 = document.querySelector("h1")?.innerText?.trim() || null;
		const overflows = [];
		const all = Array.from(document.querySelectorAll("body *")).slice(0, 400);
		for (const el of all) {
			const r = el.getBoundingClientRect();
			if (r.width > window.innerWidth + 2 && r.width > 0) {
				overflows.push({
					tag: el.tagName,
					cls: (el.className || "").toString().slice(0, 80),
					w: Math.round(r.width),
				});
			}
		}
		// horizontal scroll
		const hasHScroll = document.documentElement.scrollWidth > window.innerWidth + 2;
		// tab-like elements alignment sample
		const tabs = Array.from(
			document.querySelectorAll('[role="tab"], [role="tablist"] button, nav button, [data-tab]'),
		).slice(0, 20).map((el) => {
			const r = el.getBoundingClientRect();
			return {
				t: (el.innerText || "").slice(0, 40),
				x: Math.round(r.x),
				y: Math.round(r.y),
				h: Math.round(r.height),
				w: Math.round(r.width),
			};
		});
		const brokenImgs = Array.from(document.images)
			.filter((i) => !i.complete || i.naturalWidth === 0)
			.map((i) => i.src.slice(0, 100));
		const emptyButtons = Array.from(document.querySelectorAll("button"))
			.filter((b) => !b.innerText.trim() && !b.getAttribute("aria-label"))
			.length;
		return {
			title: document.title,
			h1,
			text,
			hasHScroll,
			overflows: overflows.slice(0, 8),
			tabs,
			brokenImgs: brokenImgs.slice(0, 5),
			emptyButtons,
			mainW: Math.round(main.getBoundingClientRect().width),
			vw: window.innerWidth,
		};
	});
	const safe = label.replace(/[^a-z0-9_-]+/gi, "_");
	const shot = `${outDir}/${safe}.png`;
	await page.screenshot({ path: shot, fullPage: false });
	// also mobile
	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForTimeout(400);
	const mobileScroll = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth + 2,
	);
	await page.screenshot({ path: `${outDir}/${safe}-m.png`, fullPage: false });
	await page.setViewportSize({ width: 1440, height: 900 });
	return {
		path,
		status,
		shot,
		mobileHScroll: mobileScroll,
		...metrics,
	};
}

const browser = await chromium.launch({ headless: true });
const report = { public: [], authed: [], console: [], pageErrors: [] };

// Public
{
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.on("console", (m) => {
		if (m.type() === "error") report.console.push(m.text().slice(0, 160));
	});
	page.on("pageerror", (e) => report.pageErrors.push(e.message.slice(0, 160)));
	for (const p of publicPaths) {
		try {
			report.public.push(await auditPage(page, p, `pub${p}`));
		} catch (e) {
			report.public.push({ path: p, error: e.message });
		}
	}
	await ctx.close();
}

// Authed
{
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	await ctx.addCookies([
		{
			name: "oma_session",
			value: JWT,
			url: "http://localhost:3000",
			httpOnly: true,
			sameSite: "Strict",
		},
		{
			name: "oma_session_meta",
			value: JSON.stringify({ authMethod: "account-number" }),
			url: "http://localhost:3000",
			httpOnly: false,
			sameSite: "Strict",
		},
	]);
	const page = await ctx.newPage();
	page.on("console", (m) => {
		if (m.type() === "error") report.console.push(m.text().slice(0, 160));
	});
	page.on("pageerror", (e) => report.pageErrors.push(e.message.slice(0, 160)));
	for (const p of authedPaths) {
		try {
			report.authed.push(await auditPage(page, p, `auth${p.replace("?", "_")}`));
		} catch (e) {
			report.authed.push({ path: p, error: e.message });
		}
	}

	// Settings tabs deep dive
	await page.goto("http://localhost:3000/settings", { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(2000);
	const settingsTabs = await page.evaluate(() => {
		const buttons = Array.from(document.querySelectorAll("button")).filter((b) =>
			/profile|wallets|api keys|sessions|danger/i.test(b.innerText),
		);
		return buttons.map((b) => {
			const r = b.getBoundingClientRect();
			const styles = getComputedStyle(b);
			return {
				text: b.innerText.replace(/\s+/g, " ").slice(0, 60),
				x: Math.round(r.x),
				y: Math.round(r.y),
				w: Math.round(r.width),
				h: Math.round(r.height),
				display: styles.display,
				align: styles.alignItems,
				justify: styles.justifyContent,
				textAlign: styles.textAlign,
			};
		});
	});
	report.settingsTabs = settingsTabs;

	// Click each settings tab and screenshot
	for (const name of ["Profile", "Wallets", "API keys", "Sessions", "Danger"]) {
		try {
			const btn = page.getByRole("button", { name: new RegExp(name, "i") }).first();
			if ((await btn.count()) > 0) {
				await btn.click();
				await page.waitForTimeout(900);
				await page.screenshot({
					path: `${outDir}/settings-${name.toLowerCase().replace(/\s+/g, "-")}.png`,
					fullPage: false,
				});
				const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
				report[`settings_${name}`] = body;
			}
		} catch (e) {
			report[`settings_${name}`] = e.message;
		}
	}

	// Dashboard tab row alignment
	await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(2500);
	report.dashboardTabs = await page.evaluate(() => {
		const candidates = Array.from(document.querySelectorAll("button, a")).filter((el) =>
			/^(OVERVIEW|USAGE|API KEYS|HEALTH|Overview|Usage|API Keys|Health)$/i.test(
				(el.innerText || "").trim(),
			),
		);
		return candidates.map((el) => {
			const r = el.getBoundingClientRect();
			return {
				t: el.innerText.trim(),
				x: Math.round(r.x),
				y: Math.round(r.y),
				h: Math.round(r.height),
				w: Math.round(r.width),
			};
		});
	});

	await ctx.close();
}

// Summarize issues
report.issues = [];
for (const group of ["public", "authed"]) {
	for (const p of report[group]) {
		if (p.error) report.issues.push(`${p.path}: ${p.error}`);
		if (p.hasHScroll) report.issues.push(`${p.path}: horizontal scroll desktop`);
		if (p.mobileHScroll) report.issues.push(`${p.path}: horizontal scroll mobile`);
		if (p.brokenImgs?.length) report.issues.push(`${p.path}: broken images ${p.brokenImgs.length}`);
		if (p.emptyButtons > 0) report.issues.push(`${p.path}: ${p.emptyButtons} unlabeled buttons`);
		if (p.status && p.status >= 400) report.issues.push(`${p.path}: HTTP ${p.status}`);
	}
}

writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ issues: report.issues, settingsTabs: report.settingsTabs, dashboardTabs: report.dashboardTabs, sample: report.authed.map(a => ({ path: a.path, h1: a.h1, hasHScroll: a.hasHScroll, mobileHScroll: a.mobileHScroll, emptyButtons: a.emptyButtons })) }, null, 2));
await browser.close();
