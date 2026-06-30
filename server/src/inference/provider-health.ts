import { db } from "../db/client.js";
import { providerHealth } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { healthCheck } from "./provider-factory.js";
import { surplusHealthCheck } from "./surplus.js";

const FAILURE_THRESHOLD = 5;
const RECOVERY_TIMEOUT_MS = 60_000;

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

type Provider = "venice" | "surplus";

interface HealthRecord {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureAt: number | null;
  isUp: boolean;
  latencyMs: number;
  errorRate: number;
  totalRequests: number;
  errorCount: number;
  cooldownUntil: number | null;
  lastUpdated: number;
}

const healthCache = new Map<string, HealthRecord>();

// SEC-9: per-provider async mutex. Concurrent reportProviderResult() calls
// for the same provider would otherwise race on the read-modify-write of
// `consecutiveFailures`, `totalRequests`, `errorCount`, and the OPEN
// transition, losing updates under load. Each provider has its own promise
// chain so they don't block each other.
const providerLocks = new Map<string, Promise<unknown>>();

async function withProviderLock<T>(provider: Provider, fn: () => Promise<T> | T): Promise<T> {
  const prev = providerLocks.get(provider) ?? Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.then(() => next);
  providerLocks.set(provider, chained);
  try {
    await prev;
    return await fn();
  } finally {
    release();
    // Best-effort cleanup so the map doesn't grow unbounded for short-lived
    // provider strings. The next call for the same provider rebuilds the
    // chain.
    if (providerLocks.get(provider) === chained) {
      providerLocks.delete(provider);
    }
  }
}

const CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const STALE_CACHE_THRESHOLD_MS = 30 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
let cacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

function cleanupStaleCacheEntries(): void {
  const now = Date.now();
  const staleKeys: string[] = [];
  
  for (const [provider, record] of healthCache.entries()) {
    if (now - record.lastUpdated > STALE_CACHE_THRESHOLD_MS) {
      staleKeys.push(provider);
    }
  }
  
  for (const key of staleKeys) {
    healthCache.delete(key);
  }
  
  if (healthCache.size > MAX_CACHE_SIZE) {
    const entries = [...healthCache.entries()].sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
    const toRemove = healthCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      healthCache.delete(entries[i][0]);
    }
  }
}

export function startCacheCleanup(): void {
  if (cacheCleanupInterval) return;
  cleanupStaleCacheEntries();
  cacheCleanupInterval = setInterval(cleanupStaleCacheEntries, CACHE_CLEANUP_INTERVAL_MS);
}

export function stopCacheCleanup(): void {
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
    cacheCleanupInterval = null;
  }
}

const lastTrafficAt = new Map<Provider, number>();
const PROBE_INTERVAL_MS = 45_000;
const IDLE_THRESHOLD_MS = 60_000;

const ALL_PROVIDERS: Provider[] = ["venice", "surplus"];

async function createInitialRecord(provider: Provider): Promise<HealthRecord> {
  const record: HealthRecord = {
    state: CircuitState.CLOSED,
    consecutiveFailures: 0,
    lastFailureAt: null,
    isUp: true,
    latencyMs: 0,
    errorRate: 0,
    totalRequests: 0,
    errorCount: 0,
    cooldownUntil: null,
    lastUpdated: Date.now(),
  };
  healthCache.set(provider, record);

  await db.insert(providerHealth).values({ provider, isUp: true, latencyMs: 0, errorRate: "0" });

  const redis = await getRedisClient();
  if (redis && isRedisReady()) {
    await redis.hSet(`provider:health:${provider}`, {
      state: CircuitState.CLOSED,
      consecutiveFailures: "0",
      lastFailureAt: "",
      isUp: "true",
      latencyMs: "0",
      errorRate: "0",
      totalRequests: "0",
      errorCount: "0",
      cooldownUntil: "",
    });
  }
  return record;
}

