import { db } from "../db/client.js";
import { providerHealth } from "../db/schema.js";
import { eq } from "drizzle-orm";

const COOLDOWN_MS = 10 * 60 * 1000;
const ERROR_RATE_THRESHOLD = 0.05;

const healthCache = new Map<string, {
  isUp: boolean;
  latencyMs: number;
  errorRate: number;
  totalRequests: number;
  errorCount: number;
  cooldownUntil: number | null;
  lastUpdated: number;
}>();

async function ensureProviderRecord(provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra"): Promise<void> {
  const existing = healthCache.get(provider);
  if (existing && Date.now() - existing.lastUpdated < 30_000) return;

  const rows = await db.select().from(providerHealth).where(eq(providerHealth.provider, provider)).limit(1);

  if (rows.length > 0) {
    const row = rows[0];
    healthCache.set(provider, {
      isUp: row.isUp ?? true,
      latencyMs: row.latencyMs ?? 0,
      errorRate: Number(row.errorRate) || 0,
      totalRequests: 0,
      errorCount: 0,
      cooldownUntil: (() => {
        const val = row.cooldownUntil as Date | null;
        if (val === null) {
          return null;
        }
        return new Date(val).getTime();
      })(),
      lastUpdated: Date.now(),
    });
    return;
  }

  await db.insert(providerHealth).values({ provider, isUp: true, latencyMs: 0, errorRate: "0" });
  healthCache.set(provider, {
    isUp: true, latencyMs: 0, errorRate: 0, totalRequests: 0, errorCount: 0, cooldownUntil: null, lastUpdated: Date.now(),
  });
}

export async function checkProviderHealth(provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra"): Promise<{
  isUp: boolean;
  latencyMs: number;
  errorRate: number;
  cooldownUntil?: number;
}> {
  await ensureProviderRecord(provider);
  const h = healthCache.get(provider)!;
  return {
    isUp: h.isUp,
    latencyMs: h.latencyMs,
    errorRate: h.errorRate,
    ...(h.cooldownUntil ? { cooldownUntil: h.cooldownUntil } : {}),
  };
}

export async function reportProviderResult(provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra", success: boolean, latencyMs: number): Promise<void> {
  await ensureProviderRecord(provider);
  const h = healthCache.get(provider)!;

  h.totalRequests += 1;
  if (!success) h.errorCount += 1;
  h.errorRate = h.totalRequests > 0 ? h.errorCount / h.totalRequests : 0;
  h.latencyMs = h.totalRequests === 1 ? latencyMs : Math.round((h.latencyMs * (h.totalRequests - 1) + latencyMs) / h.totalRequests);

  if (h.errorRate > ERROR_RATE_THRESHOLD && h.totalRequests >= 5) {
    h.cooldownUntil = Date.now() + COOLDOWN_MS;
    h.isUp = false;
  } else if (success) {
    h.isUp = true;
    if (h.cooldownUntil && Date.now() > h.cooldownUntil) h.cooldownUntil = null;
  }

  h.lastUpdated = Date.now();

  await db.update(providerHealth).set({
    isUp: h.isUp,
    latencyMs: h.latencyMs,
    errorRate: h.errorRate.toFixed(4),
    cooldownUntil: h.cooldownUntil ? new Date(h.cooldownUntil) : null,
    lastCheckAt: new Date(),
  }).where(eq(providerHealth.provider, provider));
}

export async function isProviderAvailable(provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra"): Promise<boolean> {
  await ensureProviderRecord(provider);
  const h = healthCache.get(provider)!;
  if (!h.isUp) return false;
  if (h.cooldownUntil && Date.now() < h.cooldownUntil) return false;
  return true;
}
