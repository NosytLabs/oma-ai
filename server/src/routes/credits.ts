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
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { normalizeUsageStatus } from "../lib/usage-status.js";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { readCreditHoldTotals } from "../lib/credit-holds.js";
import { publicCreditBalance } from "../lib/public-credit-balance.js";
import {
		creditBalances,
		deposits,
		usageRecords,
} from "../db/schema.js";


export const creditsRoutes = new Hono<OmaEnv>();

// ─── GET /v1/credits/balance ────────────────────────────────────────────────

creditsRoutes.get("/v1/credits/balance", sessionOrBearerAuth, async (c) => {
		c.header("Cache-Control", "no-store");
		const userId = c.get("userId");

		const [balances, holds] = await Promise.all([
				db
						.select()
						.from(creditBalances)
						.where(eq(creditBalances.userId, userId))
						.limit(1),
				readCreditHoldTotals(userId),
		]);

		return c.json({
				// `credit_batches` is a legacy table: it has no writer anywhere in the
				// server and is empty in production (verified against the live
				// database), so querying it only cost a round trip per balance read to
				// produce an empty array. The field stays in the response so the wire
				// shape is unchanged; `balanceCents` is the authoritative figure. See
				// the KNOWN GAP note above.
				activeBatches: [],
				...publicCreditBalance(balances[0]?.balanceCents),
				...holds,
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
							// The stored column is free text; the wire only ever carries a known status.
							status: normalizeUsageStatus(u.status),
							createdAt: u.createdAt.toISOString(),
							model: u.model,
						})),
						// A refund row is a usage record that was refunded: report its real usage
						// status instead of a hardcoded "completed" that hid drifted values.
						...refundRows.map(u => ({ id: `${u.id}-refund`, type: "refund" as const,
							amountCents: Number(u.totalCents), status: normalizeUsageStatus(u.status), createdAt: u.refundedAt!.toISOString(), model: u.model })),
				]
						.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
						.slice(0, limit);

				return c.json({ transactions });
		},
);
