/**
	* Balance / usage / model catalog endpoints.
	* Cached with TTL since they don't change frequently.
	*/

import { getCached, STALE_TTL, setCache } from "./client.js";
import type { BalanceResponse, ModelsResponse, UsageRecord, UsageSummary } from "./types.js";

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

/**
 * In-flight request registry, keyed by cache key.
 *
 * Without this, several callers that miss the cache before the first response
 * resolves each fire their own identical request — a dashboard mounting three
 * queries at once produced three /v1/balance calls. Storing the promise means
 * later callers await the one already in flight.
 *
 * Entries are always cleared on settle, including rejection, so a failed
 * request is retried by the next caller rather than replayed forever.
 */
const inFlight = new Map<string, Promise<unknown>>();

async function cachedResource<T>(cacheKey: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
	const cached = getCached<T>(cacheKey);
	if (cached) return cached;

	const existing = inFlight.get(cacheKey) as Promise<T> | undefined;
	if (existing) return existing;

	const pending = fetcher()
		.then((data) => {
			setCache(cacheKey, data, ttl);
			return data;
		})
		.finally(() => {
			inFlight.delete(cacheKey);
		});

	inFlight.set(cacheKey, pending);
	return pending;
}

export const balance = {
	get() {
		// React Query owns account-scoped caching. A second URL-only cache
		// would leak stale balances across sign-ins and defeat manual refresh.
		return (async () => {
			const { request } = await import("./client.js");
			return request<BalanceResponse>("/v1/balance");
		})();
	},
};

export const usage = {
	get(options?: { limit?: number; cursor?: string; apiKeyId?: string; since?: string; until?: string }) {
		const limit = options?.limit ?? 50;
		const qs = new URLSearchParams({ limit: String(limit) });
		if (options?.cursor) qs.set("cursor", options.cursor);
		if (options?.apiKeyId) qs.set("api_key_id", options.apiKeyId);
		if (options?.since) qs.set("since", options.since);
		if (options?.until) qs.set("until", options.until);
		return import("./client.js").then(({ request }) =>
			request<{
				object: string;
				data: RawUsageRecord[];
				next_cursor: string | null;
				totals?: { requests: number };
			}>(`/v1/usage?${qs.toString()}`).then((body) => {
				const records = (body.data ?? []).map(normalizeUsageRecord);
				return {
					records,
					count: records.length,
					nextCursor: body.next_cursor ?? null,
					totalCount: body.totals?.requests ?? records.length,
				};
			}),
		);
	},
	summary(range: UsageSummary["range"], timezone = "UTC") {
		const qs = new URLSearchParams({ range, timezone });
		return import("./client.js").then(({ request }) => request<UsageSummary>(`/v1/usage/summary?${qs}`));
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
		return cachedResource<ModelsResponse>("/v1/models", STALE_TTL, async () => {
			const { request } = await import("./client.js");
			return request<ModelsResponse>("/v1/models");
		});
	},
};
