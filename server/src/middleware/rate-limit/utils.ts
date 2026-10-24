import modelLimits from "./model-limits.json" with { type: "json" };
import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { OmaEnv } from "../../types.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";

const TRUSTED_PROXIES_ENV = config.TRUSTED_PROXY_IPS || "";
const TRUSTED_PROXIES: Set<string> = new Set(
	TRUSTED_PROXIES_ENV.split(",")
		.map(normalizeIp)
		.filter((ip): ip is string => ip !== null)
);

/**
 * Shared secret authenticating the Vercel -> Neon hop.
 *
 * Production traffic reaches this function through the Vercel /api proxy, so
 * the TCP peer is always Vercel's egress IP. With no trusted-proxy list,
 * `extractClientIp` correctly refuses `x-forwarded-for` — which collapsed
 * EVERY visitor into one rate-limit and free-tier bucket (20 msgs/day for the
 * whole internet).
 *
 * This function is PUBLICLY reachable, so a forwarded IP cannot simply be
 * trusted: anyone can call it directly and set any header. Requiring a secret
 * the proxy alone holds makes the forwarded IP trustworthy WITHOUT reopening
 * the H2 spoofing bypass.
 */
const INTERNAL_PROXY_SECRET = config.INTERNAL_PROXY_SECRET || "";

/**
 * Verification keyring, decoded once at module load.
 *
 * Config cannot change after startup and `extractClientIp` runs on every
 * rate-limited request, so re-encoding the secret per call was pure
 * per-request allocation.
 *
 * The web proxy and this API are deployed independently (Vercel and Neon) and
 * must agree on the secret. Rotating it in place leaves a window where the two
 * sides disagree, and every request then fails proxy authentication -- which
 * silently collapses all visitors into one shared rate-limit and free-tier
 * bucket instead of failing loudly. A previous-secret list makes the rollover
 * non-destructive: publish the new value to both sides, keep the old value
 * here for verification only, then drop it once both sides are on the new
 * value.
 */
const INTERNAL_PROXY_SECRET_KEYS: Buffer[] = [
	...new Set(
		[INTERNAL_PROXY_SECRET, ...(config.INTERNAL_PROXY_SECRET_PREVIOUS ?? "").split(",")]
			.map((s) => s.trim())
			.filter((s) => s.length > 0),
	),
].map((s) => Buffer.from(s, "utf8"));

export function proxyIsAuthenticated(headers: {
	header: (k: string) => string | undefined;
}): boolean {
	// An unset/empty configured secret must never match, or an attacker
	// sending an empty header would authenticate.
	if (INTERNAL_PROXY_SECRET_KEYS.length === 0) return false;
	const provided = headers.header("x-oma-proxy-secret");
	if (!provided) return false;
	const providedBuf = Buffer.from(provided, "utf8");
	for (const keyBuf of INTERNAL_PROXY_SECRET_KEYS) {
		// Compare ENCODED lengths, not string lengths: a multibyte header would
		// otherwise pass the string check and then throw inside timingSafeEqual,
		// turning a hostile request into a swallowed server error.
		if (providedBuf.length !== keyBuf.length) continue;
		// Equal-length buffers cannot make timingSafeEqual throw, so no try/catch:
		// an empty catch here would silently disguise a real bug as "untrusted".
		if (timingSafeEqual(providedBuf, keyBuf)) return true;
	}
	return false;
}

if (TRUSTED_PROXIES.size === 0 && INTERNAL_PROXY_SECRET_KEYS.length === 0 && config.NODE_ENV === "production") {
	logger.warn("No authenticated proxy or trusted socket peers configured; forwarded client IPs are ignored. Configure proxy authentication to keep visitors in separate rate-limit buckets.");
}

// Model-specific limits (requests per minute). Keys must match a real
// catalog id (server/src/inference/models.ts) — only entries that survive
// the catalog audit are kept. `getModelLimits()` is called per-model; any
// ID not listed here falls through to the default limits in the
// rate-limit middleware.
export const MODEL_LIMITS: Record<string, { rpm: number; tpm: number }> = modelLimits;

