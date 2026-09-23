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

export const adminRoutes = new Hono<OmaEnv>();

// ---------- POST /v1/admin/site-settings ----------

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
		// Positive cents to add, negative to deduct. Server clamps to ±$1k/operation.
		deltaCents: z.number().int().min(-1_000_000).max(1_000_000),
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

						await db
								.insert(creditBalances)
								.values({
										userId,
										balanceCents: deltaCents.toString(),
										totalDepositedCents: deltaCents > 0 ? deltaCents.toString() : "0",
										totalUsedCents: "0",
								})
								.onConflictDoUpdate({
										target: creditBalances.userId,
										set: {
												balanceCents: sql`${creditBalances.balanceCents}::numeric + ${deltaCents}::numeric`,
												totalDepositedCents:
														deltaCents > 0
																? sql`${creditBalances.totalDepositedCents}::numeric + ${deltaCents}::numeric`
																: sql`${creditBalances.totalDepositedCents}::numeric`,
												lastActivityAt: sql`NOW()`,
										},
								});

						await auditLog({
								userId: adminId,
								action: deltaCents >= 0 ? "CREDIT_ADJUSTED" : "CREDIT_DEDUCTED",
								resource: "credit_balance",
								resourceId: userId,
								metadata: { deltaCents, reason },
						});

						return c.json({ ok: true, userId, deltaCents });
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
						const cursorFilter = cursor ? sql`AND id > ${cursor}` : sql``;
						const searchFilter = search
								? sql`AND (email ILIKE ${search} OR name ILIKE ${search})`
								: sql``;

						const rows = await db.execute(sql`
								SELECT u.id, u.email, u.name, u.role, u.suspended, u.suspended_reason,
															u.created_at, u.updated_at,
															COALESCE(cb.balance_cents, '0') AS balance_cents,
															COALESCE(cb.total_deposited_cents, '0') AS total_deposited_cents
								FROM "user" u
								LEFT JOIN credit_balances cb ON cb.user_id = u.id
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
						}));
						const nextCursor = items.length === limit ? items[items.length - 1]?.id : null;

						return c.json({ ok: true, items, nextCursor });
				} catch (err) {
						logger.error({ err }, "[admin] list users failed");
						return c.json({ error: "internal_error" }, 500);
				}
		},
);
