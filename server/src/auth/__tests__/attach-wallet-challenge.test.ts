import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { DrizzleQueryError } from "drizzle-orm/errors";

// Keep Better Auth's real atomic verification-value implementation. Only
// storage, authenticated-session setup and external rate limiting are fixtures.
const memory = vi.hoisted(() => ({ user: [], session: [], account: [], verification: [] as Record<string, unknown>[], walletAddress: [] }));
const storage = vi.hoisted(() => ({
	bindings: [] as Record<string, unknown>[],
	select: vi.fn(), transaction: vi.fn(),
}));
vi.mock("../../db/client.js", () => ({ db: storage }));
vi.mock("better-auth/adapters/drizzle", async () => {
	const { memoryAdapter } = await import("better-auth/adapters/memory");
	return { drizzleAdapter: () => memoryAdapter(memory) };
});
vi.mock("../../config.js", () => ({ config: {
	NODE_ENV: "test", PUBLIC_APP_URL: "http://localhost:3000", BASE_CHAIN_ID: 8453, FREE_SIGNUP_CENTS: 0,
	BETTER_AUTH_SECRET: "attach-wallet-regression-secret-96ba02e8-74cf-4fdb",
} }));
vi.mock("../middleware.js", () => ({ sessionAuth: async (c: any, next: () => Promise<void>) => {
	const id = c.req.header("cookie");
	if (!id) return c.json({ error: "Unauthorized" }, 401);
	c.set("userId", id); c.set("user", { id });
	await next();
} }));
vi.mock("../../middleware/rate-limit.js", () => ({ rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../../middleware/audit.js", () => ({ auditLog: async () => {} }));
vi.mock("../../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() } }));

import { auth } from "../../auth.js";
import { authRoutes } from "../../routes/auth.js";
import { logger } from "../../lib/logger.js";

const wallet = privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123");
const app = new Hono().route("/", authRoutes);
function post(path: string, body: unknown, owner = "account-a") {
	return app.request(`http://localhost:3000${path}`, { method: "POST", headers: { cookie: owner, "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function signed(nonce: string, domain = "localhost:3000", chainId = 8453, uri = "http://localhost:3000", scheme: string | null = "http") {
	const message = createSiweMessage({ address: wallet.address, domain, chainId, nonce, ...(scheme ? { scheme } : {}), uri, version: "1" });
	return { message, signature: await wallet.signMessage({ message }), address: wallet.address };
}
async function challenge(owner = "account-a") {
	const response = await post("/v1/user/attach-wallet/nonce", {}, owner);
	expect(response.status).toBe(200);
	return response.json();
}
beforeEach(() => {
	vi.clearAllMocks();
	for (const rows of Object.values(memory)) rows.length = 0;
	storage.bindings.length = 0;
	storage.select.mockImplementation(() => ({ from: () => ({ where: () => ({ limit: async () => storage.bindings }) }) }));
	storage.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn({
		insert: () => ({ values: async (values: Record<string, unknown>) => { storage.bindings.push(values); } }),
		update: () => ({ set: () => ({ where: async () => {} }) }),
	}));
});

describe("account-bound wallet attachment", () => {
	it("returns a retryable error when challenge storage is unavailable", async () => {
		const { internalAdapter } = await auth.$context;
		vi.spyOn(internalAdapter, "createVerificationValue").mockRejectedValueOnce(new Error("challenge store disconnected"));
		const response = await post("/v1/user/attach-wallet/nonce", {});
		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({ error: { type: "service_unavailable", code: "auth_validation_unavailable" } });
		expect(memory.verification).toHaveLength(0);
		expect(storage.transaction).not.toHaveBeenCalled();
	});

	it("does not classify a challenge-consumption outage as an invalid signature", async () => {
		const { nonce } = await challenge();
		const { internalAdapter } = await auth.$context;
		vi.spyOn(internalAdapter, "consumeVerificationValue").mockRejectedValueOnce(new DrizzleQueryError("delete from verification", [nonce], new Error("challenge store disconnected")));
		const response = await post("/v1/user/attach-wallet", await signed(nonce));
		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({ error: { type: "service_unavailable", code: "auth_validation_unavailable" } });
		expect(storage.transaction).not.toHaveBeenCalled();
		expect(storage.bindings).toHaveLength(0);
		expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(nonce);
	});

	it.each([
		["http://localhost:3000", null], ["http://localhost:3000", "https"],
		["http://untrusted.example", "http"], ["http://user:pass@localhost:3000", "http"],
	])("rejects attachment URI %s and header scheme %s before binding", async (uri, scheme) => {
		const { nonce } = await challenge();
		const response = await post("/v1/user/attach-wallet", await signed(nonce, "localhost:3000", 8453, uri!, scheme));
		expect(response.status).toBe(400);
		expect(storage.transaction).not.toHaveBeenCalled();
	});

	it("issues a five-minute challenge bound to this account and canonical local origin", async () => {
		const result = await challenge();
		expect(result).toMatchObject({ domain: "localhost:3000", chainId: 8453 });
		expect(result.nonce).toMatch(/^[a-zA-Z0-9]{32}$/);
		expect(Date.parse(result.expiresAt) - Date.now()).toBeGreaterThan(295_000);
		expect(memory.verification[0]?.value).toBe("account-a");
	});

	it("rejects a historical signature without a server challenge even when it has no expiry", async () => {
		const response = await post("/v1/user/attach-wallet", await signed("historicalnonce123"));
		expect(response.status).toBe(400);
		expect(storage.transaction).not.toHaveBeenCalled();
	});

	it("does not accept a login nonce for wallet attachment", async () => {
		const context = await auth.$context;
		await context.internalAdapter.createVerificationValue({ identifier: "siwe:loginpurpose123", value: "loginpurpose123", expiresAt: new Date(Date.now() + 300_000) });
		const response = await post("/v1/user/attach-wallet", await signed("loginpurpose123"));
		expect(response.status).toBe(400);
		expect(storage.transaction).not.toHaveBeenCalled();
	});

	it("does not accept a wallet attachment challenge for SIWE login", async () => {
		const { nonce } = await challenge();
		const { message, signature } = await signed(nonce);
		const response = await auth.handler(new Request("http://localhost:3000/api/auth/siwe/verify", {
			method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ message, signature }),
		}));
		expect(response.status).toBe(401);
		expect(memory.session).toHaveLength(0);
		expect(storage.bindings).toHaveLength(0);
	});

	it("rejects the same signed challenge under another account", async () => {
		const { nonce } = await challenge();
		const response = await post("/v1/user/attach-wallet", await signed(nonce), "account-b");
		expect(response.status).toBe(400);
		expect(storage.transaction).not.toHaveBeenCalled();
	});

	it("rejects an expired server challenge even if the signed message has no expiry", async () => {
		const { nonce } = await challenge();
		memory.verification[0]!.expiresAt = new Date(Date.now() - 1_000);
		const response = await post("/v1/user/attach-wallet", await signed(nonce));
		expect(response.status).toBe(400);
		expect(storage.transaction).not.toHaveBeenCalled();
	});

	it.each([["attacker.example", 8453], ["localhost:3000", 1]])("rejects signed domain/chain mismatch %s %s", async (domain, chainId) => {
		const { nonce } = await challenge();
		const response = await post("/v1/user/attach-wallet", await signed(nonce, domain as string, chainId as number));
		expect(response.status).toBe(400);
		expect(storage.transaction).not.toHaveBeenCalled();
	});

	it("allows only one of two concurrent submissions and rejects subsequent replay", async () => {
		const { nonce } = await challenge();
		const body = await signed(nonce);
		const responses = await Promise.all([post("/v1/user/attach-wallet", body), post("/v1/user/attach-wallet", body)]);
		expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
		expect(storage.bindings).toHaveLength(1);
		expect(storage.bindings[0]).toMatchObject({ userId: "account-a", address: wallet.address, chainId: 8453 });
		expect((await post("/v1/user/attach-wallet", body)).status).toBe(400);
	});

	it("returns a conflict when another request wins the database's wallet uniqueness check", async () => {
		const { nonce } = await challenge();
		storage.transaction.mockRejectedValueOnce(new DrizzleQueryError("insert into wallet_address", [], Object.assign(new Error("unique constraint"), { code: "23505" })));
		const response = await post("/v1/user/attach-wallet", await signed(nonce));
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ error: { type: "conflict_error", code: "wallet_already_linked" } });
	});
});
