/**
 * GET /v1/usage — paginated per-request usage history for the
 * authenticated user. Sourced from the `usage_records` table. Backed by
 * an index on (user_id, created_at DESC) for fast listing.
 *
 * Query params:
 *   - model     (optional) filter by model id
 *   - provider  (optional) filter by provider ("venice" | "oma-ai")
 *   - since     (optional) ISO timestamp; records created at or after
 *   - until     (optional) ISO timestamp; records created at or before
 *   - limit     (optional) 1..200, default 50
 *   - cursor    (optional) opaque pagination cursor (created_at,id)
 *
 * Returns 200 with `{ data: UsageRecord[], next_cursor: string|null,
 * totals: { requests, input_tokens, output_tokens, cost_cents } }`.
 */
import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { usageRecords } from "../db/schema.js";

export const usageRoutes = new Hono<OmaEnv>();

const querySchema = z.object({
	model: z.string().optional(),
	provider: z.enum(["venice", "oma-ai"]).optional(),
	since: z.string().datetime().optional(),
	until: z.string().datetime().optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	cursor: z.string().optional(),
});

usageRoutes.get("/v1/usage", sessionOrBearerAuth, async (c) => {
	const userId = c.get("userId");
	const parsed = querySchema.safeParse(c.req.query());
	if (!parsed.success) {
		return c.json(
			{
				error: {
					message: "Invalid query",
					type: "invalid_request_error",
					issues: parsed.error.flatten(),
				},
			},
			400,
		);
	}
	const { model, provider, since, until, limit, cursor } = parsed.data;

	const conds = [eq(usageRecords.userId, userId)];
	if (model) conds.push(eq(usageRecords.model, model));
	if (provider) conds.push(eq(usageRecords.provider, provider));
	if (since) conds.push(gte(usageRecords.createdAt, new Date(since)));
	if (until) conds.push(lte(usageRecords.createdAt, new Date(until)));
	if (cursor) {
		// cursor format: "<isoTimestamp>|<recordId>"
		const [iso, id] = cursor.split("|");
		if (iso && id) {
			conds.push(
				sql`(${usageRecords.createdAt}, ${usageRecords.id}) < (${new Date(iso).toISOString()}::timestamptz, ${id})`,
			);
		}
	}

	const where = and(...conds);
	const rows = await db
		.select({
			id: usageRecords.id,
			requestId: usageRecords.requestId,
			model: usageRecords.model,
			provider: usageRecords.provider,
			inputTokens: usageRecords.inputTokens,
			outputTokens: usageRecords.outputTokens,
			costCents: usageRecords.costCents,
			markupCents: usageRecords.markupCents,
			totalCents: usageRecords.totalCents,
			status: usageRecords.status,
			createdAt: usageRecords.createdAt,
		})
		.from(usageRecords)
		.where(where)
		.orderBy(desc(usageRecords.createdAt), desc(usageRecords.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const data = hasMore ? rows.slice(0, limit) : rows;
	const nextCursor =
		hasMore && data.length > 0
			? `${data[data.length - 1].createdAt.toISOString()}|${data[data.length - 1].id}`
			: null;

	const [totals] = await db
		.select({
			requests: sql<number>`count(*)::int`,
			inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)::int`,
			outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)::int`,
			totalCents: sql<string>`coalesce(sum(${usageRecords.totalCents}), 0)::numeric`,
		})
		.from(usageRecords)
		.where(
			and(
				eq(usageRecords.userId, userId),
				model ? eq(usageRecords.model, model) : undefined,
				provider ? eq(usageRecords.provider, provider) : undefined,
				since ? gte(usageRecords.createdAt, new Date(since)) : undefined,
				until ? lte(usageRecords.createdAt, new Date(until)) : undefined,
			),
		);

	return c.json({
		object: "list",
		data: data.map((r) => ({
			...r,
			createdAt: r.createdAt.toISOString(),
		})),
		next_cursor: nextCursor,
		totals: {
			requests: totals?.requests ?? 0,
			input_tokens: totals?.inputTokens ?? 0,
			output_tokens: totals?.outputTokens ?? 0,
			cost_cents: totals?.totalCents ?? "0",
		},
	});
});
