import type { Context } from "hono";
import type { OmaEnv } from "../../types.js";
import { logger } from "../../lib/logger.js";

const TRUSTED_PROXIES_ENV = process.env.TRUSTED_PROXY_IPS || "";
const TRUSTED_PROXIES: Set<string> = new Set(
  TRUSTED_PROXIES_ENV.split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0)
);

// C3: Production warning when no trusted proxies are configured
if (TRUSTED_PROXIES.size === 0 && process.env.NODE_ENV === "production") {
  logger.warn("[SECURITY] TRUSTED_PROXY_IPS is empty in production. Rate limiting by IP may be bypassed via x-forwarded-for spoofing. Set TRUSTED_PROXY_IPS to your reverse proxy IPs.");
}

// Model-specific limits (requests per minute). Keys must match a real Venice
// model ID — only entries that survive the live Venice catalog audit are kept.
// `getModelLimits()` is called per-model; any ID not listed here falls through
// to the default limits in the rate-limit middleware.
export const MODEL_LIMITS: Record<string, { rpm: number; tpm: number }> = {
  "deepseek-v3.2": { rpm: 60, tpm: 120000 },
  "llama-3.3-70b": { rpm: 60, tpm: 120000 },
  "llama-3.2-3b": { rpm: 120, tpm: 240000 },
};

function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXIES.has(ip);
}

export function extractClientIp(c: Context<OmaEnv>): string {
  const xRealIp = c.req.header("x-real-ip");

  // ponytail: H2 — when TRUSTED_PROXY_IPS is empty (the production-safe
  // default), REFUSE to read x-forwarded-for entirely. Without this guard,
  // an attacker sends 1000 requests with `x-forwarded-for: <random>` and
  // bypasses the IP-based rate-limit bucket (each request lands in a
  // different bucket). Operators who deploy behind a reverse proxy MUST set
  // TRUSTED_PROXY_IPS to the proxy's egress IPs to enable header parsing.
  if (TRUSTED_PROXIES.size === 0) {
    return xRealIp || "unknown";
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
      // Last IP is not a trusted proxy — fall through to x-real-ip.
    }
  }

  return xRealIp || "unknown";
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

export function getRateLimitKey(c: Context<OmaEnv>, keyPrefix: string): string {
  const apiKey = c.get("apiKey");
  const userId = c.get("userId");
  
  if (apiKey) return `${keyPrefix}:${apiKey.id}`;
  if (userId) return `${keyPrefix}:${userId}`;
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
