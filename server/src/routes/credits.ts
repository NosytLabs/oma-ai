/**
	* GET /v1/credits/balance — active credit batches + aggregate balance.
	* GET /v1/credits/transactions — combined deposit + usage history.
	*
	* Backed by the `credit_batches`, `credit_balances`, `deposits`,
	* `usage_records` tables. All routes require a
	* session or bearer token (same as /v1/balance).
	*/
import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
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
				const limit = z.coerce
						.number()
						.int()
						.min(1)
						.max(200)
						.default(50)
						.parse(c.req.query("limit"));

				const [depositRows, usageRows] = await Promise.all([
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
								amountCents: Number(u.totalCents),
								status: u.status,
								createdAt: u.createdAt.toISOString(),
								model: u.model,
						})),
				]
						.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
						.slice(0, limit);

				return c.json({ transactions });
		},
);
