import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { polarRoutes, isAllowedCheckoutOrigin } from "../polar.js";
import crypto from "node:crypto";

const mockConfig = vi.hoisted(() => ({
	POLAR_ACCESS_TOKEN: "polar_test_token",
	POLAR_WEBHOOK_SECRET: "test-secret",
	POLAR_HOBBY_PRODUCT_ID: "prod_hobby",
	POLAR_BUILDER_PRODUCT_ID: "prod_builder",
	POLAR_SCALE_PRODUCT_ID: "prod_scale",
	PUBLIC_APP_URL: "http://localhost:3000",
	PRIMARY_DOMAIN: "oma-ai.com",
	NODE_ENV: "test"
}));

vi.mock("@polar-sh/sdk/2026-10", async (importOriginal) => ({ ...await importOriginal<typeof import("@polar-sh/sdk/2026-10")>(), createPolar: () => ({ checkouts: { create: async () => ({ id: "checkout-test", url: "https://checkout.example.test" }) } }) }));

const mockDb = vi.hoisted(() => ({
	select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
	limit: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../config.js", () => ({
	config: mockConfig,
	isProductionEnv: mockConfig.NODE_ENV !== "test" ? true : false,
}));

vi.mock("../../db/client.js", () => ({
	db: mockDb,
}));

vi.mock("../../auth/middleware.js", () => ({
	sessionOrBearerAuth: vi.fn(async (c, next) => {
		c.set("userId", "test-user");
		return next();
	}),
}));

// Route behavior is the subject of this suite; Redis-backed throttling is not.
// Leaving the real middleware mounted makes every request wait for Redis and
// turns an infrastructure timeout into an unrelated 503 assertion failure.
vi.mock("../../middleware/rate-limit.js", () => ({
	rateLimit: vi.fn(
		() => async (_c: unknown, next: () => Promise<void>) => next(),
	),
}));

function generateSignature(secret: string, id: string, timestamp: number, body: string) {
	const hmac = crypto.createHmac("sha256", secret)
		.update(`${id}.${timestamp}.${body}`)
		.digest("base64");
	return `v1,${hmac}`;
}

describe("polar routes", () => {
	const app = new Hono();
	app.route("/", polarRoutes);

	beforeEach(() => {
		vi.clearAllMocks();
		// The missing-secret case mutates this shared hoisted object. Restore the
		// configured default before every test so order and failure paths cannot
		// leak a 503 state into the rest of the suite.
		mockConfig.POLAR_WEBHOOK_SECRET = "test-secret";
	});

	it("refuses checkout when the operator's payment settings are unreachable", async () => {
		mockDb.limit.mockRejectedValueOnce(new Error("private database connection failure"));
		const response = await app.request("/v1/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "hobby" }) });
		expect(response.status).toBe(503);
		expect(await response.text()).not.toMatch(/private database connection/);
	});

	describe("POST /webhooks/polar", () => {
		it("rejects if POLAR_WEBHOOK_SECRET is not configured", async () => {
			const originalSecret = mockConfig.POLAR_WEBHOOK_SECRET;
			mockConfig.POLAR_WEBHOOK_SECRET = "";
			
			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body: "{}"
			});
			
			expect(res.status).toBe(503);
			mockConfig.POLAR_WEBHOOK_SECRET = originalSecret;
		});

		it("rejects missing signature headers", async () => {
			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body: "{}"
			});
			
			expect(res.status).toBe(401);
		});

		it("rejects invalid signature", async () => {
			const body = JSON.stringify({ type: "test" });
			const id = "evt_123";
			const ts = Math.floor(Date.now() / 1000).toString();
			
			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body,
				headers: {
					"webhook-id": id,
					"webhook-timestamp": ts,
					"webhook-signature": "v1,invalid-sig"
				}
			});
			
			expect(res.status).toBe(401);
		});

		it("rejects invalid JSON", async () => {
			const body = "{ invalid json }";
			const id = "evt_123";
			const ts = Math.floor(Date.now() / 1000);
			const sig = generateSignature("test-secret", id, ts, body);
			
			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body,
				headers: {
					"webhook-id": id,
					"webhook-timestamp": ts.toString(),
					"webhook-signature": sig
				}
			});
			
			expect(res.status).toBe(400);
		});


	});

	describe("checkout successUrl origin allow-list (open-redirect fix)", () => {
		it("allows the app's own production origin (www + apex) always", () => {
			// Prod app domains are honoured in every environment.
			expect(isAllowedCheckoutOrigin("https://www.oma-ai.com/dashboard?deposit=success")).toBe(true);
			expect(isAllowedCheckoutOrigin("https://oma-ai.com/dashboard?deposit=success")).toBe(true);
		});

		it("allows localhost success URLs only outside production (dev/test)", () => {
			// Under NODE_ENV=test (the suite's env), isProductionEnv is false and
			// localhost stays permitted for local checkout redirects. In a
			// production run the same helper rejects localhost — see the guard in
			// isAllowedCheckoutOrigin (`&& !isProductionEnv`).
			expect(isAllowedCheckoutOrigin("http://localhost:3000/dashboard?deposit=success")).toBe(true);
			expect(isAllowedCheckoutOrigin("http://localhost:3002/dashboard?deposit=success")).toBe(true);
		});

		it("rejects attacker-controlled origins (open-redirect closed)", () => {
			expect(isAllowedCheckoutOrigin("https://evil.example.com/dashboard")).toBe(false);
			expect(isAllowedCheckoutOrigin("https://www.oma-ai.com.evil.com/dashboard")).toBe(false);
			expect(isAllowedCheckoutOrigin("https://oma-ai.com.attacker.io/phish")).toBe(false);
			expect(isAllowedCheckoutOrigin("javascript:alert(1)")).toBe(false);
			expect(isAllowedCheckoutOrigin("not-a-url")).toBe(false);
		});
	});
});
