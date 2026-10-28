import { test as base, expect, type Page, type Route } from "@playwright/test";

export const walletAddress = "0x1111111111111111111111111111111111111111";
const treasury = "0x2222222222222222222222222222222222222222";
type HeldRequest = { started: Promise<void>; release: () => Promise<void> };
interface DepositApi {
	userId: string;
	sessionUsers: string[];
	externalNavigations: string[];
	holdCheckout: () => HeldRequest;
	holdChallenge: () => HeldRequest;
	switchAccount: (userId: string) => Promise<void>;
}

export const test = base.extend<{ depositApi: DepositApi }>({
	depositApi: [async ({ page, baseURL }, use) => {
		if (!baseURL) throw new Error("Deposit tests require a local baseURL");
		const origin = new URL(baseURL).origin;
		const unexpected: string[] = [];
		const errors: string[] = [];
		const held = new Set<Route>();
		const receive = new Map<string, (route: Route) => void>();
		const hold = (path: string, json: unknown): HeldRequest => {
			let receiveRoute!: (route: Route) => void;
			const pending = new Promise<Route>(resolve => { receiveRoute = resolve; });
			receive.set(path, receiveRoute);
			return {
				started: pending.then(() => {}),
				release: async () => {
					const route = await pending;
					held.delete(route);
					const response = page.waitForResponse(result => result.url() === route.request().url() && result.request().method() === "POST");
					await route.fulfill({ json });
					await (await response).finished();
					// Let response parsing and React's resulting effects commit.
					await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
				},
			};
		};
		const api: DepositApi = {
			userId: "deposit-account-a", sessionUsers: [], externalNavigations: [],
			holdCheckout: () => hold("/api/v1/checkout", { id: "synthetic-checkout", url: "https://checkout.polar.sh/synthetic-never-open" }),
			holdChallenge: () => hold("/api/v1/deposit/usdc/challenge", { token: "synthetic-challenge", nonce: "synthetic-nonce", expiresAt: Date.now() + 300_000 }),
			switchAccount: async userId => {
				api.userId = userId;
				const response = page.waitForResponse(result => new URL(result.url()).pathname === "/api/auth/get-session");
				await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
				expect((await (await response).json()).user.id).toBe(userId);
			},
		};
		page.on("pageerror", error => errors.push(error.message));
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.route("**/*", async route => {
			const request = route.request();
			const url = new URL(request.url());
			if (url.origin !== origin) {
				if (request.isNavigationRequest()) api.externalNavigations.push(request.url());
				if (/\/(?:api\/)?(?:v1|auth)\//.test(url.pathname)) unexpected.push(request.url());
				await route.abort("blockedbyclient"); return;
			}
			if (!url.pathname.startsWith("/api/")) { await route.continue(); return; }
			if (url.pathname === "/api/auth/get-session") {
				const id = api.userId;
				api.sessionUsers.push(id);
				await route.fulfill({ json: { user: { id, name: id, email: `${id}@example.test`, emailVerified: true, evmAddress: walletAddress, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }, session: { id: `session-${id}`, userId: id, token: "synthetic", expiresAt: "2099-01-01T00:00:00Z" } } }); return;
			}
			const receiver = receive.get(url.pathname);
			if (receiver && request.method() === "POST") { receive.delete(url.pathname); held.add(route); receiver(route); return; }
			if (url.pathname === "/api/v1/site-settings") { await route.fulfill({ json: { maintenanceMode: false, cardPaymentsEnabled: true, cryptoPaymentsEnabled: true, usdcDepositConfigured: true, polarConfigured: true, x402Configured: true } }); return; }
			if (url.pathname === "/api/v1/deposit/usdc" && request.method() === "GET") { await route.fulfill({ json: { depositAddress: treasury, network: "base", chainId: 8453, usdcContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", minDepositCents: 100, maxDepositCents: 1_000_000, creditsPerCent: 1 } }); return; }
			if (url.pathname === "/api/v1/deposit/status") { await route.fulfill({ json: { deposits: [] } }); return; }
			if (url.pathname === "/api/v1/balance") { await route.fulfill({ json: { balanceCents: 1000 } }); return; }
			if (url.pathname === "/api/health" || url.pathname === "/api/ready") { await route.fulfill({ json: { status: url.pathname === "/api/ready" ? "ready" : "ok" } }); return; }
			if (url.pathname === "/api/v1/models") { await route.fulfill({ json: { object: "list", data: [] } }); return; }
			unexpected.push(`${request.method()} ${url.pathname}`);
			await route.fulfill({ status: 501, json: { message: "Unexpected deposit test API request" } });
		});
		try { await use(api); } finally { for (const route of held) await route.abort("aborted").catch(() => {}); }
		expect(unexpected, "Every deposit API request must use an explicit local fixture").toEqual([]);
		expect(errors, "Deposit flows must not raise unhandled browser errors").toEqual([]);
	}, { auto: true }],
});

/** A synthetic provider records prompts but never broadcasts or signs. */
export async function installDepositWallet(page: Page): Promise<void> {
	await page.addInitScript(address => {
		const calls: string[] = [];
		Object.defineProperty(window, "depositWalletCalls", { value: calls });
		Object.defineProperty(window, "ethereum", { configurable: true, value: {
			isMetaMask: true,
			request: async ({ method }: { method: string }) => {
				calls.push(method);
				if (method === "eth_accounts" || method === "eth_requestAccounts") return [address];
				if (method === "eth_chainId") return "0x2105";
				throw new Error(`No transaction or signature is permitted in this test: ${method}`);
			},
			on() {}, removeListener() {},
		} });
	}, walletAddress);
}

export { expect };
