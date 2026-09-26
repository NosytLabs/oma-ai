import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import {
		user,
		session as sessionTable,
		usageRecords,
		auditLogs,
} from "../db/schema.js";
import { and, desc, eq, gt } from "drizzle-orm";
import { auditLog } from "../middleware/audit.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { sessionAuth } from "../auth/middleware.js";
import { logger } from "../lib/logger.js";
import {
		createApiKey,
		listApiKeys,
		revokeApiKey,
		createApiKeyCookieHeader,
		createLogoutCookieHeader,
} from "../auth/api-keys.js";
import { auth } from "../auth.js";
import { ADMIN_WALLET_ADDRESSES_SET } from "../config.js";
import type { OmaEnv } from "../types.js";
import { extractClientIpOrNull } from "../middleware/rate-limit/utils.js";

export const authRoutes = new Hono<OmaEnv>();

// ─── Session helpers ──────────────────────────────────────────────────────────

/** Pull the Better Auth session from request headers (Hono → fetch). */
async function getSession(c: Context) {
		const headers = new Headers();
		for (const [k, v] of c.req.raw.headers) headers.set(k, v);
		return auth.api.getSession({ headers });
}

// ============================================================
// /user — current user lookup (Better Auth session).
// ============================================================
authRoutes.get("/user", async (c) => {
		const session = await getSession(c);
		if (!session?.user) {
			return c.json(
				{ error: { message: "Unauthorized", type: "authentication_error" } },
				401,
			);
		}
		// Compute admin status with the SAME rule as requireAdmin in
		// middleware.ts (role === "admin" OR evmAddress in the configured
		// admin-wallet allowlist). Exposed so the client gate can agree with
		// the server instead of gate-blocking wallet-gated operators.
		const isAdmin =
			session.user.role === "admin" ||
			(ADMIN_WALLET_ADDRESSES_SET.size > 0 &&
				!!session.user.evmAddress &&
				ADMIN_WALLET_ADDRESSES_SET.has(session.user.evmAddress.toLowerCase()));
		return c.json({
			id: session.user.id,
			email: session.user.email,
			name: session.user.name,
			evmAddress: session.user.evmAddress ?? null,
			isAnonymous: session.user.isAnonymous ?? false,
			role: session.user.role ?? null,
			isAdmin,
			createdAt: session.user.createdAt,
		});
});

// ============================================================
// /sessions — active Better Auth sessions for the current user.
// ============================================================
authRoutes.get("/sessions", sessionAuth, async (c) => {
		const userId = c.get("userId");
		const currentSession = c.get("session");
		const rows = await db
				.select({
						id: sessionTable.id,
						createdAt: sessionTable.createdAt,
						expiresAt: sessionTable.expiresAt,
						userAgent: sessionTable.userAgent,
						ipAddress: sessionTable.ipAddress,
				})
				.from(sessionTable)
				.where(
						and(
								eq(sessionTable.userId, userId),
								gt(sessionTable.expiresAt, new Date()),
						),
				)
				.orderBy(desc(sessionTable.createdAt));

		return c.json({
				sessions: rows.map((row) => ({
						id: row.id,
						createdAt: row.createdAt.toISOString(),
						expiresAt: row.expiresAt.toISOString(),
						userAgent: row.userAgent,
						ipAddress: row.ipAddress,
						isCurrent: row.id === currentSession?.id,
				})),
		});
});

// ============================================================
// DELETE /sessions/:id — revoke a remote Better Auth session.
// Current session must use sign-out (cookie wipe) instead.
// ============================================================
authRoutes.delete("/sessions/:id", sessionAuth, async (c) => {
		const userId = c.get("userId");
		const currentSession = c.get("session");
		const parsed = z
				.string()
				.regex(/^[A-Za-z0-9_-]{8,64}$/)
				.safeParse(c.req.param("id"));
		if (!parsed.success) {
				return c.json(
						{
								error: { message: "Invalid session id", type: "invalid_request_error" },
						},
						400,
				);
		}
		const id = parsed.data;
		if (currentSession?.id && id === currentSession.id) {
				return c.json(
						{
								error: {
										message: "Cannot revoke the current session here — use Sign out.",
										type: "invalid_request_error",
								},
						},
						400,
				);
		}
		const deleted = await db
				.delete(sessionTable)
				.where(and(eq(sessionTable.id, id), eq(sessionTable.userId, userId)))
				.returning({ id: sessionTable.id });
		if (deleted.length === 0) {
				return c.json(
						{ error: { message: "Session not found", type: "not_found" } },
						404,
				);
		}
		await auditLog({
				userId,
				action: "USER_LOGOUT",
				resource: "sessions",
				resourceId: id,
				metadata: { kind: "remote_revoke" },
		});
		return c.json({ success: true, id });
});

