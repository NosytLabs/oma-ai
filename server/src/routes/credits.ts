/**
	* GET /v1/credits/balance — active credit batches + aggregate balance.
	* GET /v1/credits/transactions — combined deposit + usage history.
	*
	* Backed by the `credit_batches`, `credit_balances`, `deposits`,
	* `usage_records` tables. All routes require a
	* session or bearer token (same as /v1/balance).
	*
	* KNOWN GAP: `credit_batches` is never written. Grepping the server for
	* `insert(creditBatches)` returns nothing, so `activeBatches` is always an
	* empty array and any UI rendering it shows nothing. The aggregate
	* `balanceCents` is accurate and is the authoritative figure. Populating
	* batches requires an expiry policy decision (the column is NOT NULL and the
	* site currently promises "credits never expire"), so it is deliberately
	* not backfilled with invented data here.
	*/
import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gt, isNull, isNotNull } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import {
		creditBalances,
		creditBatches,
		deposits,
		usageRecords,
} from "../db/schema.js";


export const creditsRoutes = new Hono<OmaEnv>();

// ─── GET /v1/credits/balance ────────────────────────────────────────────────

creditsRoutes.get("/v1/credits/balance", sessionOrBearerAuth, async (c) => {
		c.header("Cache-Control", "no-store");
		const userId = c.get("userId");

		const [batches, balances] = await Promise.all([
				db
						.select()
						.from(creditBatches)
						.where(
								and(
										eq(creditBatches.userId, userId),
										gt(creditBatches.remainingCents, "0"),
										gt(creditBatches.expiresAt, new Date()),
										isNull(creditBatches.usedAt),
								),
						)
						.orderBy(desc(creditBatches.createdAt))
						.limit(50),
				db
						.select()
						.from(creditBalances)
						.where(eq(creditBalances.userId, userId))
						.limit(1),
		]);

		return c.json({
				activeBatches: batches.map((b) => ({
						id: b.id,
						amountCents: b.amountCents,
						remainingCents: b.remainingCents,
						expiresAt: b.expiresAt.toISOString(),
						paymentMethod: b.paymentMethod ?? "usdc",
				})),
				balanceCents: balances[0]?.balanceCents ?? "0",
		});
});

// ─── GET /v1/credits/transactions ───────────────────────────────────────────

creditsRoutes.get(
		"/v1/credits/transactions",
		sessionOrBearerAuth,
		async (c) => {
				const userId = c.get("userId");
				c.header("Cache-Control", "no-store");
				const parsedLimit = z.coerce
						.number()
						.int()
						.min(1)
						.max(200)
						.default(50)
						.safeParse(c.req.query("limit"));
				if (!parsedLimit.success) return c.json({ error: { message: "Limit must be between 1 and 200." } }, 400);
				const limit = parsedLimit.data;

				const [depositRows, usageRows, refundRows] = await Promise.all([
						db
								.select()
								.from(deposits)
								.where(eq(deposits.userId, userId))
								.orderBy(desc(deposits.createdAt))
								.limit(limit),
						db
								.select()
								.from(usageRecords)
								.where(eq(usageRecords.userId, userId))
								.orderBy(desc(usageRecords.createdAt))
								.limit(limit),
						db.select().from(usageRecords)
							.where(and(eq(usageRecords.userId, userId), isNotNull(usageRecords.refundedAt)))
							.orderBy(desc(usageRecords.refundedAt)).limit(limit),
				]);

				const transactions = [
						...depositRows.map((d) => ({
								id: d.id,
								type: "deposit" as const,
								amountCents: Number(d.amountUsd) * 100,
								creditsIssued: d.creditsIssued,
								status: d.status,
								createdAt: d.createdAt.toISOString(),
								txHash: d.txHash,
						})),
						...usageRows.map((u) => ({
								id: u.id,
								type: "usage" as const,
								amountCents: -Number(u.totalCents),
								status: u.status,
								createdAt: u.createdAt.toISOString(),
								model: u.model,
							})),
						...refundRows.map(u => ({ id: `${u.id}-refund`, type: "refund" as const,
							amountCents: Number(u.totalCents), status: "completed", createdAt: u.refundedAt!.toISOString(), model: u.model })),
				]
						.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
						.slice(0, limit);

				return c.json({ transactions });
		},
);
