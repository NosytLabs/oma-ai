import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { OmaEnv } from "../../../types.js";

vi.mock("../../../lib/redis-client.js", () => ({
	getRedisClient: vi.fn().mockResolvedValue(null), isRedisReady: vi.fn().mockReturnValue(false),
}));
vi.mock("../../../lib/logger.js", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { modelRateLimit } from "../token-bucket.js";

describe("model limiter response forwarding", () => {
	it("returns the exhausted fallback response without reaching inference", async () => {
		const handler = vi.fn(c => c.json({ ok: true }));
		const app = new Hono<OmaEnv>();
		app.use("*", async (c, next) => { c.set("userId", "model-limit-response-test"); await next(); });
		app.post("/", modelRateLimit({ keyPrefix: "model-limit-response-test" }), handler);
		const request = () => app.request("/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "google-gemma-4-31b-it" }) });
		for (let i = 0; i < 5; i++) expect((await request()).status).toBe(200);
		const blocked = await request();
		expect(blocked.status).toBe(503);
		expect((await blocked.json()).error.code).toBe("rate_limit_unavailable");
		expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
		expect(handler).toHaveBeenCalledTimes(5);
	});
});
