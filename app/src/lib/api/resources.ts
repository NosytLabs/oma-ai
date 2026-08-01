/**
 * Balance / usage / model catalog endpoints.
 * Cached with TTL since they don't change frequently.
 */

import { getCached, STALE_TTL, setCache } from "./client.js";
import type { BalanceResponse, ModelsResponse, UsageRecord } from "./types.js";

export const balance = {
	get() {
		const cacheKey = "/v1/balance";
		const cached = getCached<BalanceResponse>(cacheKey);
		if (cached) return Promise.resolve(cached);
		return import("./client.js").then(({ request }) =>
			request<BalanceResponse>("/v1/balance").then((data) => {
				setCache(cacheKey, data, 120_000);
				return data;
			}),
		);
	},
};

export const usage = {
	get(options?: { limit?: number }) {
		const limit = options?.limit ?? 50;
		return import("./client.js").then(({ request }) =>
			request<{
				object: string;
				data: UsageRecord[];
				next_cursor: string | null;
			}>(`/v1/usage?limit=${limit}`).then((body) => ({
				records: body.data ?? [],
				count: body.data?.length ?? 0,
			})),
		);
	},
};

export const models = {
	list() {
		const cacheKey = "/v1/models";
		const cached = getCached<ModelsResponse>(cacheKey);
		if (cached) return Promise.resolve(cached);
		return import("./client.js").then(({ request }) =>
			request<ModelsResponse>("/v1/models").then((data) => {
				setCache(cacheKey, data, STALE_TTL);
				return data;
			}),
		);
	},
};
