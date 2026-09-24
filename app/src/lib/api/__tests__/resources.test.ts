import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { balance, models } from "../resources";

describe("api resource caching", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		// Each test needs a cold module-level cache, otherwise a previous
		// test's cached response satisfies the next get() and the fetch
		// assertion below would be vacuous.
		vi.resetModules();
	});

	it("coalesces concurrent balance misses into a single request", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ balance: 1 }),
		});

		const { balance: freshBalance } = await import("../resources");

		// Three callers hit the cache before the first response lands. Without
		// in-flight coalescing this fires three identical /v1/balance calls.
		const [a, b, c] = await Promise.all([
			freshBalance.get(),
			freshBalance.get(),
			freshBalance.get(),
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(a).toEqual({ balance: 1 });
		expect(b).toEqual({ balance: 1 });
		expect(c).toEqual({ balance: 1 });
	});

	it("coalesces concurrent model-list misses into a single request", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ data: [] }),
		});

		const { models: freshModels } = await import("../resources");
		await Promise.all([freshModels.list(), freshModels.list(), freshModels.list()]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not cache a failed request", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const { balance: freshBalance } = await import("../resources");

		await expect(freshBalance.get()).rejects.toBeTruthy();

		// A second call must retry rather than replay the rejection forever.
		fetchMock.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ balance: 7 }),
		});
		await expect(freshBalance.get()).resolves.toEqual({ balance: 7 });
	});
});

// keep the static import referenced so lint does not flag it as unused
void balance;
void models;