async function ensureProviderRecord(provider: Provider): Promise<void> {
  const existing = healthCache.get(provider);
  if (existing && Date.now() - existing.lastUpdated < 5_000) return;

  const redis = await getRedisClient();
  if (redis && isRedisReady()) {
    const data = await redis.hGetAll(`provider:health:${provider}`);
    if (Object.keys(data).length > 0) {
      healthCache.set(provider, {
        state: (data.state as CircuitState) || CircuitState.CLOSED,
        consecutiveFailures: parseInt(data.consecutiveFailures, 10) || 0,
        lastFailureAt: data.lastFailureAt ? parseInt(data.lastFailureAt, 10) : null,
        isUp: data.isUp === "true",
        latencyMs: parseInt(data.latencyMs, 10) || 0,
        errorRate: parseFloat(data.errorRate) || 0,
        totalRequests: parseInt(data.totalRequests, 10) || 0,
        errorCount: parseInt(data.errorCount, 10) || 0,
        cooldownUntil: data.cooldownUntil ? parseInt(data.cooldownUntil, 10) : null,
        lastUpdated: Date.now(),
      });
      return;
    }
  }

  const rows = await db.select().from(providerHealth).where(eq(providerHealth.provider, provider)).limit(1);

  if (rows.length > 0) {
    const row = rows[0];
    const record: HealthRecord = {
      state: CircuitState.CLOSED,
      consecutiveFailures: 0,
      lastFailureAt: null,
      isUp: row.isUp ?? true,
      latencyMs: row.latencyMs ?? 0,
      errorRate: Number(row.errorRate) || 0,
      totalRequests: 0,
      errorCount: 0,
      cooldownUntil: (() => {
        const val = row.cooldownUntil as Date | null;
        if (val === null) return null;
        return new Date(val).getTime();
      })(),
      lastUpdated: Date.now(),
    };
    healthCache.set(provider, record);

    if (redis && isRedisReady()) {
      await redis.hSet(`provider:health:${provider}`, {
        state: record.state,
        consecutiveFailures: String(record.consecutiveFailures),
        lastFailureAt: record.lastFailureAt ? String(record.lastFailureAt) : "",
        isUp: String(record.isUp),
        latencyMs: String(record.latencyMs),
        errorRate: String(record.errorRate),
        totalRequests: String(record.totalRequests),
        errorCount: String(record.errorCount),
        cooldownUntil: record.cooldownUntil ? String(record.cooldownUntil) : "",
      });
    }
    return;
  }

  await createInitialRecord(provider);
}

export async function checkProviderHealth(provider: Provider): Promise<{
  isUp: boolean;
  latencyMs: number;
  errorRate: number;
  state: CircuitState;
  consecutiveFailures: number;
  totalRequests: number;
  errorCount: number;
  cooldownUntil?: number;
}> {
  await ensureProviderRecord(provider);
  const h = healthCache.get(provider)!;
  return {
    isUp: h.isUp,
    latencyMs: h.latencyMs,
    errorRate: h.errorRate,
    state: h.state,
    consecutiveFailures: h.consecutiveFailures,
    totalRequests: h.totalRequests,
    errorCount: h.errorCount,
    ...(h.cooldownUntil ? { cooldownUntil: h.cooldownUntil } : {}),
  };
}

export async function reportProviderResult(provider: Provider, success: boolean, latencyMs: number): Promise<void> {
  return withProviderLock(provider, async () => {
    await ensureProviderRecord(provider);
    const h = healthCache.get(provider)!;

    h.totalRequests += 1;
    if (!success) h.errorCount += 1;
    h.errorRate = h.totalRequests > 0 ? h.errorCount / h.totalRequests : 0;
    h.latencyMs = h.totalRequests === 1 ? latencyMs : Math.round((h.latencyMs * (h.totalRequests - 1) + latencyMs) / h.totalRequests);

    if (h.state === CircuitState.HALF_OPEN) {
      if (success) {
        h.state = CircuitState.CLOSED;
        h.consecutiveFailures = 0;
        h.lastFailureAt = null;
        h.isUp = true;
      } else {
        h.state = CircuitState.OPEN;
        h.cooldownUntil = Date.now() + RECOVERY_TIMEOUT_MS;
        // Keep counting the failure streak so a long-running outage
        // produces accurate `consecutiveFailures` for monitoring.
        h.consecutiveFailures += 1;
        h.lastFailureAt = Date.now();
      }
    } else if (h.state === CircuitState.CLOSED) {
      if (success) {
        h.consecutiveFailures = 0;
        h.isUp = true;
      } else {
        h.consecutiveFailures += 1;
        h.lastFailureAt = Date.now();
        if (h.consecutiveFailures >= FAILURE_THRESHOLD) {
          h.state = CircuitState.OPEN;
          h.cooldownUntil = Date.now() + RECOVERY_TIMEOUT_MS;
          h.isUp = false;
        }
      }
    } else if (h.state === CircuitState.OPEN) {
      // SEC-9: keep counting the failure streak even after the circuit
      // trips OPEN so a long-running outage produces a faithful
      // `consecutiveFailures` counter for monitoring. The OPEN → HALF_OPEN
      // transition is driven by `cooldownUntil` in isProviderAvailable.
      if (!success) {
        h.consecutiveFailures += 1;
        h.lastFailureAt = Date.now();
        h.isUp = false;
      } else {
        h.consecutiveFailures = 0;
      }
    }

    h.lastUpdated = Date.now();

    const redis = await getRedisClient();
    if (redis && isRedisReady()) {
      await redis.hSet(`provider:health:${provider}`, {
        state: h.state,
        consecutiveFailures: String(h.consecutiveFailures),
        lastFailureAt: h.lastFailureAt ? String(h.lastFailureAt) : "",
        isUp: String(h.isUp),
        latencyMs: String(h.latencyMs),
        errorRate: String(h.errorRate),
        totalRequests: String(h.totalRequests),
        errorCount: String(h.errorCount),
        cooldownUntil: h.cooldownUntil ? String(h.cooldownUntil) : "",
        lastDbSyncAt: String(Date.now()),
      });

      await redis.setEx(`provider:health:pending_sync:${provider}`, 60, String(Date.now()));
    }
  });
}

