import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OmaEnv } from "../../types.js";

const mocks = vi.hoisted(() => ({
	getRedisClient: vi.fn(),
	isRedisReady: vi.fn(),
	getModelById: vi.fn(),
	isFreeWebsiteModel: vi.fn(),
}));

vi.mock("../../lib/redis-client.js", () => ({
	getRedisClient: mocks.getRedisClient,
	isRedisReady: mocks.isRedisReady,
}));
vi.mock("../../inference/models.js", () => ({ getModelById: mocks.getModelById }));
vi.mock("../../inference/free-website-model.js", () => ({
	isFreeWebsiteModel: mocks.isFreeWebsiteModel,
}));
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

// NOTE: `daily-limit.js` is imported DYNAMICALLY in each test, never at module
// scope. The degraded cap lives in a module-level Map inside memory-store.js,
// and under test there is no proxy secret so extractClientIp() returns one
// constant value. A static top-level import would pin a single module graph
// for the whole file, so the counter would leak across cases and the suite
// would depend on execution order.
async function makeApp(withModelLimiter = false, withKey = false) {
	const { dailyUsageLimit } = await import("../daily-limit.js");
	const { Hono } = await import("hono");
	const app = new Hono<OmaEnv>();
	if (withKey) app.use("*", async (c, next) => { c.set("apiKey", { id: "paid-key" } as never); await next(); });
	if (withModelLimiter) {
		const { modelRateLimit } = await import("../rate-limit/token-bucket.js");
		app.use("/v1/chat/completions", modelRateLimit());
	}
	app.use("/v1/chat/completions", dailyUsageLimit());
	app.post("/v1/chat/completions", async (c) => c.json({ ok: true, model: (await c.req.json()).model }));
	return app;
}

const send = (app: Awaited<ReturnType<typeof makeApp>>) =>
	app.request("http://localhost/v1/chat/completions", {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-OMA-Source": "website" },
		body: JSON.stringify({ model: "minimax-m2-7" }),
	});

describe("dailyUsageLimit", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		mocks.getModelById.mockReturnValue({ id: "minimax-m2-7" });
		mocks.isFreeWebsiteModel.mockReturnValue(true);
		mocks.getRedisClient.mockResolvedValue(null);
		mocks.isRedisReady.mockReturnValue(false);
	});

	it("shares the parsed body with the model limiter and completion handler", async () => {
		const response = await send(await makeApp(true));
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ ok: true, model: "minimax-m2-7" });
		expect(response.headers.get("X-DailyLimit-Remaining")).toBe("19");
	});

	it("allows requests within the bounded fallback quota when the store is unavailable", async () => {
		const app = await makeApp();

		// A quota-store outage still permits requests within the fallback cap.
		const response = await send(app);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ ok: true });
	});

	it("still bounds the free tier when the quota store is unavailable", async () => {
		// Degraded enforcement must retain a finite quota.
		const { DAILY_LIMIT_ANONYMOUS } = await import("../daily-limit.js");
		const app = await makeApp();

		const statuses: number[] = [];
		for (let i = 0; i < DAILY_LIMIT_ANONYMOUS + 1; i++) {
			statuses.push((await send(app)).status);
		}

		// First N pass, the one past the cap is refused.
		expect(statuses.slice(0, DAILY_LIMIT_ANONYMOUS).every((s) => s === 200)).toBe(true);
		expect(statuses[DAILY_LIMIT_ANONYMOUS]).toBe(429);
	});

	it.each(["incr", "expire", "ttl"])("retains the daily cap when a ready Redis %s command fails", async command => {
		const redis = { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1), ttl: vi.fn().mockResolvedValue(86400) };
		redis[command as keyof typeof redis].mockRejectedValue(new Error("Redis connection lost"));
		mocks.getRedisClient.mockResolvedValue(redis);
		mocks.isRedisReady.mockReturnValue(true);
		const app = await makeApp();
		for (let i = 0; i < 20; i++) expect((await send(app)).status).toBe(200);
		const denied = await send(app);
		expect(denied.status).toBe(429);
		expect(Number(denied.headers.get("Retry-After"))).toBeGreaterThan(0);
	});

	it("does not spend the free quota for a prepaid API-key request", async () => {
		const response = await send(await makeApp(false, true));
		expect(response.status).toBe(200);
		expect(response.headers.has("X-DailyLimit-Remaining")).toBe(false);
		expect(mocks.getRedisClient).not.toHaveBeenCalled();
	});

	it("does not report a 0 quota while still serving requests", async () => {
		// Regression: with the store down the old code returned
		// `remaining: 0` on every allowed request, so the header said the
		// user was out of quota while happily serving them.
		const { DAILY_LIMIT_ANONYMOUS } = await import("../daily-limit.js");
		const app = await makeApp();

		const response = await send(app);

		expect(response.status).toBe(200);
		expect(response.headers.get("X-DailyLimit-Limit")).toBe(String(DAILY_LIMIT_ANONYMOUS));
		expect(response.headers.get("X-DailyLimit-Remaining")).toBe(
			String(DAILY_LIMIT_ANONYMOUS - 1),
		);
	});
});
