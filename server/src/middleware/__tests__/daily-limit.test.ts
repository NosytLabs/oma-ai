import { beforeEach, describe, expect, it, vi } from "vitest";

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
async function makeApp() {
	const { dailyUsageLimit } = await import("../daily-limit.js");
	const { Hono } = await import("hono");
	const app = new Hono();
	app.use("/v1/chat/completions", dailyUsageLimit());
	app.post("/v1/chat/completions", (c) => c.json({ ok: true }));
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
		mocks.getModelById.mockReturnValue({ id: "minimax-m2-7" });
		mocks.isFreeWebsiteModel.mockReturnValue(true);
		mocks.getRedisClient.mockResolvedValue(null);
		mocks.isRedisReady.mockReturnValue(false);
	});

	it("fails OPEN for free website chat when the quota store is unavailable", async () => {
		const app = await makeApp();

		// Quota-store outage must not brick the free chat demo: the request
		// passes through (fail open) so the headline free tier stays available.
		const response = await send(app);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ ok: true });
	});

	it("still bounds the free tier when the quota store is unavailable", async () => {
		// Fail-open must mean "degrade enforcement", NOT "no enforcement".
		// Production has no working Upstash credentials, so before this fix
		// the anonymous 20/day cap was not enforced at all and the free tier
		// was effectively unmetered.
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

	it("bounds usage even when an available Redis connection starts failing", async () => {
		mocks.getRedisClient.mockResolvedValue({ incr: vi.fn().mockRejectedValue(new Error("connection lost")) });
		mocks.isRedisReady.mockReturnValue(true);
		const app = await makeApp();
		for (let i = 0; i < 20; i++) expect((await send(app)).status).toBe(200);
		expect((await send(app)).status).toBe(429);
	});

	it("does not consume website quota for paid API-key calls", async () => {
		const { Hono } = await import("hono");
		const { dailyUsageLimit } = await import("../daily-limit.js");
		const app = new Hono();
		app.use("*", async (c, next) => { c.set("apiKey" as never, { id: "paid_key" } as never); await next(); });
		app.post("/v1/chat/completions", dailyUsageLimit(), (c) => c.json({ ok: true }));
		const response = await send(app);
		expect(response.status).toBe(200);
		expect(response.headers.get("X-DailyLimit-Limit")).toBeNull();
	});

	it("preserves the chat body after the model limiter has read it", async () => {
		const { Hono } = await import("hono");
		const { bodyLimit } = await import("hono/body-limit");
		const { modelRateLimit } = await import("../rate-limit/token-bucket.js");
		const { dailyUsageLimit } = await import("../daily-limit.js");
		const app = new Hono();
		app.use("*", bodyLimit({ maxSize: 2048 }));
		app.post("/v1/chat/completions", modelRateLimit(), dailyUsageLimit(), async (c) =>
			c.json(await c.req.json()),
		);
		const body = { model: "minimax-m2-7", messages: [{ role: "user", content: "Hello" }], stream: true };
		const response = await app.request("/v1/chat/completions", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-OMA-Source": "website" },
			body: JSON.stringify(body),
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(body);
		expect(response.headers.get("X-DailyLimit-Remaining")).toBe("19");
	});
});
