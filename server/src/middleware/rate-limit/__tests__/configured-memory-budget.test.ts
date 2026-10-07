import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getRedisClient, isRedisReady } = vi.hoisted(() => ({
	getRedisClient: vi.fn(),
	isRedisReady: vi.fn(),
}));
vi.mock("../../../lib/redis-client.js", () => ({ getRedisClient, isRedisReady }));
vi.mock("../../../lib/logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import { rateLimit } from "../sliding-window.js";

afterEach(() => vi.useRealTimers());

describe("configured auth budgets survive Redis outages", () => {
	it("keeps chat traffic out of the key-creation budget and groups route parameters", async () => {
		getRedisClient.mockResolvedValue(null);
		isRedisReady.mockReturnValue(false);
		const app = new Hono();
		app.post("/audit-chat", rateLimit({ maxRequests: 5, windowMs: 60_000 }), (c) => c.json({ ok: true }));
		app.post("/audit-keys/:id", rateLimit({ maxRequests: 1, windowMs: 60_000 }), (c) => c.json({ ok: true }));
		for (let i = 0; i < 4; i++) expect((await app.request("/audit-chat", { method: "POST" })).status).toBe(200);
		expect((await app.request("/audit-keys/first", { method: "POST" })).status).toBe(200);
		expect((await app.request("/audit-keys/second", { method: "POST" })).status).toBe(429);
	});

	for (const state of ["unavailable", "command error"] as const) {
		it(`enforces the configured count and window after a Redis ${state}`, async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-09-28T00:00:00Z"));
			getRedisClient.mockResolvedValue(state === "unavailable" ? null : {
				incr: vi.fn().mockRejectedValue(new Error("connection lost")),
			});
			isRedisReady.mockReturnValue(state !== "unavailable");
			const app = new Hono();
			app.use("*", rateLimit({ maxRequests: 8, windowMs: 5_000, keyPrefix: `auth-budget-${state}` }));
			app.get("/", (c) => c.json({ ok: true }));

			for (let i = 0; i < 8; i++) {
				const response = await app.request("/");
				expect(response.status).toBe(200);
				expect(response.headers.get("X-RateLimit-Limit")).toBe("8");
				expect(response.headers.get("X-RateLimit-Remaining")).toBe(String(7 - i));
				expect(response.headers.get("X-RateLimit-Policy")).toBe("degraded-memory");
			}
			const blocked = await app.request("/");
			expect(blocked.status).toBe(429);
			expect(blocked.headers.get("Retry-After")).toBe("5");
			vi.advanceTimersByTime(5_001);
			expect((await app.request("/")).status).toBe(200);
		});
	}
});
