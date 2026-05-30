import type { Context } from "hono";
import type { OmaEnv } from "../../types.js";

const TRUSTED_PROXIES_ENV = process.env.TRUSTED_PROXY_IPS || "";
const TRUSTED_PROXIES: Set<string> = new Set(
  TRUSTED_PROXIES_ENV.split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0)
);

// Model-specific limits (requests per minute)
export const MODEL_LIMITS: Record<string, { rpm: number; tpm: number }> = {
  // Frontier/reasoning models - strict
  "claude-opus-4-7": { rpm: 30, tpm: 60000 },
  "gpt-5.5": { rpm: 30, tpm: 60000 },
  "o3": { rpm: 30, tpm: 60000 },
  "chainscout-guard-v1": { rpm: 30, tpm: 60000 },
  // Premium/standard models - moderate
  "deepseek-r1": { rpm: 60, tpm: 120000 },
  "deepseek-v3": { rpm: 60, tpm: 120000 },
  "claude-sonnet-4-6": { rpm: 60, tpm: 120000 },
  "claude-haiku-4-5": { rpm: 60, tpm: 120000 },
  "gpt-4o": { rpm: 60, tpm: 120000 },
  "gemini-3.5-flash": { rpm: 60, tpm: 120000 },
  "mistral-large": { rpm: 60, tpm: 120000 },
  "llama-3.3-70b": { rpm: 60, tpm: 120000 },
  "deepseek-v4-pro": { rpm: 60, tpm: 120000 },
  "qwen3-235b": { rpm: 60, tpm: 120000 },
  "qwen3-coder-480b": { rpm: 60, tpm: 120000 },
  "qwen3-72b": { rpm: 60, tpm: 120000 },
  "kimi-k2-5": { rpm: 60, tpm: 120000 },
  "command-r-plus": { rpm: 60, tpm: 120000 },
  "token-take-agent": { rpm: 60, tpm: 120000 },
  // Fast/budget models - higher limits
  "phi-4-mini": { rpm: 120, tpm: 240000 },
  "deepseek-v4-flash": { rpm: 120, tpm: 240000 },
  "phi-4": { rpm: 120, tpm: 240000 },
  "gemini-2.5-flash": { rpm: 120, tpm: 240000 },
  "grok-41-fast": { rpm: 120, tpm: 240000 },
  "gpt-4o-mini": { rpm: 120, tpm: 240000 },
  "qwen3-32b": { rpm: 120, tpm: 240000 },
  "qwen3-8b": { rpm: 120, tpm: 240000 },
  "deepseek-r1-8b": { rpm: 120, tpm: 240000 },
  "mistral-small-3.2": { rpm: 120, tpm: 240000 },
  "llama-3.1-8b": { rpm: 120, tpm: 240000 },
  "gemma-3-27b": { rpm: 120, tpm: 240000 },
  "gemma4-31b": { rpm: 120, tpm: 240000 },
  "qwen3-coder-30b": { rpm: 120, tpm: 240000 },
  "kimi-k2-6": { rpm: 120, tpm: 240000 },
  "glm-5.1": { rpm: 120, tpm: 240000 },
};

function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXIES.has(ip);
}

export function extractClientIp(c: Context<OmaEnv>): string {
  const xForwardedFor = c.req.header("x-forwarded-for");
  const xRealIp = c.req.header("x-real-ip");

  if (xForwardedFor && TRUSTED_PROXIES.size > 0) {
    const ips = xForwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) {
      const rightmostIp = ips[ips.length - 1];
      if (isTrustedProxy(rightmostIp)) {
        return rightmostIp;
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
