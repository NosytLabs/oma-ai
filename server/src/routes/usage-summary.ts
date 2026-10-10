/** Full-range customer analytics, independent of paginated request history. */
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { OmaEnv } from "../types.js";
import { db } from "../db/client.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";

export const usageSummaryRoutes = new Hono<OmaEnv>();
const querySchema = z.object({
	range: z.enum(["24h", "7d", "30d", "all"]).default("7d"),
	timezone: z.string().max(100).default("UTC").refine(value => {
		try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
		catch { return false; }
	}),
});

usageSummaryRoutes.get("/v1/usage/summary", sessionOrBearerAuth, async (c) => {
	c.header("Cache-Control", "no-store");
	const parsed = querySchema.safeParse(c.req.query());
	if (!parsed.success) return c.json({ error: { message: "Invalid usage range or timezone" } }, 400);
	const { range, timezone } = parsed.data;
	const to = new Date();
	const hours = range === "24h" ? 24 : range === "7d" ? 168 : 720;
	const from = range === "all" ? null : new Date(to.getTime() - hours * 3_600_000);
	const recent = new Date(to.getTime() - 24 * 3_600_000);
	const bucket = range === "all" ? "month" : "day";
	const result = await db.execute(sql`
		WITH account_usage AS (
			SELECT *, CASE WHEN refunded_at IS NULL THEN total_cents ELSE 0 END AS billed_cents
			FROM usage_records WHERE user_id = ${c.get("userId")} AND created_at <= ${to}
		), selected AS (
			SELECT * FROM account_usage ${from ? sql`WHERE created_at >= ${from}` : sql``}
		), totals AS (
			SELECT count(*)::int AS requests, count(*) FILTER (WHERE status = 'error')::int AS errors,
				count(*) FILTER (WHERE status = 'aborted')::int AS aborted,
				count(*) FILTER (WHERE status = 'free_tier')::int AS free_requests,
				count(DISTINCT model)::int AS active_models,
				coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
				coalesce(sum(output_tokens), 0)::bigint AS output_tokens,
				coalesce(sum(billed_cents), 0)::text AS billed_cents,
				avg(latency_ms) FILTER (WHERE latency_ms >= 0) AS avg_latency_ms
			FROM selected
		), last24 AS (
			SELECT count(*)::int AS requests, count(*) FILTER (WHERE status = 'error')::int AS errors,
				count(*) FILTER (WHERE status = 'aborted')::int AS aborted,
				count(*) FILTER (WHERE status = 'free_tier')::int AS free_requests,
				count(DISTINCT model)::int AS active_models,
				coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
				coalesce(sum(output_tokens), 0)::bigint AS output_tokens,
				coalesce(sum(billed_cents), 0)::text AS billed_cents,
				avg(latency_ms) FILTER (WHERE latency_ms >= 0) AS avg_latency_ms
			FROM account_usage WHERE created_at >= ${recent}
		), models AS (
			SELECT model, count(*)::int AS requests, coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
				coalesce(sum(output_tokens), 0)::bigint AS output_tokens,
				coalesce(sum(billed_cents), 0)::text AS billed_cents,
				avg(latency_ms) FILTER (WHERE latency_ms >= 0) AS avg_latency_ms
			FROM selected GROUP BY model ORDER BY sum(billed_cents) DESC, model
		), providers AS (
			SELECT provider, count(*)::int AS requests, coalesce(sum(billed_cents), 0)::text AS billed_cents
			FROM selected GROUP BY provider ORDER BY sum(billed_cents) DESC, provider
		), buckets AS (
			SELECT generate_series(
				date_trunc(${bucket}, coalesce(${from}::timestamptz, (SELECT min(created_at) FROM selected), ${to}::timestamptz) AT TIME ZONE ${timezone}),
				date_trunc(${bucket}, ${to}::timestamptz AT TIME ZONE ${timezone}),
				${bucket === "month" ? "1 month" : "1 day"}::interval
			) AS at
		), daily AS (
			SELECT date_trunc(${bucket}, created_at AT TIME ZONE ${timezone}) AS at,
				count(*)::int AS requests, coalesce(sum(billed_cents), 0)::text AS billed_cents
			FROM selected GROUP BY 1
		), timeline AS (
			SELECT to_char(b.at, 'YYYY-MM-DD') AS date, coalesce(d.requests, 0) AS requests,
				coalesce(d.billed_cents, '0') AS billed_cents
			FROM buckets b LEFT JOIN daily d ON b.at = d.at ORDER BY b.at
		)
		SELECT json_build_object(
			'totals', (SELECT row_to_json(t) FROM totals t), 'last24h', (SELECT row_to_json(t) FROM last24 t),
			'lifetimeRequests', (SELECT count(*)::int FROM account_usage),
			'models', coalesce((SELECT json_agg(m) FROM models m), '[]'::json),
			'providers', coalesce((SELECT json_agg(p) FROM providers p), '[]'::json),
			'timeline', (SELECT json_agg(t) FROM timeline t)
		) AS summary
	`);
	return c.json({ range, timezone, bucket, from: from?.toISOString() ?? null, to: to.toISOString(), ...result.rows[0].summary as object });
});
