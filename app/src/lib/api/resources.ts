/**
	* Balance / usage / model catalog endpoints.
	* Cached with TTL since they don't change frequently.
	*/

import { getCached, STALE_TTL, setCache } from "./client.js";
import type { BalanceResponse, ModelsResponse, UsageRecord } from "./types.js";

type RawUsageRecord = UsageRecord & {
	inputTokens?: number;
	outputTokens?: number;
};

export function normalizeUsageRecord(raw: RawUsageRecord): UsageRecord {
	const promptTokens = Number(raw.inputTokens ?? raw.promptTokens ?? 0);
	const completionTokens = Number(raw.outputTokens ?? raw.completionTokens ?? 0);
	return {
		...raw,
		apiKeyId: raw.apiKeyId ?? null,
		promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
		completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
		latencyMs:
			typeof raw.latencyMs === "number" && Number.isFinite(raw.latencyMs)
				? raw.latencyMs
				: null,
	};
}

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
	get(options?: { limit?: number; cursor?: string; apiKeyId?: string }) {
		const limit = options?.limit ?? 50;
		const qs = new URLSearchParams({ limit: String(limit) });
		if (options?.cursor) qs.set("cursor", options.cursor);
		if (options?.apiKeyId) qs.set("api_key_id", options.apiKeyId);
		return import("./client.js").then(({ request }) =>
			request<{
				object: string;
				data: RawUsageRecord[];
				next_cursor: string | null;
			}>(`/v1/usage?${qs.toString()}`).then((body) => {
				const records = (body.data ?? []).map(normalizeUsageRecord);
				return {
					records,
					count: records.length,
					nextCursor: body.next_cursor ?? null,
				};
			}),
		);
	},
	async getAll(options?: { pageSize?: number; maxRecords?: number }) {
		const { collectUsagePages } = await import("./collect-usage.js");
		const pageSize = options?.pageSize ?? 200;
		const records = await collectUsagePages(
			(cursor) => usage.get({ limit: pageSize, cursor }),
			{ maxRecords: options?.maxRecords ?? 2000 },
		);
		return { records, count: records.length };
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