function isTrustedProxy(ip: string): boolean {
		return TRUSTED_PROXIES.has(ip);
}

function normalizeIp(value: string | undefined): string | null {
	const ip = value?.trim().replace(/^::ffff:/i, "").toLowerCase();
	return ip && isIP(ip) ? ip : null;
}

/**
	* Socket remote address for direct Node connections (no reverse proxy).
	* Prefer headers only when a trusted proxy (or x-real-ip) is present —
	* never invent an IP from client-spoofable XFF alone.
	*/
function socketRemoteAddress(c: Context<OmaEnv>): string | null {
		try {
				// getConnInfo throws if c.env.incoming is missing (app.request in tests).
				const addr = getConnInfo(c as never)?.remote?.address;
				if (typeof addr === "string") return normalizeIp(addr);
		} catch {
				/* not a Node request (app.request in tests, edge, etc.) */
		}
		return null;
}

export function extractClientIp(c: Context<OmaEnv>): string {
	const peer = socketRemoteAddress(c);
	const xRealIp = normalizeIp(c.req.header("x-real-ip"));

	// Authenticated Vercel -> Neon hop. Vercel OVERWRITES x-forwarded-for
	// with the real client IP (per Vercel's own docs) to prevent spoofing, so
	// the value is trustworthy — but ONLY when we know the request actually
	// came through our proxy. The function is public, so a direct caller must
	// not be able to assert an IP; the shared secret is what distinguishes the
	// two. Without this, every proxied visitor resolved to Vercel's egress IP
	// and shared one free-tier bucket (20 msgs/day for all users).
	if (proxyIsAuthenticated(c.req)) {
		const forwarded =
			c.req.header("x-vercel-forwarded-for") ?? c.req.header("x-forwarded-for");
		if (forwarded) {
			const first = normalizeIp(forwarded.split(",")[0]);
			if (first) return first;
		}
		return xRealIp || peer || "unknown";
	}

	// A header cannot authenticate its own sender. Start with the actual
	// socket peer, then walk only the trusted suffix of a forwarded chain.
	if (!peer || !isTrustedProxy(peer)) return peer || "unknown";
	const forwarded = c.req.header("x-forwarded-for");
	if (forwarded) {
		const ips = forwarded.split(",").map(normalizeIp);
		if (ips.some(ip => ip === null)) return peer;
		for (let i = ips.length - 1; i >= 0; i--) {
			const ip = ips[i]!;
			if (!isTrustedProxy(ip) || i === 0) return ip;
		}
	}
	return xRealIp || peer;
}

/**
 * Nullable form for audit/compliance consumers, which store an absent address
 * as SQL NULL rather than the string "unknown".
 *
 * Every security surface must resolve the caller's identity through
 * extractClientIp, never by reading x-forwarded-for directly: the function is
 * publicly reachable, so a direct header read records whatever the caller
 * asserted and silently makes the audit trail worthless for abuse tracing.
 */
export function extractClientIpOrNull(c: Context<OmaEnv>): string | null {
	const ip = extractClientIp(c);
	return ip === "unknown" ? null : ip;
}
// Get model-based rate limits
export function getModelLimits(model: string): { rpm: number; tpm: number } | null {
		return MODEL_LIMITS[model.toLowerCase()] ?? null;
}

/**
 * Synthetic guests must rate-limit by IP — a shared userId would let one
 *  noisy client exhaust free chat/search for everyone.
 */
const SYNTHETIC_GUEST_IDS = new Set([
	"oma-ai-guest",
	"x402-guest",
]);

/**
 * True for a real, countable user identity.
 *
 * Synthetic guest ids are excluded deliberately: every anonymous visitor
 * shares `oma-ai-guest`, so keying a per-user tier on it would collapse all
 * guests into one shared bucket — the exact failure this module exists to
 * prevent. Those callers fall through to the IP tier.
 */
