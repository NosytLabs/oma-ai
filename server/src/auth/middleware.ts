/**
	* Auth middleware for Hono routes.
	*
	* Two independent paths:
	*
	*   bearerAuth          — API key auth (Authorization: Bearer oma_sk_… or
	*                         the HttpOnly oma_api_key cookie). Used for the
	*                         OpenAI-compatible /v1/* gateway surface.
	*
	*   sessionAuth         — Better Auth session cookie. The Next.js middleware
	*                         decodes the HttpOnly cookie; this middleware
	*                         re-verifies it on the server side by calling the
	*                         Better Auth API. Used for dashboard / settings /
	*                         /admin.
	*
	*   sessionOrBearerAuth — accept either (used on /v1/usage and friends where
	*                         a logged-in dashboard user OR a CLI key should
	*                         both work).
	*
	* The legacy JWT (HS256) verifySessionToken path was REMOVED in this
	* rebuild — Better Auth signs the session cookie itself.
	*/
import type { Context, Next } from "hono";
import {
		validateApiKey,
		isIpAllowedByList,
		shouldRecommendRotation,
} from "./api-keys.js";
import { auth } from "../auth.js";
import type { OmaEnv } from "../types.js";
import type { ApiKey } from "../db/schema.js";
import { config, isProductionEnv, ADMIN_WALLET_ADDRESSES_SET } from "../config.js";
import { extractClientIp } from "../middleware/rate-limit/utils.js";
import { logger } from "../lib/logger.js";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { user } from "../db/schema.js";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Single source of truth for the suspension rejection so bearerAuth,
// sessionAuth, sessionOrBearerAuth, and requireAdmin can't drift apart.
const SUSPENDED_PAYLOAD = {
		error: {
				message: "Your OMA-AI account has been suspended by the administrator.",
				type: "forbidden",
				code: "account_suspended",
		},
} as const;

function isValidEthereumAddress(address: string): boolean {
		return ETH_ADDRESS_REGEX.test(address);
}

export function initAuth(): void {
		// Reuse the canonical production-env list (includes "prod") rather than
		// a hand-rolled subset — a narrower list skipped admin-address validation
		// on "prod"-named deployments.
		if (!isProductionEnv) return;
		if (!config.ADMIN_WALLET_ADDRESSES) return;

		const addresses = config.ADMIN_WALLET_ADDRESSES.split(",")
				.map((a) => a.trim())
				.filter(Boolean);

		for (const address of addresses) {
				if (!isValidEthereumAddress(address)) {
						logger.fatal(
								{ address },
								"[FATAL] ADMIN_WALLET_ADDRESSES contains invalid Ethereum address",
						);
						process.exit(1);
				}
		}
}

// SEC-7: singleflight dedup. Concurrent requests for the same key share
// one in-flight validateApiKey() promise. Finished requests never reuse a
// positive authentication result: revocation must take effect immediately.
type SingleflightRecord = {
		promise: Promise<unknown>;
		timer: ReturnType<typeof setTimeout>;
};
const singleflightInflight = new Map<string, SingleflightRecord>();
const SINGLEFLIGHT_TIMEOUT_MS = 10_000;

async function singleflight<T>(
		key: string,
		fn: () => Promise<T> | T,
): Promise<T> {
		const existing = singleflightInflight.get(key);
		if (existing) return existing.promise as Promise<T>;

		// Own a stable record so timeout/finally only clear *this* flight —
		// never a replacement started after the safety-net timeout fired.
		const record = {} as SingleflightRecord;
		record.promise = (async () => {
				try {
						return await fn();
				} finally {
						if (singleflightInflight.get(key) === record) {
								clearTimeout(record.timer);
								singleflightInflight.delete(key);
						}
				}
		})();
		// Safety net: if the underlying call hangs, drop the slot so later
		// requests are not stuck behind a dead promise forever.
		record.timer = setTimeout(() => {
				if (singleflightInflight.get(key) === record) {
						singleflightInflight.delete(key);
				}
		}, SINGLEFLIGHT_TIMEOUT_MS);
		record.timer.unref();
		singleflightInflight.set(key, record);
		return record.promise as Promise<T>;
}

/**
	* Shared suspension gate used by bearerAuth, sessionAuth, and the session
	* branch of sessionOrBearerAuth. Returns a 403 Response when the user row
	* has either the legacy `banned` flag or the Slice-6 `suspended` flag, or
	* `undefined` when the user is clear to proceed.
	*
	* Missing accounts and database failures block protected requests. A valid
	* session alone cannot establish that its owner still exists or is active.
	*
	* Keep the 403 payload identical across all three callers so the contract
	* can't drift.
	*/
