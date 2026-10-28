import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono, type Context, type Next } from "hono";
import type { OmaEnv } from "../../types.js";

const createRefund = vi.hoisted(() => vi.fn());
vi.mock("../../auth/middleware.js", () => ({
	// Model successful explicit-key authentication: no session is selected,
	// even if the transport also includes the browser's cookies.
	sessionOrBearerAuth: async (c: Context<OmaEnv>, next: Next) => {
		c.set("userId", "api-key-owner");
		await next();
	},
}));
vi.mock("../../db/client.js", () => ({ db: {} }));
vi.mock("../../lib/usage-refunds.js", () => ({
	createUsageRefund: createRefund,
	RefundError: class extends Error {},
}));

import { refundsRoutes } from "../refunds.js";

const app = new Hono().route("/", refundsRoutes);
const origin = "https://www.oma-ai.com";
const body = { usageId: "11111111-1111-4111-8111-111111111111", reason: "The upstream request failed." };
const post = (headers: Record<string, string>) => app.request("/v1/refunds", {
	method: "POST",
	headers: { "Content-Type": "application/json", Authorization: "Bearer synthetic-key", ...headers },
	body: JSON.stringify(body),
}, { PUBLIC_APP_URL: origin });

describe("refund origin checks with explicit API credentials", () => {
	beforeEach(() => {
		createRefund.mockReset();
		createRefund.mockResolvedValue({ id: "refund-fixture" });
	});

	it("allows a cookie-free SDK request without Origin", async () => {
		expect((await post({})).status).toBe(200);
		expect(createRefund).toHaveBeenCalledWith("api-key-owner", body);
	});

	it("keeps explicit-key ownership when a trusted browser also sends cookies", async () => {
		expect((await post({ Cookie: "oma.session_token=synthetic", Origin: origin })).status).toBe(200);
		expect(createRefund).toHaveBeenCalledWith("api-key-owner", body);
	});

	it.each<Record<string, string>>([{}, { Origin: "https://untrusted.example" }])("rejects cookie-bearing requests without a trusted origin: %j", async (headers) => {
		const response = await post({ Cookie: "oma.session_token=synthetic", ...headers });
		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({ error: { type: "csrf_error" } });
		expect(createRefund).not.toHaveBeenCalled();
	});

	it("accepts a same-origin Referer when a browser omits Origin", async () => {
		expect((await post({ Cookie: "oma.session_token=synthetic", Referer: `${origin}/dashboard` })).status).toBe(200);
		expect(createRefund).toHaveBeenCalledOnce();
	});
});
