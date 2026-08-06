/**
 * Runtime smoke test — boots the real app and verifies key pages render
 * with no console errors, no failed requests. Catches the class of bug
 * where SSR routes reference stale/unhashed chunk paths.
 *
 * Run from app/:  npm run build && node scripts/smoke.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3211";

const PAGES = [
	"",
	"/chat",
	"/models",
	"/login",
	"/pricing",
	"/docs",
	"/deposit",
	"/settings",
	"/dashboard",
	"/privacy",
];

const browser = await chromium.launch({ headless: true });
const issues = [];
let failures = 0;

for (const path of PAGES) {
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	const errors = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") {
			const text = msg.text();
			if (text.includes("favicon") || text.indexOf("net::ERR_") >= 0) return;
			errors.push(text.slice(0, 220));
		}
	});
	page.on("pageerror", (err) => errors.push(`pageerror: ${String(err).slice(0, 220)}`));

	const failedRequests = [];
	page.on("requestfailed", (req) => {
		// Router-triggered prefetch aborts (`?_rsc=...`) are cancelled
		// intentionally when the page closes or the client navigates.
		if (req.url().includes("_rsc=")) return;
		failedRequests.push(`${req.url()} -> ${req.failure()?.errorText}`);
	});

	const resp = await page.goto(`${BASE}${path}`, {
		waitUntil: "networkidle",
		timeout: 30_000,
	});
	const status = resp?.status() ?? 0;
	const textLen = ((await page.evaluate(() => document.body?.innerText?.length)) ?? 0);

	const label = (path || "/").padEnd(12);
	if (status !== 200) failures++;
	if (textLen < 80) {
		errors.push(`body content suspiciously short (${textLen} chars)`);
	}
	console.log(
		`[${label}] ${status} · body=${String(textLen).padStart(7)} chars · errs=${errors.length} · failedReq=${failedRequests.length}`,
	);
	for (const e of errors) issues.push(`${path}: ${e}`);
	for (const f of failedRequests) issues.push(`${path}: FAILED ${f}`);
	await page.close();
}

// API endpoint sanity
try {
	const res = await fetch(`${BASE}/api/v1/models`);
	const json = await res.json();
	const count = json?.data?.length ?? "?";
	console.log(`[/api/v1/models] ${res.status} — ${count} models`);
	if (res.status !== 200 || !Array.isArray(json?.data)) failures++;
} catch (e) {
	console.log(`[/api/v1/models] fetch failed: ${e.message}`);
	failures++;
}

await browser.close();

for (const i of issues) console.log(`  ⚠ ${i}`);
if (failures > 0 || issues.length > 0) {
	console.log(`\nSMOKE FAILED — ${failures} page failures, ${issues.length} console issues`);
	process.exit(1);
}
console.log("\nSMOKE OK — all pages 200, no console errors, API responding");
process.exit(0);