async function rejectIfSuspended(
		c: Context<OmaEnv>,
		userId: string,
		source: "bearer" | "session" | "session-or-bearer",
): Promise<Response | undefined> {
		try {
				const [u] = await db
						.select({ banned: user.banned, suspended: user.suspended })
						.from(user)
						.where(eq(user.id, userId))
						.limit(1);
				if (!u) {
						return c.json({ error: { message: "Unauthorized", type: "authentication_error" } }, 401);
				}
				if (u.banned || u.suspended) {
						return c.json(SUSPENDED_PAYLOAD, 403);
				}
		} catch (err) {
				logger.error(
						{ err, userId, source },
						`[SECURITY] ${source}: failed to verify account status`,
				);
				return c.json({ error: { message: "Authentication temporarily unavailable", type: "server_error", code: "auth_state_unavailable" } }, 503);
		}
		return undefined;
}

export async function bearerAuth(c: Context<OmaEnv>, next: Next) {
		let rawKey: string | null = null;
		let keySource: "authorization" | "x-api-key" | "cookie" | null = null;
		const authHeader = c.req.header("Authorization");
		if (authHeader && /^Bearer\s+/i.test(authHeader)) {
				rawKey = authHeader.replace(/^Bearer\s+/i, "").trim();
				keySource = "authorization";
		} else {
				// Anthropic SDK / Claude Code send `x-api-key: sk-…`
				const xApiKey = c.req.header("x-api-key") ?? c.req.header("X-Api-Key");
				if (xApiKey?.trim()) {
						rawKey = xApiKey.trim();
						keySource = "x-api-key";
				} else {
						const cookieHeader = c.req.header("Cookie") || "";
						const match = cookieHeader.match(
								/(?:^|;\s*)(?:__Host-)?oma_api_key=([^;]+)/,
						);
						if (match) {
								try { rawKey = decodeURIComponent(match[1]); }
								catch { /* Invalid cookie encoding is an invalid credential, not a server failure. */ }
								keySource = "cookie";
						}
				}
		}
		if (!rawKey) {
				return c.json(
						{
								error: {
										message: "Missing or invalid Authorization header (Bearer or x-api-key)",
										type: "authentication_error",
								},
						},
						401,
				);
		}

		let apiKey: ApiKey | null;
		try {
				if (!rawKey) throw new Error("Missing key");
				apiKey = (await singleflight(`apikey:${rawKey}`, () =>
						validateApiKey(rawKey!),
				)) as ApiKey | null;
		} catch (err) {
				logger.error(
						{
								err,
								type: "auth_validation_error",
						},
						"[bearerAuth] validateApiKey threw",
				);
				return c.json(
						{
								error: { message: "Account services are temporarily unavailable. Please try again shortly.", type: "service_unavailable", code: "auth_validation_unavailable" },
						},
						503,
				);
		}

		if (!apiKey) {
				return c.json(
						{
								error: { message: "Invalid API key", type: "authentication_error" },
						},
						401,
				);
		}

		// The HttpOnly API-key cookie is a browser convenience layered on top
		// of a Better Auth session. Bind it to the current session on every use
		// so a delayed Account-A install response cannot authorize Account B.
		// Explicit Authorization/x-api-key credentials remain standalone API
		// authentication for CLI and agent callers.
		if (keySource === "cookie") {
				let session;
				try {
						const headers = new Headers();
						for (const [key, value] of c.req.raw.headers) headers.set(key, value);
						session = await auth.api.getSession({ headers });
				} catch (err) {
						logger.error(
								{
									err,
									type: "cookie_session_validation_error",
								},
								"[bearerAuth] failed to validate session for API-key cookie",
						);
						return c.json({ error: { message: "Account services are temporarily unavailable. Please try again shortly.", type: "service_unavailable", code: "auth_validation_unavailable" } }, 503);
				}
				if (!session?.user || session.user.id !== apiKey.userId) {
						return c.json(
								{
									error: {
										message: "Invalid API key",
										type: "authentication_error",
									},
								},
								401,
						);
				}
		}

		// Check if owner is banned or suspended
		const suspended = await rejectIfSuspended(c, apiKey.userId, "bearer");
		if (suspended) return suspended;

		if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
				return c.json(
						{
								error: {
										message: "API key expired",
										type: "authentication_error",
										code: "expired_api_key",
								},
						},
						401,
				);
		}
		if (apiKey.ipAllowlist && apiKey.ipAllowlist.length > 0) {
				const clientIp = extractClientIp(c);
				if (!isIpAllowedByList(clientIp, apiKey.ipAllowlist)) {
						return c.json(
								{
										error: {
												message: "IP not allowed for this API key",
												type: "forbidden",
												code: "ip_not_allowed",
										},
								},
								403,
						);
				}
		}
		c.set("apiKey", apiKey);
		c.set("userId", apiKey.userId);
		if (apiKey.createdAt && shouldRecommendRotation(new Date(apiKey.createdAt))) {
				c.res.headers.set("X-Key-Rotation-Recommended", "true");
		}
		await next();
}

