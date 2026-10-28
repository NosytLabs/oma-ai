import { beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { Hono } from "hono";

const memory = vi.hoisted(() => ({ user: [], session: [], account: [], verification: [], walletAddress: [] }));
vi.mock("../../db/client.js", () => ({ db: {} }));
vi.mock("better-auth/adapters/drizzle", async () => {
	const { memoryAdapter } = await import("better-auth/adapters/memory");
	return { drizzleAdapter: () => memoryAdapter(memory) };
});
vi.mock("../../config.js", () => ({ config: {
	NODE_ENV: "production", PRIMARY_DOMAIN: "oma-ai.com", PUBLIC_APP_URL: "https://www.oma-ai.com", FREE_SIGNUP_CENTS: 0, BASE_CHAIN_ID: 8453,
	BETTER_AUTH_SECRET: "hosted-origin-fixture-e8ae3cadfeab62f9f4e94572e6347d55",
} }));
vi.mock("viem", async () => ({ ...await vi.importActual<typeof import("viem")>("viem"), createPublicClient: () => ({ getEnsName: async () => null }) }));

vi.mock("../middleware.js", () => ({ sessionAuth: async (c: any, next: () => Promise<void>) => { c.set("userId", "attachment-fixture-owner"); await next(); } }));
vi.mock("../../middleware/rate-limit.js", () => ({ rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../../middleware/audit.js", () => ({ auditLog: async () => {} }));

import { auth } from "../../auth.js";
import { authRoutes } from "../../routes/auth.js";
const origin = "https://www.oma-ai.com";
const wallet = privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123");
async function post(path: string, body: object) {
	return auth.handler(new Request(`${origin}/api/auth${path}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
}
async function login(domain = "www.oma-ai.com", uri = origin, scheme: string | null = "https") {
	const { nonce } = await (await post("/siwe/nonce", {})).json();
	const message = createSiweMessage({ address: wallet.address, domain, uri, ...(scheme ? { scheme } : {}), version: "1", chainId: 8453, nonce });
	return post("/siwe/verify", { message, signature: await wallet.signMessage({ message }) });
}
beforeEach(() => { for (const rows of Object.values(memory)) rows.length = 0; });

describe("hosted SIWE origin binding", () => {
	it("issues wallet attachment challenges for the same exact canonical www authority", async () => {
		const app = new Hono().route("/", authRoutes);
		const response = await app.request(`${origin}/v1/user/attach-wallet/nonce`, { method: "POST" });
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ domain: "www.oma-ai.com", chainId: 8453 });
	});

	it.each(["https", null])("accepts a www-origin signature with scheme %s", async scheme => {
		expect((await login("www.oma-ai.com", `${origin}/login?method=wallet`, scheme)).status).toBe(200);
		expect(memory.session).toHaveLength(1);
	});
	it.each(["oma-ai.com", "www.oma-ai.com:8443", "untrusted.example"])("rejects the different signed authority %s", async domain => {
		expect((await login(domain)).status).toBe(401);
		expect(memory.user).toHaveLength(0);
	});
	it.each(["https://www.oma-ai.com/path", "https://https://www.oma-ai.com"])("rejects the malformed signed authority %s without creating an account", async authority => {
		const { nonce } = await (await post("/siwe/nonce", {})).json();
		// Build valid fields, then sign malformed header bytes so the test
		// exercises the real plugin's permissive authority normalization.
		const message = createSiweMessage({ address: wallet.address, domain: "www.oma-ai.com", uri: origin, scheme: "https", version: "1", chainId: 8453, nonce })
			.replace("https://www.oma-ai.com wants", `${authority} wants`);
		const response = await post("/siwe/verify", { message, signature: await wallet.signMessage({ message }) });
		expect(response.status).toBe(401);
		expect(memory.user).toHaveLength(0);
		expect(memory.session).toHaveLength(0);
	});

	it.each([
		["https://oma-ai.com", "https"], [origin, "http"],
		["http://www.oma-ai.com", "https"], ["https://user:pass@www.oma-ai.com", "https"],
		["https://untrusted.example", "https"],
	])("rejects a valid signature with URI %s and scheme %s", async (uri, scheme) => {
		expect((await login("www.oma-ai.com", uri, scheme)).status).toBe(401);
		expect(memory.user).toHaveLength(0);
	});
});
