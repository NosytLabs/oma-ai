/**
	* GET /v1/ops/snapshot — admin-only operational snapshot.
	* Aggregates only; no per-user PII is exposed, but request volume and
	* latency metrics are still operator-sensitive so the route requires
	* session/bearer auth + requireAdmin().
	*
	* Combines three real sources:
	*   1. In-process HTTP counters (request volume, errors, per-route p95)
	*      from the metrics middleware.
	*   2. The `usage_records` table for the trailing 24h of recorded chat
	*      completions, tokens, latency, and errors.
	*   3. Live process/runtime facts: uptime, memory, DB round-trip latency.
	*
	* Time-series charts on the page (24h volume, latency trend) are NOT
	* served from here — there is no historical store — and are labelled as
	* illustrative on the client.
	*/
import { Hono } from "hono";
import { gte, sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth, requireAdmin } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { usageRecords } from "../db/schema.js";
import { getMetricsSnapshot } from "./metrics.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export const opsRoutes = new Hono<OmaEnv>();

const VERSION = "2.1.0";

interface Chat24h {
		completions: number;
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
		errors: number;
		p95LatencyMs: number | null;
		topModels: { model: string; requests: number; tokens: number }[];
		activeModels: number;
		available: boolean;
}

async function fetchChat24h(): Promise<Chat24h> {
		const empty: Chat24h = {
				completions: 0,
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				errors: 0,
				p95LatencyMs: null,
				topModels: [],
				activeModels: 0,
				available: false,
		};
		try {
				const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

				const [agg] = await db
						.select({
								completions: sql<number>`count(*)::int`,
								inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)::int`,
								outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)::int`,
								errors: sql<number>`count(*) filter (where ${usageRecords.status} = 'error')::int`,
								activeModels: sql<number>`count(distinct ${usageRecords.model})::int`,
								p95LatencyMs: sql<number | null>`percentile_cont(0.95) within group (order by ${usageRecords.latencyMs})::int`,
						})
						.from(usageRecords)
						.where(gte(usageRecords.createdAt, since));

				const topModels = await db
						.select({
								model: usageRecords.model,
								requests: sql<number>`count(*)::int`,
								tokens: sql<number>`coalesce(sum(${usageRecords.inputTokens} + ${usageRecords.outputTokens}), 0)::int`,
						})
						.from(usageRecords)
						.where(gte(usageRecords.createdAt, since))
						.groupBy(usageRecords.model)
						.orderBy(sql`count(*) desc`)
						.limit(5);

				const inputTokens = agg?.inputTokens ?? 0;
				const outputTokens = agg?.outputTokens ?? 0;
				return {
						available: true,
						activeModels: agg?.activeModels ?? 0,
						completions: agg?.completions ?? 0,
						inputTokens,
						outputTokens,
						totalTokens: inputTokens + outputTokens,
						errors: agg?.errors ?? 0,
						p95LatencyMs: agg?.p95LatencyMs ?? null,
						topModels: topModels.map((m) => ({
								model: m.model,
								requests: m.requests,
								tokens: m.tokens,
						})),
				};
		} catch (err) {
				logger.warn({ err }, "[ops] failed to aggregate usage_records");
				return empty;
		}
}

opsRoutes.get("/v1/ops/snapshot", sessionOrBearerAuth, requireAdmin(), async (c) => {
		const dbStart = Date.now();
		let dbLatencyMs: number | null;
		try {
				await db.execute(sql`select 1`);
				dbLatencyMs = Date.now() - dbStart;
		} catch {
				dbLatencyMs = null;
		}

		const http = getMetricsSnapshot();
		const chat24h = await fetchChat24h();
		const mem = process.memoryUsage();

		return c.json({
				status: dbLatencyMs != null && chat24h.available ? "ok" : "degraded",
				version: VERSION,
				env: config.NODE_ENV,
				uptimeSec: Math.round(process.uptime()),
				generatedAt: new Date().toISOString(),
				runtime: {
						heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
						rssMb: Math.round(mem.rss / 1024 / 1024),
						dbLatencyMs,
				},
				http: {
						requestsTotal: http.totalRequests,
						errorsTotal: http.totalErrors,
						topRoutes: http.routes.slice(0, 8).map((r) => ({
								route: r.route,
								requests: r.requests,
								errors: r.errors,
								p95ms: r.p95ms,
						})),
				},
				chat24h,
		});
});
