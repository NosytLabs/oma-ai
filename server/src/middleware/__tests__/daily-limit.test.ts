import { Hono } from "hono";
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

import { dailyUsageLimit } from "../daily-limit.js";

describe("dailyUsageLimit", () => {
	beforeEach(() => {
		mocks.getModelById.mockReturnValue({ id: "minimax-m2-7" });
		mocks.isFreeWebsiteModel.mockReturnValue(true);
		mocks.getRedisClient.mockResolvedValue(null);
		mocks.isRedisReady.mockReturnValue(false);
	});

	it("fails OPEN for free website chat when the quota store is unavailable", async () => {
		const app = new Hono();
		app.use("/v1/chat/completions", dailyUsageLimit());
		app.post("/v1/chat/completions", (c) => c.json({ ok: true }));

		const response = await app.request("http://localhost/v1/chat/completions", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-OMA-Source": "website" },
			body: JSON.stringify({ model: "minimax-m2-7" }),
		});

		// Quota-store outage must not brick the free chat demo: the request
		// passes through (fail open) so the headline free tier stays available.
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ ok: true });
	});
});
