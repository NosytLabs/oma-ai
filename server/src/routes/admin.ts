/**
	* Admin operator endpoints — wire the existing audit-action enums to
	* concrete mutation routes so the admin panel can actually do things.
	*
	* Endpoints:
	*   POST /v1/admin/site-settings         — toggle card/crypto payments, maintenance mode
	*   POST /v1/admin/credit-adjust        — add or deduct credits for a user
	*   POST /v1/admin/user-suspend         — flip the user.suspended flag
	*   POST /v1/admin/rate-limit-override  — set/clear a per-user rate-limit override
	*   GET  /v1/admin/users                — paginated user list w/ balance
	*
	* All routes require session/bearer auth + requireAdmin(). Each mutation
	* writes an audit_log row using the existing audit-action enum so the
	* operator trail is preserved.
	*/
import { Hono } from "hono";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth, requireAdmin } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { db } from "../db/client.js";
import {
		siteSettings,
		user as userTable,
		creditBalances,
		rateLimitOverrides,
} from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { auditLog, createAuditLogger } from "../middleware/audit.js";
import { adminAnalyticsRoutes } from "./admin-analytics.js";

export const adminRoutes = new Hono<OmaEnv>();
adminRoutes.route("/", adminAnalyticsRoutes);

// ---------- POST /v1/admin/site-settings ----------

adminRoutes.get("/v1/admin/site-settings", sessionOrBearerAuth, requireAdmin(), async (c) => {
	c.header("Cache-Control", "no-store");
	try {
		const [settings] = await db.select().from(siteSettings).limit(1);
		return c.json({ maintenanceMode: settings?.maintenanceMode ?? false,
			cardPaymentsEnabled: settings?.cardPaymentsEnabled ?? true,
			cryptoPaymentsEnabled: settings?.cryptoPaymentsEnabled ?? true,
			maintenanceMessage: settings?.maintenanceMessage ?? "" });
	} catch (err) {
		logger.error({ err }, "[admin] settings read failed");
		return c.json({ error: { message: "Could not load operator settings." } }, 500);
	}
});

const siteSettingsSchema = z.object({
		cardPaymentsEnabled: z.boolean().optional(),
		cryptoPaymentsEnabled: z.boolean().optional(),
		maintenanceMode: z.boolean().optional(),
		maintenanceMessage: z.string().max(500).optional(),
});

adminRoutes.post(
		"/v1/admin/site-settings",
		sessionOrBearerAuth,
		requireAdmin(),
		rateLimit({ windowMs: 60_000, maxRequests: 30, failClosed: false }),
		// SECURITY (audit 5.4): the SITE_SETTINGS_UPDATED action is fixed,
		// so the audit middleware factory is the right tool. The handler
		// stashes the patch on the context before returning; the middleware
		// writes the audit row after the response.
		createAuditLogger({ action: "SITE_SETTINGS_UPDATED", resource: "site_settings" }),
		async (c) => {
				const body = await c.req.json().catch(() => null);
				const parsed = siteSettingsSchema.safeParse(body);
				if (!parsed.success) {
						return c.json(
								{ error: { message: "Invalid body", issues: parsed.error.flatten() } },
								400,
						);
				}

				const adminId = c.get("userId");
				const patch = parsed.data;

				try {
						const [existing] = await db
								.select({ id: siteSettings.id })
								.from(siteSettings)
								.limit(1);

						if (existing) {
								await db
										.update(siteSettings)
										.set({
												...(patch.cardPaymentsEnabled !== undefined && {
														cardPaymentsEnabled: patch.cardPaymentsEnabled,
												}),
												...(patch.cryptoPaymentsEnabled !== undefined && {
														cryptoPaymentsEnabled: patch.cryptoPaymentsEnabled,
												}),
												...(patch.maintenanceMode !== undefined && {
														maintenanceMode: patch.maintenanceMode,
												}),
												...(patch.maintenanceMessage !== undefined && {
														maintenanceMessage: patch.maintenanceMessage,
												}),
												updatedAt: new Date(),
										})
										.where(eq(siteSettings.id, existing.id));
						} else {
								await db.insert(siteSettings).values({
										cardPaymentsEnabled: patch.cardPaymentsEnabled ?? true,
										cryptoPaymentsEnabled: patch.cryptoPaymentsEnabled ?? true,
										maintenanceMode: patch.maintenanceMode ?? false,
										maintenanceMessage: patch.maintenanceMessage ?? null,
								});
						}
				} catch (err) {
						logger.error({ err, adminId, body: patch }, "[admin] site-settings update failed");
						return c.json({ error: "internal_error" }, 500);
				}

				c.set("auditMetadata", patch);

				return c.json({ ok: true, settings: patch });
		},
);

