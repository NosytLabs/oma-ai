/**
 * Real-user smoke: inject session cookie from seed account and walk dashboard.
 * Usage: node scripts/e2e-seed-user.mjs
 * Prefers data/seed/session.jwt + account-number.txt, falls back to /tmp.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const require = createRequire(join(__dirname, "../app/package.json"));
const { chromium } = require("playwright");

function readFirst(...paths) {
	for (const p of paths) {
		if (existsSync(p)) return readFileSync(p, "utf8").trim();
	}
	throw new Error(`Missing seed file. Tried: ${paths.join(", ")}`);
}

const JWT = readFirst(
	resolve(root, "data/seed/session.jwt"),
	"/tmp/oma-jwt.txt",
);
const ACCT = readFirst(
	resolve(root, "data/seed/account-number.txt"),
	"/tmp/oma-acct.txt",
);

// Keep /tmp copies in sync for ad-hoc curl
writeFileSync("/tmp/oma-jwt.txt", JWT);
writeFileSync("/tmp/oma-acct.txt", ACCT);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([
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

const page = await context.newPage();
const consoleErrs = [];
const pageErrs = [];
const networkFail = [];
page.on("console", (m) => {
	if (m.type() === "error") consoleErrs.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => pageErrs.push(e.message.slice(0, 200)));
page.on("response", (r) => {
	if (r.status() >= 400) {
		networkFail.push({ url: r.url().slice(0, 160), status: r.status() });
	}
});

mkdirSync("/tmp/oma-ux-user", { recursive: true });
const results = [];

async function visit(path, waitMs = 3200) {
	await page.goto(`http://localhost:3000${path}`, {
		waitUntil: "domcontentloaded",
		timeout: 45000,
	});
	await page.waitForTimeout(waitMs);
	const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
	const title = await page.title();
	const shot = `/tmp/oma-ux-user${path.replace(/\//g, "_") || "_home"}.png`;
	await page.screenshot({ path: shot, fullPage: false });
	return { path, title, body: body.slice(0, 1200) };
}

// --- Dashboard overview (charts / tabs) ---
const dash = await visit("/dashboard", 4000);
results.push({
	path: dash.path,
	title: dash.title,
	signedIn: !/sign in to your dashboard/i.test(dash.body),
	notDemo: !/demo mode/i.test(dash.body),
	hasBalance: /\$50|50\.00|5,000|5000|credit balance|available funds|\$0\.00/i.test(
		dash.body,
	),
	hasBalance50: /\$50\.00|50\.00/i.test(dash.body),
	hasTabs: /overview|usage|api keys|health/i.test(dash.body),
	hasCharts: /24H|7D|30D|ALL|usage|request|token/i.test(dash.body),
	noUndefinedPrefix: !/undefined\*{2,}/i.test(dash.body),
	snippet: dash.body.slice(0, 400),
});

// Usage tab
await page.goto("http://localhost:3000/dashboard?tab=usage", {
	waitUntil: "domcontentloaded",
	timeout: 45000,
});
await page.waitForTimeout(2500);
const usageBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
await page.screenshot({ path: "/tmp/oma-ux-user/dashboard_usage.png" });
results.push({
	path: "/dashboard?tab=usage",
	hasUsageUi: /usage|request|model|no request|empty|token/i.test(usageBody),
	snippet: usageBody.slice(0, 300),
});

// Health tab
await page.goto("http://localhost:3000/dashboard?tab=health", {
	waitUntil: "domcontentloaded",
	timeout: 45000,
});
await page.waitForTimeout(2500);
const healthBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
await page.screenshot({ path: "/tmp/oma-ux-user/dashboard_health.png" });
results.push({
	path: "/dashboard?tab=health",
	hasHealthUi: /health|provider|latency|status|system/i.test(healthBody),
	snippet: healthBody.slice(0, 300),
});

const credits = await visit("/dashboard/credits");
results.push({
	path: credits.path,
	signedIn: !/sign in to view credits/i.test(credits.body),
	hasBalance: /\$50|50\.00|5,000|5000|credit/i.test(credits.body),
	hasTopUp: /top up|buy credits|usdc|amount/i.test(credits.body),
	snippet: credits.body.slice(0, 350),
});

const keys = await visit("/dashboard/api-keys", 3500);
results.push({
	path: keys.path,
	signedIn: !/sign in to manage/i.test(keys.body),
	hasSeedKey: /seed-dev-key|e2e-user-key|oma_sk_/i.test(keys.body),
	noUndefinedPrefix: !/undefined\*{2,}/i.test(keys.body),
	hasMaskedPrefix: /oma_sk_[A-Za-z0-9]+\*{2,}|••••\*{2,}/i.test(keys.body),
	snippet: keys.body.slice(0, 450),
});

// Create key via UI
let createKey = { attempted: false, success: false, detail: "" };
try {
	await page.goto("http://localhost:3000/dashboard/api-keys", {
		waitUntil: "domcontentloaded",
		timeout: 45000,
	});
	await page.waitForTimeout(2000);
	const plus = page.locator("button").filter({ hasText: /create|new|add/i }).first();
	if ((await plus.count()) > 0) {
		createKey.attempted = true;
		await plus.click();
		await page.waitForTimeout(600);
		const nameInput = page
			.locator('input[placeholder*="name" i], input[placeholder*="Key" i]')
			.first();
		if ((await nameInput.count()) > 0) {
			await nameInput.fill("e2e-walkthrough-key");
			const submit = page
				.locator("button")
				.filter({ hasText: /create|generate|add|save/i })
				.last();
			await submit.click();
			await page.waitForTimeout(2500);
			const body = await page.locator("body").innerText();
			createKey.success = /e2e-walkthrough-key|oma_sk_/i.test(body);
			createKey.detail = body.replace(/\s+/g, " ").slice(0, 500);
			createKey.noUndefined = !/undefined\*{2,}/i.test(body);
			await page.screenshot({ path: "/tmp/oma-ux-user/create-key.png" });
		} else {
			createKey.detail = "no name input visible";
		}
	} else {
		createKey.detail = "no create button";
	}
} catch (e) {
	createKey.detail = e.message;
}

const settings = await visit("/settings", 3500);
results.push({
	path: settings.path,
	signedIn: !/sign in to manage your account/i.test(settings.body),
	seesAccount:
		settings.body.includes(ACCT) ||
		settings.body.includes("0876") ||
		/profile|account number|api keys/i.test(settings.body),
	hasTabs: /profile|wallets|api keys|sessions|danger/i.test(settings.body),
	snippet: settings.body.slice(0, 450),
});

// Settings wallets tab (account number surface)
try {
	const walletsTab = page.getByRole("button", { name: /wallets/i }).first();
	if ((await walletsTab.count()) > 0) {
		await walletsTab.click();
		await page.waitForTimeout(1200);
		const wb = (await page.locator("body").innerText()).replace(/\s+/g, " ");
		await page.screenshot({ path: "/tmp/oma-ux-user/settings_wallets.png" });
		results.push({
			path: "/settings#wallets",
			showsAccountNumber: wb.includes(ACCT) || /0876|account number/i.test(wb),
			snippet: wb.slice(0, 400),
		});
	}
} catch (e) {
	results.push({ path: "/settings#wallets", error: e.message });
}

const deposit = await visit("/deposit");
results.push({
	path: deposit.path,
	reachable: true,
	hasDepositUi: /deposit|usdc|amount|pay|wallet|credit/i.test(deposit.body),
	snippet: deposit.body.slice(0, 300),
});

const chat = await visit("/chat", 3500);
results.push({
	path: chat.path,
	notOnLogin: !/sign in once|sign in to oma/i.test(chat.body),
	hasChatUi: /model|params|web|prompt|instructions|message/i.test(chat.body),
	showsCredits: /50\.00|cr|credit/i.test(chat.body),
	snippet: chat.body.slice(0, 350),
});

// Browser-side API checks with session cookie
const bal = await page.evaluate(async () => {
	const res = await fetch("/api/v1/balance", { credentials: "same-origin" });
	return { status: res.status, text: (await res.text()).slice(0, 400) };
});
const creditsBal = await page.evaluate(async () => {
	const res = await fetch("/api/v1/credits/balance", {
		credentials: "same-origin",
	});
	return { status: res.status, text: (await res.text()).slice(0, 500) };
});
const user = await page.evaluate(async () => {
	const res = await fetch("/api/user", { credentials: "same-origin" });
	return { status: res.status, text: (await res.text()).slice(0, 400) };
});
const keyList = await page.evaluate(async () => {
	const res = await fetch("/api/keys", { credentials: "same-origin" });
	return { status: res.status, text: (await res.text()).slice(0, 700) };
});
const usageApi = await page.evaluate(async () => {
	const res = await fetch("/api/v1/usage?limit=10", {
		credentials: "same-origin",
	});
	return { status: res.status, text: (await res.text()).slice(0, 300) };
});
const txs = await page.evaluate(async () => {
	const res = await fetch("/api/v1/credits/transactions?limit=5", {
		credentials: "same-origin",
	});
	return { status: res.status, text: (await res.text()).slice(0, 400) };
});
const autoReload = await page.evaluate(async () => {
	const res = await fetch("/api/v1/credits/auto-reload", {
		credentials: "same-origin",
	});
	return { status: res.status, text: (await res.text()).slice(0, 300) };
});

// Normalized listKeys path via Next rewrite may differ — check client mapping by evaluating prefix in DOM after reload
await page.goto("http://localhost:3000/dashboard/api-keys", {
	waitUntil: "networkidle",
	timeout: 45000,
}).catch(() => {});
await page.waitForTimeout(2000);
const keysDom = (await page.locator("body").innerText()).replace(/\s+/g, " ");
const keysPrefixCheck = {
	noUndefined: !/undefined\*{2,}/i.test(keysDom),
	hasOmaPrefix: /oma_sk_[A-Za-z0-9]+/i.test(keysDom),
	snippet: keysDom.slice(0, 500),
};

const out = {
	account: ACCT,
	results,
	createKey,
	keysPrefixCheck,
	api: { bal, creditsBal, user, keyList, usageApi, txs, autoReload },
	consoleErrs: consoleErrs.slice(0, 20),
	pageErrs,
	networkFail: networkFail
		.filter((n) => !n.url.includes("favicon") && !n.url.includes("sentry"))
		.slice(0, 25),
};
writeFileSync("/tmp/oma-ux-user/report.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