/**
	* Better Auth session middleware. Reads the HttpOnly session cookie set by
	* the Better Auth handler and resolves it to a { userId, session } pair
	* via `auth.api.getSession`. Sets the same Hono context keys as bearerAuth
	* so downstream route handlers don't have to care which path was used.
	*/
export async function sessionAuth(c: Context<OmaEnv>, next: Next) {
		const headers = new Headers();
		for (const [k, v] of c.req.raw.headers) headers.set(k, v);
		const session = await auth.api.getSession({ headers });
		if (!session?.user) {
				return c.json(
						{
								error: {
										message: "Unauthorized",
										type: "authentication_error",
								},
						},
						401,
				);
		}

		// Check if user is banned or suspended
		const suspended = await rejectIfSuspended(c, session.user.id, "session");
		if (suspended) return suspended;

		c.set("userId", session.user.id);
		c.set("session", session.session);
		c.set("user", session.user);
		await next();
}

/**
	* Accept either a Better Auth session cookie OR an API key. Used on
	* endpoints that work for both browser users (dashboard) and CLI / agents
	* (Bearer key).
	*/
export async function sessionOrBearerAuth(
		c: Context<OmaEnv>,
		next: Next,
) {
		// Try session first.
		const headers = new Headers();
		for (const [k, v] of c.req.raw.headers) headers.set(k, v);
		const session = await auth.api.getSession({ headers });
		if (session?.user) {
				// Keep this branch equivalent to sessionAuth: mixed-auth routes must not
				// become a suspension bypass just because the caller is using a browser
				// session instead of an API key.
				const suspended = await rejectIfSuspended(
						c,
						session.user.id,
						"session-or-bearer",
				);
				if (suspended) return suspended;

				c.set("userId", session.user.id);
				c.set("session", session.session);
				c.set("user", session.user);
				await next();
				return;
		}
		// Fall through to API key.
		return bearerAuth(c, next);
}

export async function optionalAuth(c: Context<OmaEnv>, next: Next) {
	// Explicit credentials must be accepted or rejected, never downgraded to
	// anonymous free-tier access. Reuse the same expiry, IP and suspension gates.
	if (c.req.header("Authorization") || c.req.header("x-api-key")) {
		return bearerAuth(c, next);
	}
	// Without explicit credentials, website chat may use a session or guest access.
	const headers = new Headers();
	for (const [k, v] of c.req.raw.headers) headers.set(k, v);
	const session = await auth.api.getSession({ headers });
	if (session?.user) {
		// SECURITY (audit 2026-09-27 / P1): same suspension gate for the
		// cookie/session path of optionalAuth.
		const suspended = await rejectIfSuspended(c, session.user.id, "session");
		if (suspended) return suspended;
		c.set("userId", session.user.id);
		c.set("session", session.session);
		c.set("user", session.user);
	}
	await next();
}

export function requireAdmin() {
		return async (c: Context<OmaEnv>, next: Next) => {
				const userId = c.get("userId");
				if (!userId) {
						return c.json(
								{
										error: { message: "Authentication required", type: "unauthorized" },
								},
								401,
						);
				}

				// Admin gate — accept either (1) user.role === 'admin' OR
				// (2) the user's linked EVM wallet is in ADMIN_WALLET_ADDRESSES.
				const [u] = await db
						.select({ evmAddress: user.evmAddress, role: user.role, suspended: user.suspended })
						.from(user)
						.where(eq(user.id, userId))
						.limit(1);

				// Even admins must obey suspension (defense in depth — e.g. a
				// compromised admin session shouldn't be able to act after the
				// primary admin has flagged the account).
				if (u?.suspended) {
						return c.json(SUSPENDED_PAYLOAD, 403);
				}

				if (u?.role === "admin") {
						c.set("teamRole", "owner");
						await next();
						return;
				}

				if (
						ADMIN_WALLET_ADDRESSES_SET.size > 0 &&
						u?.evmAddress &&
						ADMIN_WALLET_ADDRESSES_SET.has(u.evmAddress.toLowerCase())
				) {
						c.set("teamRole", "owner");
						await next();
						return;
				}

				return c.json(
						{
								error: { message: "Admin access required", type: "forbidden" },
						},
						403,
				);
		};
}
