import { test as base, expect, type Page, type Route } from "@playwright/test";

const address = "0x1111111111111111111111111111111111111111";
const userId = "browser-wallet-user";
const nonce = "BrowserNonce123";
const signature = `0x${"11".repeat(65)}`;

type SessionMode = "matching" | "wrong" | "hold";
type AuthApi = {
	magicRequests: Array<{ email: string; callbackURL: string; errorCallbackURL: string }>;
	verifyRequests: Array<{ message: string; signature: string }>;
	magicStatus: number;
	nonceStatus: number;
	verifyStatus: number;
	sessionMode: SessionMode;
	sessionRefreshCount: number;
};

export const test = base.extend<{ authApi: AuthApi }>({
	authApi: [async ({ page, baseURL }, use) => {
		if (!baseURL) throw new Error("Auth tests require a local baseURL");
		const origin = new URL(baseURL).origin;
		const unexpected: string[] = [];
		const errors: string[] = [];
		const held = new Set<Route>();
		let verified = false;
		const api: AuthApi = { magicRequests: [], verifyRequests: [], magicStatus: 200, nonceStatus: 200, verifyStatus: 200, sessionMode: "matching", sessionRefreshCount: 0 };
		page.on("pageerror", error => errors.push(error.message));
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.route("**/*", async route => {
			const request = route.request();
			const url = new URL(request.url());
			if (url.origin !== origin) {
				if (/\/(?:api\/)?(?:v1|auth)\//.test(url.pathname)) unexpected.push(request.url());
				await route.abort("blockedbyclient"); return;
			}
			if (!url.pathname.startsWith("/api/")) { await route.continue(); return; }
			if (url.pathname === "/api/auth/get-session") {
				if (verified && !url.searchParams.has("disableCookieCache")) api.sessionRefreshCount++;
				if (verified && api.sessionMode === "hold") { held.add(route); return; }
				const id = api.sessionMode === "wrong" ? "different-user" : userId;
				await route.fulfill({ json: verified ? { user: { id, name: "Browser test", email: "browser@example.test", emailVerified: true, evmAddress: address }, session: { id: "browser-session", userId: id, expiresAt: "2099-01-01T00:00:00.000Z", token: "synthetic" } } : null }); return;
			}
			if (url.pathname === "/api/auth/sign-in/magic-link" && request.method() === "POST") {
				api.magicRequests.push(request.postDataJSON());
				await route.fulfill({ status: api.magicStatus, json: api.magicStatus === 200 ? { status: true } : { message: "Email temporarily unavailable" } }); return;
			}
			if (url.pathname === "/api/auth/siwe/nonce" && request.method() === "POST") {
				await route.fulfill({ status: api.nonceStatus, json: api.nonceStatus === 200 ? { nonce } : { message: "Nonce unavailable" } }); return;
			}
			if (url.pathname === "/api/auth/siwe/verify" && request.method() === "POST") {
				api.verifyRequests.push(request.postDataJSON());
				if (api.verifyStatus === 200) verified = true;
				await route.fulfill({ status: api.verifyStatus, json: api.verifyStatus === 200 ? { success: true, user: { id: userId, walletAddress: address, chainId: 8453 } } : { message: "Signature rejected" } }); return;
			}
			if (url.pathname === "/api/health" || url.pathname === "/api/ready") { await route.fulfill({ json: { status: url.pathname === "/api/ready" ? "ready" : "ok" } }); return; }
			if (url.pathname === "/api/v1/site-settings") { await route.fulfill({ json: { maintenanceMode: false, maintenanceMessage: null } }); return; }
			if (url.pathname === "/api/v1/models") { await route.fulfill({ json: { object: "list", data: [] } }); return; }
			if (url.pathname === "/api/v1/balance") { await route.fulfill({ status: 401, json: { error: { message: "Authentication required" } } }); return; }
			unexpected.push(`${request.method()} ${url.pathname}`);
			await route.fulfill({ status: 501, json: { message: "Unexpected API call in auth test" } });
		});
		try { await use(api); } finally { for (const route of held) await route.abort("aborted").catch(() => {}); }
		expect(unexpected, "All auth API calls must use explicit fixtures").toEqual([]);
		expect(errors, "No unhandled browser errors").toEqual([]);
	}, { auto: true }],
});

/** Install a synthetic EIP-1193 provider before navigating to the app. */
export async function installWallet(page: Page, rejectFirst = false) {
	await page.addInitScript(({ walletAddress, fakeSignature, reject }) => {
		let rejectNext = reject;
		Object.defineProperty(window, "ethereum", { configurable: true, value: {
			isMetaMask: true,
			request: async ({ method }: { method: string }) => {
				if (method === "eth_requestAccounts") {
					if (rejectNext) { rejectNext = false; throw Object.assign(new Error("User rejected"), { code: 4001 }); }
					return [walletAddress];
				}
				if (method === "eth_accounts") return [walletAddress];
				if (method === "eth_chainId") return "0x2105";
				if (method === "personal_sign") return fakeSignature;
				throw new Error(`Unexpected wallet method ${method}`);
			},
			on() {}, removeListener() {},
		} });
	}, { walletAddress: address, fakeSignature: signature, reject: rejectFirst });
}

export { expect, address, nonce, signature };
