import type { Context } from "hono";
import type { OmaEnv } from "../../types.js";

const TRUSTED_PROXIES_ENV = process.env.TRUSTED_PROXY_IPS || "";
const TRUSTED_PROXIES: Set<string> = new Set(
  TRUSTED_PROXIES_ENV.split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0)
);

// Model-specific limits (requests per minute). Keys must match a real Venice
// model ID — only entries that survive the live Venice catalog audit are kept.
// `getModelLimits()` is called per-model; any ID not listed here falls through
// to the default limits in the rate-limit middleware.
export const MODEL_LIMITS: Record<string, { rpm: number; tpm: number }> = {
  "claude-opus-4-7": { rpm: 30, tpm: 60000 },
  "deepseek-v4-pro": { rpm: 60, tpm: 120000 },
  "claude-sonnet-4-6": { rpm: 60, tpm: 120000 },
  "llama-3.3-70b": { rpm: 60, tpm: 120000 },
  "kimi-k2-5": { rpm: 60, tpm: 120000 },
  "deepseek-v4-flash": { rpm: 120, tpm: 240000 },
  "kimi-k2-6": { rpm: 120, tpm: 240000 },
};

function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXIES.has(ip);
}

export function extractClientIp(c: Context<OmaEnv>): string {
  const xForwardedFor = c.req.header("x-forwarded-for");
  const xRealIp = c.req.header("x-real-ip");

  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) {
      const firstIp = ips[0];

      if (TRUSTED_PROXIES.size > 0) {
        // SECURITY: When trusted proxies are configured, only trust the first
        // IP if the LAST IP in the chain is one of our trusted proxies.
        // Otherwise the header is potentially client-spoofed.
        const lastIp = ips[ips.length - 1];
        if (isTrustedProxy(lastIp)) {
          return firstIp;
        }
        // Last IP is not a trusted proxy — fall through to x-real-ip.
      } else {
        // No trusted proxies configured — treat the request as a direct
        // connection and take the first IP from x-forwarded-for as the client.
        // This is required for the IP allowlist (G3) to function in dev/test.
        return firstIp;
      }
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
