import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { OmaEnv } from "../types.js";
import { db } from "../db/client.js";
import { sessionOrBearerAuth, requireAdmin } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { logger } from "../lib/logger.js";

export const adminAnalyticsRoutes = new Hono<OmaEnv>();
const readLimit = rateLimit({ windowMs: 60_000, maxRequests: 60, failClosed: false });
const windowSchema = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) });
const logsSchema = windowSchema.extend({
	limit: z.coerce.number().int().min(1).max(100).default(25),
	cursor: z.string().max(512).optional(),
	q: z.string().trim().max(100).optional(),
	model: z.string().max(150).optional(),
	status: z.enum(["completed", "free_tier", "aborted", "error"]).optional(),
});
const cursorSchema = z.object({ createdAt: z.string().datetime({ offset: true }), id: z.uuid() });

function rows(result: unknown): Array<Record<string, unknown>> {
	return ((result as { rows?: Array<Record<string, unknown>> }).rows ?? result) as Array<Record<string, unknown>>;
}

adminAnalyticsRoutes.get("/v1/admin/usage/timeline", sessionOrBearerAuth, requireAdmin(), readLimit, async (c) => {
	c.header("Cache-Control", "no-store");
	const parsed = windowSchema.safeParse({ days: c.req.query("days") });
	if (!parsed.success) return c.json({ error: { message: "Choose a range between 1 and 90 days." } }, 400);
	const to = new Date();
	const from = new Date(to.getTime() - parsed.data.days * 86_400_000);
	const bucket = parsed.data.days === 1 ? "hour" : "day";
	try {
		const result = await db.execute(sql`
			WITH buckets AS (
				SELECT generate_series(
					date_trunc(${bucket}, ${from.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
					date_trunc(${bucket}, ${to.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
					${bucket === "hour" ? "1 hour" : "1 day"}::interval
				) AS bucket
			), usage AS (
				SELECT date_trunc(${bucket}, created_at AT TIME ZONE 'UTC') AS bucket,
					COUNT(*)::int AS requests,
					COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
					COUNT(*) FILTER (WHERE status = 'aborted')::int AS aborted,
					COUNT(*) FILTER (WHERE status = 'free_tier')::int AS free_requests,
					COUNT(*) FILTER (WHERE requested_model IS NOT NULL AND requested_model <> model)::int AS failed_over,
					COUNT(*) FILTER (WHERE provider = 'oma-ai')::int AS unknown_cost_requests,
					COALESCE(SUM(input_tokens::bigint + output_tokens::bigint), 0)::bigint AS tokens,
					COALESCE(SUM(total_cents) FILTER (WHERE refunded_at IS NULL), 0)::numeric AS billed_cents,
					COALESCE(SUM(cost_cents) FILTER (WHERE provider <> 'oma-ai'), 0)::numeric AS known_upstream_cents,
					percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
				FROM usage_records WHERE created_at >= ${from} AND created_at <= ${to}
				GROUP BY 1
			)
			SELECT to_char(b.bucket, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at, u.*
			FROM buckets b LEFT JOIN usage u ON u.bucket = b.bucket ORDER BY b.bucket
		`);
		return c.json({ ok: true, from: from.toISOString(), to: to.toISOString(), bucket, timezone: "UTC", items: rows(result).map(r => ({
			at: r.at, requests: Number(r.requests ?? 0), errors: Number(r.errors ?? 0), aborted: Number(r.aborted ?? 0),
			freeRequests: Number(r.free_requests ?? 0), failedOver: Number(r.failed_over ?? 0), tokens: Number(r.tokens ?? 0),
			billedCents: Number(r.billed_cents ?? 0), knownUpstreamCents: Number(r.known_upstream_cents ?? 0),
			unknownCostRequests: Number(r.unknown_cost_requests ?? 0), p95LatencyMs: r.p95_latency_ms == null ? null : Number(r.p95_latency_ms),
		})) });
	} catch (err) {
		logger.error({ err }, "[admin] usage timeline failed");
		return c.json({ error: { message: "Usage trends are unavailable. Please retry." } }, 500);
	}
});

adminAnalyticsRoutes.get("/v1/admin/usage/logs", sessionOrBearerAuth, requireAdmin(), readLimit, async (c) => {
	c.header("Cache-Control", "no-store");
	const parsed = logsSchema.safeParse(c.req.query());
	if (!parsed.success) return c.json({ error: { message: "Invalid usage log filters." } }, 400);
	const { days, limit, cursor, q, model, status } = parsed.data;
	let position: z.infer<typeof cursorSchema> | undefined;
	if (cursor) {
		try { position = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))); }
		catch { return c.json({ error: { message: "Invalid log cursor. Reset the filters and retry." } }, 400); }
	}
	const from = new Date(Date.now() - days * 86_400_000);
	const search = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;
	try {
		const result = await db.execute(sql`
			SELECT ur.id, ur.request_id, ur.created_at,
				to_char(ur.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at,
				ur.model, ur.requested_model, ur.provider, ur.routed_via,
				ur.attempt_count, ur.status, ur.input_tokens, ur.output_tokens, ur.latency_ms, ur.refunded_at,
				ur.user_id, u.email, u.name, ur.cost_cents, ur.total_cents
			FROM usage_records ur LEFT JOIN "user" u ON u.id = ur.user_id
			WHERE ur.created_at >= ${from}
			${model ? sql`AND ur.model = ${model}` : sql``}
			${status ? sql`AND ur.status = ${status}` : sql``}
			${search ? sql`AND (ur.request_id ILIKE ${search} OR ur.user_id ILIKE ${search} OR u.email ILIKE ${search} OR u.name ILIKE ${search})` : sql``}
			${position ? sql`AND (ur.created_at, ur.id) < (${position.createdAt}::timestamptz, ${position.id}::uuid)` : sql``}
			ORDER BY ur.created_at DESC, ur.id DESC LIMIT ${limit + 1}
		`);
		const list = rows(result);
		const items = list.slice(0, limit).map(r => ({
			id: r.id, requestId: r.request_id, createdAt: new Date(r.created_at as string).toISOString(),
			model: r.model, requestedModel: r.requested_model, provider: r.provider, routedVia: r.routed_via,
			attemptCount: Number(r.attempt_count ?? 1), status: r.status, inputTokens: Number(r.input_tokens), outputTokens: Number(r.output_tokens),
			latencyMs: r.latency_ms == null ? null : Number(r.latency_ms), refundedAt: r.refunded_at,
			userId: r.user_id, userEmail: r.email, userName: r.name,
			upstreamCents: r.provider === "oma-ai" ? null : Number(r.cost_cents), billedCents: r.refunded_at ? 0 : Number(r.total_cents),
		}));
		const last = list[Math.min(limit, list.length) - 1];
		return c.json({ ok: true, items, nextCursor: list.length > limit && last
			? Buffer.from(JSON.stringify({ createdAt: last.cursor_created_at, id: last.id })).toString("base64url") : null });
	} catch (err) {
		logger.error({ err }, "[admin] usage log query failed");
		return c.json({ error: { message: "Usage logs are unavailable. Please retry." } }, 500);
	}
});
