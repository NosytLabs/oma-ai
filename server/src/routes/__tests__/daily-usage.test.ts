import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OmaEnv } from "../../types.js";

const mocks = vi.hoisted(() => ({ getRedisClient: vi.fn(), isRedisReady: vi.fn() }));
vi.mock("../../lib/redis-client.js", () => mocks);
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("../../inference/models.js", () => ({ getModelById: () => ({ id: "minimax-m2-7" }) }));
vi.mock("../../inference/free-website-model.js", () => ({ isFreeWebsiteModel: () => true, FREE_WEBSITE_MODEL_IDS: ["minimax-m2-7"] }));
vi.mock("../../auth/middleware.js", () => ({ optionalAuth: async (_c: unknown, next: () => Promise<void>) => next() }));
// No persisted completions: admitted attempts can fail upstream and still consume quota.
vi.mock("../../db/client.js", () => ({ db: { select: () => ({ from: () => ({ where: async () => [{ count: 0 }] }) }) } }));

async function makeApp() {
	const { dailyUsageLimit } = await import("../../middleware/daily-limit.js");
	const { dailyUsageRoutes } = await import("../daily-usage.js");
	const app = new Hono<OmaEnv>();
	app.use("*", async (c, next) => { const id = c.req.header("test-user-id"); if (id) c.set("userId", id); await next(); });
	app.post("/chat", dailyUsageLimit(), c => c.json({ error: "upstream unavailable" }, 502));
	app.route("/", dailyUsageRoutes);
	return app;
}

function send(app: Awaited<ReturnType<typeof makeApp>>, userId?: string) {
	return app.request("/chat", { method: "POST", headers: {
		"Content-Type": "application/json", "X-OMA-Source": "website", ...(userId ? { "test-user-id": userId } : {}),
	}, body: JSON.stringify({ model: "minimax-m2-7" }) });
}

function read(app: Awaited<ReturnType<typeof makeApp>>, userId?: string) {
	return app.request("/v1/usage/today", { headers: userId ? { "test-user-id": userId } : {} });
}

function useRedis() {
	const counts = new Map<string, number>();
	const expiries = new Map<string, number>();
	const redis = {
		incr: async (key: string) => { const n = (counts.get(key) ?? 0) + 1; counts.set(key, n); return n; },
		get: async (key: string) => counts.get(key)?.toString() ?? null,
		expire: async (key: string, seconds: number) => { expiries.set(key, Date.now() + seconds * 1000); return 1; },
		ttl: async (key: string) => expiries.has(key) ? Math.ceil((expiries.get(key)! - Date.now()) / 1000) : -1,
	};
	mocks.getRedisClient.mockResolvedValue(redis);
	mocks.isRedisReady.mockReturnValue(true);
	return { redis, expiries };
}

beforeEach(() => {
	vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-10T23:58:00Z"));
	mocks.getRedisClient.mockResolvedValue(null); mocks.isRedisReady.mockReturnValue(false);
});
afterEach(() => vi.useRealTimers());

describe("daily quota reporting matches enforcement", () => {
	it("reports the consumed degraded quota without charging reads", async () => {
		const app = await makeApp();
		for (let i = 0; i < 3; i++) expect((await send(app)).status).toBe(502);
		for (let i = 0; i < 2; i++) expect(await (await read(app)).json()).toMatchObject({ used: 3, limit: 20, remaining: 17, resetMs: 120_000 });
	});

	it("counts admitted signed-in attempts instead of only completed DB records", async () => {
		useRedis(); const app = await makeApp();
		for (let i = 0; i < 3; i++) await send(app, "account-a");
		expect(await (await read(app, "account-a")).json()).toMatchObject({ used: 3, remaining: 97, isAuthenticated: true });
		expect(await (await read(app, "account-b")).json()).toMatchObject({ used: 0, remaining: 100 });
	});

	it("resets degraded enforcement and its reported quota at midnight UTC", async () => {
		vi.setSystemTime(new Date("2026-10-10T23:59:58Z"));
		const app = await makeApp();
		for (let i = 0; i < 20; i++) await send(app);
		const denied = await send(app);
		expect(denied.status).toBe(429);
		expect(denied.headers.get("Retry-After")).toBe("2");
		expect(await (await read(app)).json()).toMatchObject({ used: 20, remaining: 0, resetMs: 2000 });
		vi.advanceTimersByTime(2000);
		expect((await send(app)).status).toBe(502);
		expect(await (await read(app)).json()).toMatchObject({ used: 1, remaining: 19, resetMs: 86_400_000 });
	});

	it("expires Redis counters at the same midnight reported to customers", async () => {
		const { expiries } = useRedis(); const app = await makeApp();
		await send(app);
		expect([...expiries.values()]).toEqual([new Date("2026-10-11T00:00:00Z").getTime()]);
		expect(await (await read(app)).json()).toMatchObject({ used: 1, remaining: 19, resetMs: 120_000 });
	});

	it("reports the existing bounded quota when Redis read commands fail", async () => {
		const app = await makeApp();
		for (let i = 0; i < 3; i++) await send(app);
		const { redis } = useRedis(); redis.get = async () => { throw new Error("connection lost"); };
		expect(await (await read(app)).json()).toMatchObject({ used: 3, remaining: 17 });
	});

	it("retains observed shared usage when Redis becomes unavailable", async () => {
		const { redis } = useRedis(); const app = await makeApp();
		for (let i = 0; i < 3; i++) await send(app);
		redis.get = async () => { throw new Error("connection lost"); };
		expect(await (await read(app)).json()).toMatchObject({ used: 3, remaining: 17 });
	});

	it("keeps reporting and enforcing the bounded cap if client acquisition fails", async () => {
		mocks.getRedisClient.mockRejectedValue(new Error("cannot initialize Redis"));
		const app = await makeApp();
		for (let i = 0; i < 20; i++) expect((await send(app)).status).toBe(502);
		expect((await send(app)).status).toBe(429);
		expect(await (await read(app)).json()).toMatchObject({ used: 20, remaining: 0 });
	});
});
