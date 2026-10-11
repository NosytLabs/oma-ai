/** Per-account request history. Totals cover the full filter, never just a page. */
import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { usageRecords } from "../db/schema.js";

export const usageRoutes = new Hono<OmaEnv>();
const timestamp = z.string().datetime({ offset: true });
const querySchema = z.object({
	model: z.string().max(150).optional(),
	provider: z.enum(["venice", "oma-ai"]).optional(),
	api_key_id: z.uuid().optional(),
	since: timestamp.optional(),
	until: timestamp.optional(),
	limit: z.coerce.number().int().min(1).max(500).default(50),
	cursor: z.string().max(512).optional(),
}).refine(q => !q.since || !q.until || Date.parse(q.since) <= Date.parse(q.until));

usageRoutes.get("/v1/usage", sessionOrBearerAuth, async (c) => {
	c.header("Cache-Control", "no-store");
	const parsed = querySchema.safeParse(c.req.query());
	if (!parsed.success) return c.json({ error: { message: "Invalid usage filters", type: "invalid_request_error" } }, 400);
	const { model, provider, api_key_id, since, until, limit, cursor } = parsed.data;
	const conditions = [eq(usageRecords.userId, c.get("userId"))];
	if (model) conditions.push(eq(usageRecords.model, model));
	if (provider) conditions.push(eq(usageRecords.provider, provider));
	if (api_key_id) conditions.push(eq(usageRecords.apiKeyId, api_key_id));
	if (since) conditions.push(gte(usageRecords.createdAt, new Date(since)));
	if (until) conditions.push(lte(usageRecords.createdAt, new Date(until)));
	const filtered = and(...conditions);
	if (cursor) {
		const [at, id, extra] = cursor.split("|");
		if (extra !== undefined || !timestamp.safeParse(at).success || !z.uuid().safeParse(id).success) {
			return c.json({ error: { message: "Invalid usage cursor", type: "invalid_request_error" } }, 400);
		}
		// Keep Postgres microseconds; JS Date would truncate them and skip rows.
		conditions.push(sql`(${usageRecords.createdAt}, ${usageRecords.id}) < (${at}::timestamptz, ${id}::uuid)`);
	}
	const [rows, [totals]] = await Promise.all([
		db.select({
			id: usageRecords.id, requestId: usageRecords.requestId, apiKeyId: usageRecords.apiKeyId,
			model: usageRecords.model, requestedModel: usageRecords.requestedModel, provider: usageRecords.provider,
			inputTokens: usageRecords.inputTokens, outputTokens: usageRecords.outputTokens,
			costCents: usageRecords.costCents, markupCents: usageRecords.markupCents, totalCents: usageRecords.totalCents,
			billedCents: sql<string>`CASE WHEN ${usageRecords.refundedAt} IS NULL THEN ${usageRecords.totalCents} ELSE 0 END::text`,
			refundedAt: usageRecords.refundedAt, latencyMs: usageRecords.latencyMs, status: usageRecords.status,
			createdAt: usageRecords.createdAt,
			cursorAt: sql<string>`to_char(${usageRecords.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
		}).from(usageRecords).where(and(...conditions))
			.orderBy(desc(usageRecords.createdAt), desc(usageRecords.id)).limit(limit + 1),
		db.select({
			requests: sql<number>`count(*)::int`,
			inputTokens: sql<string>`coalesce(sum(${usageRecords.inputTokens}), 0)::text`,
			outputTokens: sql<string>`coalesce(sum(${usageRecords.outputTokens}), 0)::text`,
			totalCents: sql<string>`coalesce(sum(${usageRecords.totalCents}) FILTER (WHERE ${usageRecords.refundedAt} IS NULL), 0)::text`,
		}).from(usageRecords).where(filtered),
	]);
	const data = rows.slice(0, limit);
	const last = data.at(-1);
	return c.json({
		object: "list",
		data: data.map(({ cursorAt: _cursorAt, ...r }) => ({
			...r, promptTokens: r.inputTokens, completionTokens: r.outputTokens,
			createdAt: r.createdAt.toISOString(), refundedAt: r.refundedAt?.toISOString() ?? null,
		})),
		next_cursor: rows.length > limit && last ? `${last.cursorAt}|${last.id}` : null,
		totals: { requests: totals?.requests ?? 0, input_tokens: Number(totals?.inputTokens ?? 0),
			output_tokens: Number(totals?.outputTokens ?? 0), cost_cents: totals?.totalCents ?? "0" },
	});
});