export function isCountableUserId(userId: string | undefined | null): boolean {
	if (!userId) return false;
	if (SYNTHETIC_GUEST_IDS.has(userId)) return false;
	return !userId.startsWith("oma-ai-guest");
}

export function getRateLimitKey(c: Context<OmaEnv>, keyPrefix: string): string {
	const apiKey = c.get("apiKey");
	const userId = c.get("userId");

	if (apiKey) return `${keyPrefix}:${apiKey.id}`;
	if (userId && isCountableUserId(userId)) {
		return `${keyPrefix}:${userId}`;
	}
	const ip = extractClientIp(c);
	return `${keyPrefix}:ip:${ip}`;
}

/**
 * Per-USER identity tier for the layered limiter.
 *
 * SECURITY: keying only on `apiKeyId` meant a user could mint N keys and
 * multiply their effective rate limit N-fold — the per-key cap was the only
 * cap, so `POST /v1/keys` ten times made the limiter ten times weaker for one
 * account. This tier is checked in ADDITION to the per-key tier (see
 * `rateLimitKeyLayers`), so every API key shares one per-user budget while
 * each key keeps its own.
 *
 * Returns null for anonymous/guest traffic, which stays on the IP tier.
 */
export function getUserRateLimitKey(
	c: Context<OmaEnv>,
	keyPrefix: string,
): string | null {
	const userId = c.get("userId");
	if (!isCountableUserId(userId)) return null;
	return `${keyPrefix}:user:${userId}`;
}

/**
 * Read a context variable that is not declared on OmaEnv.
 *
 * `apiKeyId` is written by some auth paths but absent from the OmaEnv map, so
 * `c.get("apiKeyId")` does not typecheck. Both the typed (`apiKey`) and
 * untyped sources are consulted, exactly as the pre-existing key logic did.
 */
export function readApiKeyId(c: Context<OmaEnv>): string | undefined {
	// `get` is typed against OmaEnv's known keys; `apiKeyId` is written by
	// some auth paths but absent from that map, so read through `get` with an
	// untyped key rather than touching the internal `var` store.
	const get = c.get as unknown as (k: string) => unknown;
	return (
		(get.call(c, "apiKeyId") as string | undefined) ||
		(c.get("apiKey") as { id?: string } | undefined)?.id ||
		undefined
	);
}

/**
 * The independent rate-limit buckets a request must clear.
 *
 * Layers are additive, not alternatives:
 *   - per-user: one budget for the account, so N keys cannot buy N budgets
 *   - per-key:  per-credential budget, so one noisy key is isolated
 *   - per-IP:   always present, so unauthenticated traffic is bounded too
 *
 * The per-IP layer is deliberately UNCONDITIONAL. Dropping it for API-key
 * callers would mean a leaked key can be used from unlimited addresses, which
 * is the reason the layer exists at all.
 */
export function rateLimitKeyLayers(
	c: Context<OmaEnv>,
	keyPrefix: string,
): string[] {
	const layers: string[] = [];

	const userKey = getUserRateLimitKey(c, keyPrefix);
	if (userKey) layers.push(userKey);

	const apiKeyId = readApiKeyId(c);
	if (apiKeyId) layers.push(`${keyPrefix}:key:${apiKeyId}`);

	layers.push(`${keyPrefix}:ip:${extractClientIp(c)}`);

	// Dedupe defensively: a user whose key id equals their user id, or an
	// "unknown" IP shared with another layer, must not be charged twice
	// against one window or the effective limit halves.
	return [...new Set(layers)];
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetMs: number;
	limit: number;
	/**
	 * True when this result came from the per-process memory store rather
	 * than Redis, because the Redis script failed or was unavailable.
	 *
	 * Enforcement is still real, but the bound is per-instance rather than
	 * cluster-wide. Callers must surface this as
	 * `X-RateLimit-Policy: degraded-memory` instead of passing the result
	 * off as a normally-enforced limit.
	 */
	degraded?: boolean;
}

// Type wrapper for Redis eval results
export type RedisEvalResult = [number, number, number];