const DB_SYNC_INTERVAL_MS = 30_000;
let dbSyncInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundDbSync(intervalMs: number = DB_SYNC_INTERVAL_MS): void {
  if (dbSyncInterval) return;
  dbSyncInterval = setInterval(syncProviderHealthToDb, intervalMs);
}

export function stopBackgroundDbSync(): void {
  if (dbSyncInterval) {
    clearInterval(dbSyncInterval);
    dbSyncInterval = null;
  }
}

async function syncProviderHealthToDb(): Promise<void> {
  for (const provider of ALL_PROVIDERS) {
    const redis = await getRedisClient();
    if (!redis || !isRedisReady()) break;

    const pendingSync = await redis.get(`provider:health:pending_sync:${provider}`);
    if (!pendingSync) continue;

    const data = await redis.hGetAll(`provider:health:${provider}`);
    if (Object.keys(data).length === 0) continue;

    try {
      await db.update(providerHealth).set({
        isUp: data.isUp === "true",
        latencyMs: parseInt(data.latencyMs, 10) || 0,
        errorRate: String(parseFloat(data.errorRate).toFixed(4)) || "0",
        cooldownUntil: data.cooldownUntil ? new Date(parseInt(data.cooldownUntil, 10)) : null,
        lastCheckAt: new Date(parseInt(data.lastDbSyncAt, 10) || Date.now()),
      }).where(eq(providerHealth.provider, provider));

      await redis.del(`provider:health:pending_sync:${provider}`);
    } catch {
      // Sync failure is non-critical
    }
  }
}

export async function isProviderAvailable(provider: Provider): Promise<boolean> {
  await ensureProviderRecord(provider);
  const h = healthCache.get(provider)!;

  if (h.state === CircuitState.OPEN) {
    if (h.cooldownUntil && Date.now() >= h.cooldownUntil) {
      h.state = CircuitState.HALF_OPEN;
      h.cooldownUntil = null;
      return true;
    }
    return false;
  }

  if (h.state === CircuitState.HALF_OPEN) {
    return true;
  }

  if (!h.isUp) return false;
  return true;
}

export function recordTraffic(provider: Provider): void {
  lastTrafficAt.set(provider, Date.now());
}

async function probeIdleProviders(): Promise<void> {
  const now = Date.now();
  for (const provider of ALL_PROVIDERS) {
    const lastTraffic = lastTrafficAt.get(provider) ?? 0;
    if (now - lastTraffic < IDLE_THRESHOLD_MS) continue;
    let isUp: boolean;
    let latencyMs: number;
    if (provider === "surplus") {
      const result = await surplusHealthCheck();
      isUp = result.isUp;
      latencyMs = result.latencyMs ?? 0;
    } else {
      const result = await healthCheck(provider, getProviderBaseUrl(provider), getProviderHealthPath(provider));
      isUp = result.isUp;
      latencyMs = result.latencyMs;
    }
    await reportProviderResult(provider, isUp, latencyMs);
  }
}

function getProviderBaseUrl(provider: Provider): string {
  const baseUrls: Record<Provider, string> = {
    venice: "https://api.venice.ai",
    surplus: "https://api.surplusintelligence.ai",
  };
  return baseUrls[provider];
}

function getProviderHealthPath(provider: Provider): string {
  switch (provider) {
    case "surplus":
      return "/api/inference/v1/models";
    default:
      return "/v1/models";
  }
}

let probeInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundProbing(intervalMs: number = PROBE_INTERVAL_MS): void {
  if (probeInterval) return;
  probeInterval = setInterval(probeIdleProviders, intervalMs);
}

export function stopBackgroundProbing(): void {
  if (probeInterval) {
    clearInterval(probeInterval);
    probeInterval = null;
  }
}

export { CircuitState };