// ============================================================
// DELETE /sessions — revoke every other active session (keep current).
// ============================================================
authRoutes.delete("/sessions", sessionAuth, async (c) => {
		const userId = c.get("userId");
		const currentSession = c.get("session");
		const currentId = currentSession?.id;
		const rows = await db
				.select({ id: sessionTable.id })
				.from(sessionTable)
				.where(
						and(
								eq(sessionTable.userId, userId),
								gt(sessionTable.expiresAt, new Date()),
						),
				);
		const targets = rows
				.map((r) => r.id)
				.filter((id) => !currentId || id !== currentId);
		if (targets.length > 0) {
				for (const id of targets) {
						await db
								.delete(sessionTable)
								.where(and(eq(sessionTable.id, id), eq(sessionTable.userId, userId)));
				}
		}
		await auditLog({
				userId,
				action: "USER_LOGOUT",
				resource: "sessions",
				resourceId: userId,
				metadata: { kind: "revoke_others", revokedCount: targets.length },
		});
		return c.json({ success: true, revokedCount: targets.length });
});

// ============================================================
// /account — delete the account (Better Auth).
// ============================================================
authRoutes.delete(
		"/account",
		rateLimit({ windowMs: 60_000, maxRequests: 5 }),
		async (c) => {
		const session = await getSession(c);
		if (!session?.user) {
				return c.json(
						{ error: { message: "Unauthorized", type: "authentication_error" } },
						401,
				);
		}
		const userId = session.user.id;
		const ipAddress = extractClientIpOrNull(c) ?? undefined;
		const userAgent = c.req.header("user-agent") ?? undefined;
		// Audit BEFORE deletion — the FK on audit_logs.user_id is `set null`
		// so post-delete logs would lose the userId. The "requested" row
		// gives compliance a non-orphaned trace that the user actually
		// initiated the wipe.
		await auditLog({
				userId,
				action: "ACCOUNT_DELETE_REQUESTED",
				resource: "users",
				resourceId: userId,
				ipAddress,
				userAgent,
		});
		// Cascade FKs wipe session, account, wallet_address, api_keys,
		// deposits, credit_balances, usage_records, credit_batches,
		// auto_reload_settings, refund_requests, webhook_subscriptions
		// for this user. audit_logs rows are preserved with userId=NULL
		// (set null on the FK) so a forensic trail remains.
		await db.delete(user).where(eq(user.id, userId));
		// Record completion — the user is already gone, so insert the
		// audit row directly with userId=NULL (auditLog() short-circuits
		// on null userId to skip the anonymous sentinel). We still want
		// the action+resource+metadata trail for compliance.
		try {
				await db.insert(auditLogs).values({
						userId: null,
						action: "ACCOUNT_DELETE_COMPLETED",
						resource: "users",
						resourceId: userId,
						ipAddress: ipAddress ?? null,
						userAgent: userAgent ?? null,
						metadata: { previous_user_id: userId },
						createdAt: new Date(),
				});
		} catch (err) {
				logger.error(
						{ err, userId },
						"[auth] failed to write ACCOUNT_DELETE_COMPLETED audit",
				);
		}
		// Wipe the HttpOnly oma_api_key cookie so the browser doesn't keep
		// a now-orphaned key value. The corresponding api_keys row is gone
		// (cascade) but the cookie would still be sent on subsequent
		// requests until it expires (7 days).
		c.header("Set-Cookie", createLogoutCookieHeader());
		return c.json({ success: true });
});

// ============================================================
// /v1/keys — API key CRUD.
// Used by the dashboard to mint a key for browser-direct SSE chat
// (Authorization: Bearer oma_sk_… or HttpOnly oma_api_key cookie).
// All endpoints require a Better Auth session.
// ============================================================
const createKeySchema = z.object({
		name: z.string().min(1).max(64).default("default"),
});

// GET /v1/keys — list active keys for the current user.
authRoutes.get("/v1/keys", sessionAuth, async (c) => {
		const userId = c.get("userId");
		const rows = await listApiKeys(userId, false);
		return c.json({
				keys: rows.map((k) => ({
						id: k.id,
						name: k.name,
						prefix: k.keyPrefix,
						createdAt: k.createdAt.toISOString(),
						lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
				})),
		});
});

