import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRedisClient, isRedisReady, checkMemoryCounter, logger } = vi.hoisted(() => ({
	getRedisClient: vi.fn(),
	isRedisReady: vi.fn(),
	checkMemoryCounter: vi.fn(),
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../lib/redis-client.js", () => ({
	getRedisClient,
	isRedisReady,
}));
vi.mock("../rate-limit/memory-store.js", () => ({ checkMemoryCounter }));
vi.mock("../../lib/logger.js", () => ({ logger }));

import { rateLimit } from "../rate-limit/sliding-window.js";

function ctx() {
	const headers: Record<string, string> = {};
	return {
		headers,
		// The middleware resolves a rate-limit key from c.get(...) before it
		// ever touches the store, so the context stub has to answer it.
		get: (_key: string) => undefined,
		req: {
			path: "/api/auth/magic-link",
			method: "POST",
			header: (k: string) => (k.toLowerCase() === "x-forwarded-for" ? "9.9.9.9" : undefined),
			headerNames: () => new Map(),
		},
		header: (k: string, v: string) => {
			headers[k] = v;
		},
		json: (body: unknown, status: number) => ({ body, status }),
	} as never;
}

function run(redisDown: boolean) {
	getRedisClient.mockResolvedValue(redisDown ? null : { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() });
	isRedisReady.mockReturnValue(!redisDown);
	return rateLimit({
		windowMs: 60_000,
		maxRequests: 40,
		keyPrefix: "auth",
		failClosed: false,
	});
}

describe("rate limiting while Redis is unavailable", () => {
	beforeEach(() => {
		getRedisClient.mockReset();
		isRedisReady.mockReset();
		checkMemoryCounter.mockReset();
		logger.warn.mockReset();
	});

	it("still bounds abuse when Redis is down instead of allowing everything", async () => {
		// failClosed:false previously returned next() unconditionally, so a
		// Redis outage removed the limit entirely — unbounded magic-link/OTP
		// sends. Availability is preserved by degrading to a per-process
		// limiter; safety is not.
		const mw = run(true);
		let allowed = 0;
		let limited = 0;
		checkMemoryCounter.mockReturnValue({ allowed: false, remaining: 0, resetMs: 30_000 });

		for (let i = 0; i < 5; i++) {
			// Hono's Next resolves void; capture the short-circuit from the
			// context stub's json() rather than from a return value.
			let status = 0;
			const c = ctx();
			(c as unknown as { json: (b: unknown, s: number) => unknown }).json = (_b, s) => {
				status = s;
				return { body: _b, status: s };
			};
			let handled = false;
			await mw(c, async () => {
				handled = true;
			});
			if (status === 429) limited++;
			else if (handled) allowed++;
		}

		expect(limited).toBe(5);
		expect(allowed).toBe(0);
	});

	it("allows requests through while the fallback budget lasts", async () => {
		const mw = run(true);
		checkMemoryCounter.mockReturnValue({ allowed: true, remaining: 4, resetMs: 30_000 });
		let handled = false;
		await mw(ctx(), async () => {
			handled = true;
		});
		expect(handled).toBe(true);
		expect(checkMemoryCounter).toHaveBeenCalledWith("auth:ip:unknown", 40, 60_000);
	});

	it("labels the degraded policy in a response header", async () => {
		const mw = run(true);
		checkMemoryCounter.mockReturnValue({ allowed: true, remaining: 4, resetMs: 30_000 });
		const c = ctx();
		await mw(c, async () => {});
		expect((c as unknown as { headers: Record<string, string> }).headers["X-RateLimit-Policy"]).toBe(
			"degraded-memory",
		);
	});

	it("warns once that limiting is degraded", async () => {
		const mw = run(true);
		checkMemoryCounter.mockReturnValue({ allowed: true, remaining: 4, resetMs: 30_000 });
		await mw(ctx(), async () => {});
		expect(logger.warn).toHaveBeenCalled();
	});

	it("does not use the fallback when Redis is healthy", async () => {
		const redis = {
			incr: vi.fn(async () => 1),
			expire: vi.fn(async () => 1),
			ttl: vi.fn(async () => 60),
			eval: vi.fn(async () => [1, 59, 1]),
		};
		getRedisClient.mockResolvedValue(redis);
		isRedisReady.mockReturnValue(true);
		const mw = rateLimit({ windowMs: 60_000, maxRequests: 40, keyPrefix: "auth", failClosed: false });
		let reached = false;
		await mw(ctx(), async () => {
			reached = true;
		});
		expect(reached, "request should reach the handler with Redis up").toBe(true);
		expect(checkMemoryCounter).not.toHaveBeenCalled();
	});
});