// ---------- POST /v1/admin/credit-adjust ----------

const creditAdjustSchema = z.object({
		userId: z.string().min(1),
		// Positive cents to add, negative to deduct; at most $10k per operation.
		deltaCents: z.number().int().min(-1_000_000).max(1_000_000).refine(value => value !== 0),
		reason: z.string().min(3).max(200),
});

adminRoutes.post(
		"/v1/admin/credit-adjust",
		sessionOrBearerAuth,
		requireAdmin(),
		rateLimit({ windowMs: 60_000, maxRequests: 30, failClosed: false }),
		async (c) => {
				const body = await c.req.json().catch(() => null);
				const parsed = creditAdjustSchema.safeParse(body);
				if (!parsed.success) {
						return c.json({ error: { message: "Invalid body", issues: parsed.error.flatten() } }, 400);
				}

				const adminId = c.get("userId");
				const { userId, deltaCents, reason } = parsed.data;

				try {
						const [target] = await db
								.select({ id: userTable.id })
								.from(userTable)
								.where(eq(userTable.id, userId))
								.limit(1);
						if (!target) {
								return c.json({ error: { message: "User not found" } }, 404);
						}

						const appliedDeltaCents = await db.transaction(async tx => {
							if (deltaCents < 0) {
								// Lock the balance so the response and audit describe the same
								// deduction even when billing or another operator writes concurrently.
								const [balance] = await tx.select({ balanceCents: creditBalances.balanceCents })
									.from(creditBalances).where(eq(creditBalances.userId, userId)).for("update");
								if (!balance || Number(balance.balanceCents) <= 0) return null;
								const applied = -Math.min(-deltaCents, Number(balance.balanceCents));
								await tx.update(creditBalances).set({
									balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric + ${deltaCents}::numeric, 0)`,
									totalUsedCents: sql`${creditBalances.totalUsedCents}::numeric + LEAST(${creditBalances.balanceCents}::numeric, ${-deltaCents}::numeric)`,
									lastActivityAt: sql`NOW()`,
								}).where(eq(creditBalances.userId, userId));
								return applied;
							}
							await tx
							.insert(creditBalances)
							.values({
								userId,
								balanceCents: deltaCents.toString(),
								totalDepositedCents: deltaCents.toString(),
								totalUsedCents: "0",
							})
							.onConflictDoUpdate({
								target: creditBalances.userId,
								set: {
									balanceCents: sql`${creditBalances.balanceCents}::numeric + ${deltaCents}::numeric`,
									totalDepositedCents: sql`${creditBalances.totalDepositedCents}::numeric + ${deltaCents}::numeric`,
									lastActivityAt: sql`NOW()`,
								},
							});
							return deltaCents;
						});
						if (appliedDeltaCents === null) {
							return c.json({ error: { message: "This account has no credits to deduct" } }, 400);
						}

						await auditLog({
								userId: adminId,
								action: deltaCents >= 0 ? "CREDIT_ADJUSTED" : "CREDIT_DEDUCTED",
								resource: "credit_balance",
								resourceId: userId,
								metadata: { requestedDeltaCents: deltaCents, appliedDeltaCents, reason, deductionCappedAtBalance: appliedDeltaCents !== deltaCents },
						});

						return c.json({ ok: true, userId, deltaCents: appliedDeltaCents, requestedDeltaCents: deltaCents, capped: appliedDeltaCents !== deltaCents });
				} catch (err) {
						logger.error({ err, adminId, userId, deltaCents }, "[admin] credit adjust failed");
						return c.json({ error: "internal_error" }, 500);
				}
		},
);

// ---------- POST /v1/admin/user-suspend ----------

const suspendSchema = z.object({
		userId: z.string().min(1),
		suspended: z.boolean(),
		reason: z.string().min(3).max(200),
});

adminRoutes.post(
		"/v1/admin/user-suspend",
		sessionOrBearerAuth,
		requireAdmin(),
		rateLimit({ windowMs: 60_000, maxRequests: 30, failClosed: false }),
		async (c) => {
				const body = await c.req.json().catch(() => null);
				const parsed = suspendSchema.safeParse(body);
				if (!parsed.success) {
						return c.json({ error: { message: "Invalid body", issues: parsed.error.flatten() } }, 400);
				}

				const adminId = c.get("userId");
				const { userId, suspended, reason } = parsed.data;
				if (suspended && userId === adminId) return c.json({ error: { message: "You cannot suspend your own admin account." } }, 400);

				try {
						const [target] = await db
								.select({ id: userTable.id })
								.from(userTable)
								.where(eq(userTable.id, userId))
								.limit(1);
						if (!target) {
								return c.json({ error: { message: "User not found" } }, 404);
						}
						await db
								.update(userTable)
								.set({
										suspended,
										suspendedReason: suspended ? reason : null,
								})
								.where(eq(userTable.id, userId));

						await auditLog({
								userId: adminId,
								action: suspended ? "USER_SUSPENDED" : "USER_UNSUSPENDED",
								resource: "user",
								resourceId: userId,
								metadata: { reason },
						});

						return c.json({ ok: true, userId, suspended });
				} catch (err) {
						logger.error({ err, adminId, userId, suspended }, "[admin] user suspend failed");
						return c.json({ error: "internal_error" }, 500);
				}
		},
);

// ---------- POST /v1/admin/rate-limit-override ----------

const rateLimitOverrideSchema = z.object({
		userId: z.string().min(1),
		maxRequestsPerMinute: z.number().int().min(1).max(10_000).nullable(),
		reason: z.string().min(3).max(200),
});

adminRoutes.post(
		"/v1/admin/rate-limit-override",
		sessionOrBearerAuth,
		requireAdmin(),
		rateLimit({ windowMs: 60_000, maxRequests: 30, failClosed: false }),
		async (c) => {
				const body = await c.req.json().catch(() => null);
				const parsed = rateLimitOverrideSchema.safeParse(body);
				if (!parsed.success) {
						return c.json({ error: { message: "Invalid body", issues: parsed.error.flatten() } }, 400);
				}

				const adminId = c.get("userId");
				const { userId, maxRequestsPerMinute, reason } = parsed.data;

				try {
						const [target] = await db
								.select({ id: userTable.id })
								.from(userTable)
								.where(eq(userTable.id, userId))
								.limit(1);
						if (!target) {
								return c.json({ error: { message: "User not found" } }, 404);
						}

						if (maxRequestsPerMinute == null) {
								await db.delete(rateLimitOverrides).where(eq(rateLimitOverrides.userId, userId));
						} else {
								await db
										.insert(rateLimitOverrides)
										.values({ userId, maxRequestsPerMinute, reason, setBy: adminId })
										.onConflictDoUpdate({
												target: rateLimitOverrides.userId,
												set: {
														maxRequestsPerMinute,
														reason,
														setBy: adminId,
														updatedAt: new Date(),
												},
										});
						}

						await auditLog({
								userId: adminId,
								action:
										maxRequestsPerMinute == null
												? "RATE_LIMIT_OVERRIDE_REMOVED"
												: "RATE_LIMIT_OVERRIDE_SET",
								resource: "rate_limit_overrides",
								resourceId: userId,
								metadata: { maxRequestsPerMinute, reason },
						});

						return c.json({ ok: true, userId, maxRequestsPerMinute });
				} catch (err) {
						logger.error({ err, adminId, userId }, "[admin] rate-limit override failed");
						return c.json({ error: "internal_error" }, 500);
				}
		},
);

// ---------- GET /v1/admin/users (paginated) ----------

const listUsersSchema = z.object({
		limit: z.coerce.number().int().min(1).max(100).default(20),
		cursor: z.string().optional(),
		q: z.string().max(100).optional(),
});

adminRoutes.get(
		"/v1/admin/users",
		sessionOrBearerAuth,
		requireAdmin(),
		rateLimit({ windowMs: 60_000, maxRequests: 60, failClosed: false }),
		async (c) => {
				const url = new URL(c.req.url);
				const parsed = listUsersSchema.safeParse({
						limit: url.searchParams.get("limit") ?? undefined,
						cursor: url.searchParams.get("cursor") ?? undefined,
						q: url.searchParams.get("q") ?? undefined,
				});
				if (!parsed.success) {
						return c.json({ error: { message: "Invalid query", issues: parsed.error.flatten() } }, 400);
				}
				const { limit, cursor, q } = parsed.data;

				try {
						// Hand-rolled SQL because drizzle's nested select on a correlated
						// subquery + ILIKE is awkward when combined with cursor pagination.
						const search = q ? `%${q}%` : null;
						const cursorFilter = cursor ? sql`AND u.id > ${cursor}` : sql``;
						const searchFilter = search
								? sql`AND (email ILIKE ${search} OR name ILIKE ${search})`
								: sql``;

						const rows = await db.execute(sql`
													SELECT u.id, u.email, u.name, u.role, u.suspended, u.suspended_reason,
																u.created_at, u.updated_at,
																COALESCE(cb.balance_cents, '0') AS balance_cents,
																COALESCE(cb.total_deposited_cents, '0') AS total_deposited_cents,
																-- Per-user lifetime usage, so the admin can see WHO is
																-- spending without a second round-trip per row. Aggregate
																-- in a lateral subquery rather than a GROUP BY on the outer
																-- query, which would fight the cursor pagination.
																COALESCE(us.requests, 0) AS usage_requests,
																COALESCE(us.input_tokens, 0) AS usage_input_tokens,
																COALESCE(us.output_tokens, 0) AS usage_output_tokens,
																COALESCE(us.upstream_cents, '0') AS usage_upstream_cents,
																COALESCE(us.total_cents, '0') AS usage_total_cents,
																us.last_used_at AS usage_last_used_at
														FROM "user" u
														LEFT JOIN credit_balances cb ON cb.user_id = u.id
														LEFT JOIN LATERAL (
															SELECT
																COUNT(*)::int AS requests,
																SUM(input_tokens)::bigint AS input_tokens,
																SUM(output_tokens)::bigint AS output_tokens,
																SUM(cost_cents)::numeric AS upstream_cents,
																SUM(total_cents) FILTER (WHERE refunded_at IS NULL)::numeric AS total_cents,
																MAX(created_at) AS last_used_at
															FROM usage_records ur
															WHERE ur.user_id = u.id
														) us ON TRUE
														WHERE 1=1 ${searchFilter} ${cursorFilter}
														ORDER BY u.id ASC
														LIMIT ${limit + 1}
												`);

												const list = (rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? rows;
												const arr = list as Array<Record<string, unknown>>;
												const items = arr.slice(0, limit).map((r) => ({
													id: r.id,
													email: r.email,
													name: r.name,
													role: r.role,
													suspended: r.suspended,
													suspendedReason: r.suspended_reason,
													createdAt: r.created_at,
													updatedAt: r.updated_at,
													balanceCents: r.balance_cents,
													totalDepositedCents: r.total_deposited_cents,
													usage: {
														requests: r.usage_requests,
														inputTokens: r.usage_input_tokens,
														outputTokens: r.usage_output_tokens,
														upstreamCents: r.usage_upstream_cents,
														totalCents: r.usage_total_cents,
														lastUsedAt: r.usage_last_used_at ?? null,
													},
												}));
						const nextCursor = arr.length > limit ? items[items.length - 1]?.id : null;

												return c.json({ ok: true, items, nextCursor });
											} catch (err) {
												logger.error({ err }, "[admin] list users failed");
												return c.json({ error: "internal_error" }, 500);
											}
							},
						);

						// ---------- GET /v1/admin/usage/summary ----------

						/**
						 * One grouped pass over usage_records for the admin usage charts.
						 *
						 * Why a single GROUP BY rather than several queries: the charts need request
						 * volume, token volume, upstream cost, markup and error rate on the SAME
						 * grouping key. Issuing one query per metric and joining in JS would repeat
						 * the scan N times and let the numbers disagree if a write landed in between.
						 *
						 * The (created_at, model, provider, cost_cents) index
						 * (idx_usage_records_analytics) covers the default model grouping; the
						 * created_at predicate is what makes it usable at all.
						 */
						const usageSummarySchema = z.object({
							from: z.coerce.date().optional(),
							to: z.coerce.date().optional(),
							group_by: z.enum(["model", "provider", "user"]).default("model"),
							// Bounded so a missing/loose date range cannot scan the whole table and
							// stall the admin panel.
							limit: z.coerce.number().int().min(1).max(500).default(200),
						});

						adminRoutes.get(
							"/v1/admin/usage/summary",
							sessionOrBearerAuth,
							requireAdmin(),
							rateLimit({ windowMs: 60_000, maxRequests: 30, failClosed: false }),
							async (c) => {
								const url = new URL(c.req.url);
								const parsed = usageSummarySchema.safeParse({
									from: url.searchParams.get("from") ?? undefined,
									to: url.searchParams.get("to") ?? undefined,
									group_by: url.searchParams.get("group_by") ?? undefined,
									limit: url.searchParams.get("limit") ?? undefined,
								});
								if (!parsed.success) {
									return c.json({ error: { message: "Invalid query", issues: parsed.error.flatten() } }, 400);
								}
								const { from, to, group_by: groupBy, limit } = parsed.data;

								// Default to the last 30 days. An unbounded scan of usage_records is
								// the kind of query that takes the admin panel down on a large table.
								const toDate = to ?? new Date();
								const fromDate = from ?? new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
								if (fromDate > toDate || toDate.getTime() - fromDate.getTime() > 90 * 86_400_000) return c.json({ error: { message: "Choose an ordered range of up to 90 days." } }, 400);

								// The grouping key is chosen from a fixed allow-list, never
								// interpolated from user input — the identifier goes into the SQL as a
								// value only, never as an expression.
								const groupColumn =
									groupBy === "provider"
										? sql`provider::text`
										: groupBy === "user"
											? sql`user_id`
											: sql`model`;
								const groupLabel = groupBy === "user" ? sql`(SELECT COALESCE(u.email, u.name, u.id) FROM "user" u WHERE u.id = usage_records.user_id)` : groupColumn;

								// `status` is free text on the row ('completed' | 'error' |
								// 'aborted' | 'free_tier'). A request counts as an error only when it
								// failed — an aborted stream still consumed upstream tokens and is
								// revenue-relevant, not an error.
								const errorCount = sql<number>`COUNT(*) FILTER (WHERE status = 'error')`;
								// Refunding revenue does not refund the provider's token charge.
								const netMarkup = sql`CASE WHEN provider = 'oma-ai' THEN 0 WHEN refunded_at IS NOT NULL THEN -cost_cents ELSE markup_cents END`;

								try {
									const rows = await db.execute(sql`
										SELECT
											${groupColumn} AS key,
											${groupLabel} AS label,
											COUNT(*)::int AS requests,
											COUNT(*) FILTER (WHERE provider = 'oma-ai')::int AS unknown_cost_requests,
											SUM(COUNT(*)) OVER ()::bigint AS range_requests,
											SUM(COUNT(*) FILTER (WHERE provider = 'oma-ai')) OVER ()::bigint AS range_unknown_cost_requests,
											SUM(SUM(input_tokens)) OVER ()::bigint AS range_input_tokens,
											SUM(SUM(output_tokens)) OVER ()::bigint AS range_output_tokens,
											SUM(SUM(cost_cents) FILTER (WHERE provider <> 'oma-ai')) OVER ()::numeric AS range_upstream_cents,
											SUM(SUM(${netMarkup})) OVER ()::numeric AS range_markup_cents,
											SUM(SUM(total_cents) FILTER (WHERE refunded_at IS NULL)) OVER ()::numeric AS range_total_cents,
											COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
											COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
											COALESCE(SUM(cost_cents) FILTER (WHERE provider <> 'oma-ai'), 0)::numeric AS upstream_cents,
											COALESCE(SUM(${netMarkup}), 0)::numeric AS markup_cents,
											COALESCE(SUM(total_cents) FILTER (WHERE refunded_at IS NULL), 0)::numeric AS total_cents,
											${errorCount}::int AS error_count,
											-- avg_latency_ms is meaningful now that latency_ms is written.
											COALESCE(ROUND(AVG(latency_ms))::bigint, 0) AS avg_latency_ms
										FROM usage_records
										WHERE created_at >= ${fromDate} AND created_at <= ${toDate}
										GROUP BY ${groupColumn}
										ORDER BY total_cents DESC
										LIMIT ${limit}
									`);

									const list = (rows as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? rows;
									const arr = list as Array<Record<string, unknown>>;

									const items = arr.map((r) => {
										const requests = Number(r.requests ?? 0);
										const errorCountNum = Number(r.error_count ?? 0);
										return {
											key: r.key,
											label: r.label ?? r.key,
											requests,
											unknownCostRequests: Number(r.unknown_cost_requests ?? 0),
											inputTokens: Number(r.input_tokens ?? 0),
											outputTokens: Number(r.output_tokens ?? 0),
											// Numeric comes back from pg as a string to preserve
											// precision; normalise so the charts get real numbers.
											upstreamCents: Number(r.upstream_cents ?? 0),
											markupCents: Number(r.markup_cents ?? 0),
											totalCents: Number(r.total_cents ?? 0),
											// A group with zero requests cannot have errors; avoid NaN.
											errorRate: requests > 0 ? errorCountNum / requests : 0,
											errorCount: errorCountNum,
											avgLatencyMs: Number(r.avg_latency_ms ?? 0),
										};
									});

									return c.json({
										ok: true,
										groupBy,
										from: fromDate.toISOString(),
										to: toDate.toISOString(),
										items,
										// Totals across the whole range (not just the returned page), so
										// the header can show the true spend even when the group list is
										// truncated by `limit`.
										totals: {
											requests: Number(arr[0]?.range_requests ?? 0),
											inputTokens: Number(arr[0]?.range_input_tokens ?? 0),
											outputTokens: Number(arr[0]?.range_output_tokens ?? 0),
											upstreamCents: Number(arr[0]?.range_upstream_cents ?? 0),
											markupCents: Number(arr[0]?.range_markup_cents ?? 0),
											totalCents: Number(arr[0]?.range_total_cents ?? 0),
											unknownCostRequests: Number(arr[0]?.range_unknown_cost_requests ?? 0),
										},
									});
								} catch (err) {
									logger.error({ err }, "[admin] usage summary failed");
									return c.json({ error: "internal_error" }, 500);
								}
							},
						);

												// Removed 2026-10: GET /v1/admin/usage/failover had
						// zero callers (no admin page consumer, no openapi
						// entry) since the rewrite to usage-summary. The
						// `requested_model IS DISTINCT FROM model` aggregation
						// already lives in /v1/admin/usage/summary as the
						// `failedOver` field. Re-add if a dedicated failover
						// drilldown page ships.

;
