/**
	* GET /v1/credits/balance — active credit batches + aggregate balance.
	* GET /v1/credits/transactions — combined deposit + usage history.
	* GET/POST /v1/credits/auto-reload — user auto-reload settings.
	*
	* Backed by the `credit_batches`, `credit_balances`, `deposits`,
	* `usage_records` and `auto_reload_settings` tables. All routes require a
	* session or bearer token (same as /v1/balance).
	*/
import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import {
		autoReloadSettings,
		creditBalances,
		creditBatches,
		deposits,
		usageRecords,
} from "../db/schema.js";

import { rateLimit } from "../middleware/rate-limit.js";

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

// ─── GET/POST /v1/credits/auto-reload ───────────────────────────────────────

const autoReloadSchema = z.object({
		enabled: z.boolean().optional(),
		thresholdCents: z.coerce.number().min(0).max(1_000_000).optional(),
		reloadAmountCents: z.coerce.number().min(100).max(10_000_000).optional(),
		spendLimitCents: z.coerce.number().min(0).max(10_000_000).optional(),
		paymentMethod: z.enum(["usdc"]).optional(),
});

creditsRoutes.get("/v1/credits/auto-reload", sessionOrBearerAuth, async (c) => {
		const userId = c.get("userId");
		const [row] = await db
				.select()
				.from(autoReloadSettings)
				.where(eq(autoReloadSettings.userId, userId))
				.limit(1);

		return c.json(
				row
						? {
										enabled: row.enabled,
										thresholdCents: Number(row.thresholdCents),
										reloadAmountCents: Number(row.reloadAmountCents),
										spendLimitCents: Number(row.spendLimitCents),
										paymentMethod: row.paymentMethod ?? "usdc",
								}
						: {
										enabled: false,
										thresholdCents: 500,
										reloadAmountCents: 10000,
										spendLimitCents: 100000,
										paymentMethod: "usdc",
								},
		);
});

creditsRoutes.post(
		"/v1/credits/auto-reload",
		rateLimit({ windowMs: 60_000, maxRequests: 20 }),
		sessionOrBearerAuth,
		async (c) => {
				const userId = c.get("userId");
				const parsed = autoReloadSchema.safeParse(
						await c.req.json().catch(() => null),
				);
				if (!parsed.success) {
						return c.json(
								{
										error: {
												message: "Invalid auto-reload settings",
												type: "invalid_request_error",
												issues: parsed.error.flatten(),
										},
								},
								400,
						);
				}
				const {
						enabled,
						thresholdCents,
						reloadAmountCents,
						spendLimitCents,
						paymentMethod,
				} = parsed.data;

				const rows = await db
						.insert(autoReloadSettings)
						.values({
								userId,
								enabled: enabled ?? false,
								thresholdCents: thresholdCents != null ? String(thresholdCents) : "500",
								reloadAmountCents:
										reloadAmountCents != null ? String(reloadAmountCents) : "10000",
								spendLimitCents:
										spendLimitCents != null ? String(spendLimitCents) : "100000",
								paymentMethod: paymentMethod ?? "usdc",
						})
						.onConflictDoUpdate({
								target: autoReloadSettings.userId,
								set: {
										enabled: enabled ?? sql`${autoReloadSettings.enabled}`,
										thresholdCents:
												thresholdCents != null
														? String(thresholdCents)
														: sql`${autoReloadSettings.thresholdCents}`,
										reloadAmountCents:
												reloadAmountCents != null
														? String(reloadAmountCents)
														: sql`${autoReloadSettings.reloadAmountCents}`,
										spendLimitCents:
												spendLimitCents != null
														? String(spendLimitCents)
														: sql`${autoReloadSettings.spendLimitCents}`,
										paymentMethod:
												paymentMethod != null
														? paymentMethod
														: sql`${autoReloadSettings.paymentMethod}`,
								},
						})
						.returning();

				const saved = Array.isArray(rows) ? rows[0] : rows;

				return c.json({
						enabled: saved.enabled,
						thresholdCents: Number(saved.thresholdCents),
						reloadAmountCents: Number(saved.reloadAmountCents),
						spendLimitCents: Number(saved.spendLimitCents),
						paymentMethod: saved.paymentMethod ?? "usdc",
				});
		},
);
