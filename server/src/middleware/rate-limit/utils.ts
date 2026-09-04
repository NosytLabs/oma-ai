import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { OmaEnv } from "../../types.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";

const TRUSTED_PROXIES_ENV = config.TRUSTED_PROXY_IPS || "";
const TRUSTED_PROXIES: Set<string> = new Set(
		TRUSTED_PROXIES_ENV.split(",")
				.map((ip) => ip.trim())
				.filter((ip) => ip.length > 0)
);

// C3: Production warning when no trusted proxies are configured
if (TRUSTED_PROXIES.size === 0 && config.NODE_ENV === "production") {
		logger.warn("[SECURITY] TRUSTED_PROXY_IPS is empty in production. Rate limiting by IP may be bypassed via x-forwarded-for spoofing. Set TRUSTED_PROXY_IPS to your reverse proxy IPs.");
}

// Model-specific limits (requests per minute). Keys must match a real
// catalog id (server/src/inference/models.ts) — only entries that survive
// the catalog audit are kept. `getModelLimits()` is called per-model; any
// ID not listed here falls through to the default limits in the
// rate-limit middleware.
export const MODEL_LIMITS: Record<string, { rpm: number; tpm: number }> = {
		// Curated catalog (standard tier)
		"llama-3.3-70b": { rpm: 60, tpm: 120000 },
		"deepseek-v4-flash-openbroker": { rpm: 60, tpm: 120000 },
		"kimi-k3": { rpm: 60, tpm: 120000 },
		// Legacy/fast row (not always public; keep for override tests)
		"llama-3.2-3b": { rpm: 120, tpm: 240000 },
};

function isTrustedProxy(ip: string): boolean {
		return TRUSTED_PROXIES.has(ip);
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
				if (typeof addr === "string" && addr.length > 0) {
						// Strip IPv6-mapped IPv4 prefix so redis keys stay stable.
						return addr.startsWith("::ffff:") ? addr.slice(7) : addr;
				}
		} catch {
				/* not a Node request (app.request in tests, edge, etc.) */
		}
		return null;
}

export function extractClientIp(c: Context<OmaEnv>): string {
		const xRealIp = c.req.header("x-real-ip");

		// H2 — when TRUSTED_PROXY_IPS is empty (the production-safe
		// default), REFUSE to read x-forwarded-for entirely. Without this guard,
		// an attacker sends 1000 requests with `x-forwarded-for: <random>` and
		// bypasses the IP-based rate-limit bucket (each request lands in a
		// different bucket). Operators who deploy behind a reverse proxy MUST set
		// TRUSTED_PROXY_IPS to the proxy's egress IPs to enable header parsing.
		if (TRUSTED_PROXIES.size === 0) {
				// Prefer proxy-set x-real-ip, then the real TCP peer, then "unknown".
				// Collapsing all direct traffic to "unknown" made every guest share one
				// free-tier daily bucket (local dev + any direct-to-Node deploy).
				return xRealIp || socketRemoteAddress(c) || "unknown";
		}

		const xForwardedFor = c.req.header("x-forwarded-for");
		if (xForwardedFor) {
				const ips = xForwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
				if (ips.length > 0) {
						const firstIp = ips[0];
						const lastIp = ips[ips.length - 1];
						// SECURITY: When trusted proxies are configured, only trust the first
						// IP if the LAST IP in the chain is one of our trusted proxies.
						// Otherwise the header is potentially client-spoofed.
						if (isTrustedProxy(lastIp)) {
								return firstIp;
						}
						// Last IP is not a trusted proxy — fall through to x-real-ip / socket.
				}
		}

		return xRealIp || socketRemoteAddress(c) || "unknown";
}

// Helper to get client IP from proxy headers safely
// X-Forwarded-For format: client, proxy1, proxy2, ...
// We take the FIRST (leftmost) IP as it should be the original client
// Subsequent IPs are added by proxies and cannot be trusted if any proxy is compromised
export function getRightmostIp(xForwardedFor: string | undefined): string {
		if (!xForwardedFor) return "unknown";
		const ips = xForwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
		return ips.length > 0 ? ips[0] : "unknown";
}

// Get model-based rate limits
export function getModelLimits(model: string): { rpm: number; tpm: number } | null {
		return MODEL_LIMITS[model.toLowerCase()] ?? null;
}

/** Synthetic guests must rate-limit by IP — a shared userId would let one
	*  noisy client exhaust free chat/search for everyone. */
const SYNTHETIC_GUEST_IDS = new Set([
		"oma-ai-guest",
		"x402-guest",
]);

export function getRateLimitKey(c: Context<OmaEnv>, keyPrefix: string): string {
		const apiKey = c.get("apiKey");
		const userId = c.get("userId");

		if (apiKey) return `${keyPrefix}:${apiKey.id}`;
		if (userId && !SYNTHETIC_GUEST_IDS.has(userId) && !userId.startsWith("oma-ai-guest")) {
				return `${keyPrefix}:${userId}`;
		}
		const ip = extractClientIp(c);
		return `${keyPrefix}:ip:${ip}`;
}

export interface RateLimitResult {
		allowed: boolean;
		remaining: number;
		resetMs: number;
		limit: number;
}

// Type wrapper for Redis eval results
export type RedisEvalResult = [number, number, number];
