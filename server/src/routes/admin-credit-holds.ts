import { Hono } from "hono";
import { z } from "zod";
import { sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { db } from "../db/client.js";
import { sessionOrBearerAuth, requireAdmin } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";

/** Native operator diagnostics; the website blocks /api/v1/admin/* entirely. */
export const adminCreditHoldsRoutes = new Hono<OmaEnv>();
adminCreditHoldsRoutes.use("/v1/admin/credit-holds*", sessionOrBearerAuth, requireAdmin(), rateLimit({ windowMs: 60_000, maxRequests: 30, failClosed: false }));
const parameters = z.object({
	state: z.enum(["held", "reconciliation", "settled", "released"]).optional(),
	userId: z.string().min(1).max(256).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).max(10000).default(0),
});
adminCreditHoldsRoutes.get("/v1/admin/credit-holds", async c => {
	c.header("Cache-Control", "no-store");
	const parsed = parameters.safeParse(c.req.query());
	if (!parsed.success) return c.json({ error: { message: "Invalid credit-hold filters" } }, 400);
	const { state, userId, limit, offset } = parsed.data;
	const result = await db.execute(sql`SELECT request_id AS "requestId",user_id AS "userId",reserved_cents AS "reservedCents",state,
		created_at AS "createdAt",updated_at AS "updatedAt" FROM inference_credit_reservations
		WHERE ${state ? sql`state=${state}` : sql`state IN ('held','reconciliation')`}
		AND ${userId ? sql`user_id=${userId}` : sql`true`}
		ORDER BY created_at,request_id LIMIT ${limit} OFFSET ${offset}`);
	return c.json({ holds: result.rows, limit, offset });
});
adminCreditHoldsRoutes.get("/v1/admin/credit-holds/:requestId", async c => {
	c.header("Cache-Control", "no-store");
	const requestId = c.req.param("requestId");
	if (requestId.length > 256) return c.json({ error: { message: "Invalid request ID" } }, 400);
	const result = await db.execute(sql`SELECT r.request_id AS "requestId",r.user_id AS "userId",r.reserved_cents AS "reservedCents",r.state,
		r.created_at AS "createdAt",r.updated_at AS "updatedAt",u.status AS "usageStatus",u.model,u.provider,
		u.input_tokens AS "inputTokens",u.output_tokens AS "outputTokens",u.cost_cents AS "costCents",u.total_cents AS "chargedCents"
		FROM inference_credit_reservations r LEFT JOIN usage_records u ON u.request_id=r.request_id WHERE r.request_id=${requestId}`);
	if (!result.rows.length) return c.json({ error: { message: "Credit hold not found" } }, 404);
	return c.json({ hold: result.rows[0] });
});

/** Detached receipts also cover accounts deleted while inference was running. */
adminCreditHoldsRoutes.get("/v1/admin/credit-holds-receipts", async c => {
	c.header("Cache-Control", "no-store");
	const parsed = z.coerce.number().int().min(1).max(100).default(25).safeParse(c.req.query("limit"));
	if (!parsed.success) return c.json({ error: { message: "Invalid limit" } }, 400);
	const result = await db.execute(sql`SELECT * FROM inference_financial_receipts WHERE state IN ('held','reconciliation') ORDER BY created_at LIMIT ${parsed.data}`);
	return c.json({ receipts: result.rows });
});
adminCreditHoldsRoutes.get("/v1/admin/credit-holds-receipts/:requestId", async c => {
	c.header("Cache-Control", "no-store");
	const requestId = c.req.param("requestId");
	if (requestId.length > 256) return c.json({ error: { message: "Invalid request ID" } }, 400);
	const result = await db.execute(sql`SELECT * FROM inference_financial_receipts WHERE request_id=${requestId}`);
	if (!result.rows.length) return c.json({ error: { message: "Financial receipt not found" } }, 404);
	return c.json({ receipt: result.rows[0] });
});