// POST /v1/keys — mint a new key. Returns the raw key ONCE.
authRoutes.post(
		"/v1/keys",
		rateLimit({ windowMs: 60_000, maxRequests: 10, failClosed: false }),
		sessionAuth,
		async (c) => {
				const userId = c.get("userId");
				const body = await c.req.json().catch(() => ({}));
				const parsed = createKeySchema.safeParse(body);
				if (!parsed.success) {
						return c.json(
								{
										error: {
												message: "Invalid request",
												type: "invalid_request_error",
												issues: parsed.error.flatten(),
										},
								},
								400,
						);
				}
				const result = await createApiKey(userId, parsed.data.name);
				await auditLog({
						userId,
						action: "API_KEY_CREATED",
						resource: "api_keys",
						resourceId: result.id,
						metadata: { name: result.name },
				});
				return c.json({
						id: result.id,
						name: result.name,
						prefix: result.prefix,
						createdAt: result.createdAt.toISOString(),
						key: result.rawKey,
				});
		},
);

// DELETE /v1/keys/:id — revoke a key.
authRoutes.delete("/v1/keys/:id", sessionAuth, async (c) => {
		const userId = c.get("userId");
		const id = c.req.param("id");
		if (!id) {
				return c.json(
						{ error: { message: "Missing key id", type: "invalid_request_error" } },
						400,
				);
		}
		const revoked = await revokeApiKey(userId, id);
		if (!revoked) {
				return c.json(
						{ error: { message: "API key not found", type: "not_found" } },
						404,
				);
		}
		await auditLog({
				userId,
				action: "API_KEY_REVOKED",
				resource: "api_keys",
				resourceId: id,
		});
		return c.json({ success: true, id });
});

// ============================================================
// /v1/history — wipe usage history + audit trail WITHOUT deleting
// the account. GDPR "right to forget" for telemetry while the
// user's balance, API keys, and identity stay intact.
// ============================================================
authRoutes.delete("/v1/history", sessionAuth, async (c) => {
		const userId = c.get("userId");
		const [usage, audit] = await Promise.all([
				db.delete(usageRecords).where(eq(usageRecords.userId, userId)),
				db.delete(auditLogs).where(eq(auditLogs.userId, userId)),
		]);
		// Write ONE fresh audit row so moderators can still see the wipe
		// happened (the previous trail is intentionally gone). The userId
		// is preserved (audit_logs.user_id FK is `set null`, not cascade),
		// so the userId column on this row keeps its original value.
		await auditLog({
				userId,
				action: "HISTORY_CLEARED",
				resource: "history",
				resourceId: userId,
				metadata: {
						usage_records_deleted: usage.rowCount ?? 0,
						audit_logs_deleted: audit.rowCount ?? 0,
				},
		});
		return c.json({
				success: true,
				deleted: {
						usageRecords: usage.rowCount ?? 0,
						auditLogs: audit.rowCount ?? 0,
				},
		});
});

// ============================================================
// POST /v1/keys/install — install the given raw key as an HttpOnly
// cookie on the current response. Used by the dashboard after minting
// a key, so the browser's SSE chat can authenticate against the Hono
// backend directly without re-issuing the key as an Authorization header.
		authRoutes.post(
				"/v1/keys/install",
				rateLimit({ windowMs: 60_000, maxRequests: 30 }),
				sessionAuth,
				async (c) => {
						const body = await c.req.json().catch(() => null);
						const parsed = z
								.object({
										key: z
												.string()
												.min(20)
												.max(100)
												.regex(/^[a-zA-Z0-9_-]+$/, "Invalid character in API key"),
								})
								.safeParse(body);
						if (!parsed.success) {
						return c.json(
								{
										error: {
												message: "Missing or invalid key",
												type: "invalid_request_error",
										},
								},
								400,
						);
				}
				c.header("Set-Cookie", createApiKeyCookieHeader(parsed.data.key));
				return c.json({ success: true });
		},
);

// POST /v1/keys/logout — clear the HttpOnly API key cookie (does NOT
// touch the Better Auth session; use Better Auth sign-out for that).
authRoutes.post(
		"/v1/keys/logout",
		rateLimit({ windowMs: 60_000, maxRequests: 20 }),
		sessionAuth,
		async (c) => {
		c.header("Set-Cookie", createLogoutCookieHeader());
		return c.json({ success: true });
});
