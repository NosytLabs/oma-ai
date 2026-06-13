import { getRedisClient } from "../lib/redis-client.js";

type Provider = "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra" | "surplus" | "morpheus";

interface ProviderResultRecord {
  provider: Provider;
  success: boolean;
  latencyMs: number;
  timestamp: number;
}

const resultBuffer: ProviderResultRecord[] = [];
const BUFFER_FLUSH_INTERVAL_MS = 5_000;
const REDIS_KEY_PREFIX = "provider:result:";

let flushInterval: ReturnType<typeof setInterval> | null = null;

async function flushResultBuffer(): Promise<void> {
  if (resultBuffer.length === 0) return;

  const records = resultBuffer.splice(0, resultBuffer.length);
  const redis = await getRedisClient();
  if (!redis) return;

  for (const record of records) {
    const key = `${REDIS_KEY_PREFIX}${record.provider}`;
    const existing = await redis.get(key);
    const data = existing ? JSON.parse(existing) : { totalRequests: 0, errorCount: 0, totalLatency: 0 };

    data.totalRequests += 1;
    if (!record.success) data.errorCount += 1;
    data.totalLatency += record.latencyMs;
    data.lastUpdated = Date.now();

    await redis.set(key, JSON.stringify(data), { EX: 3600 });
  }
}

export function initProviderResultReporter(): void {
  if (flushInterval) return;
  flushInterval = setInterval(flushResultBuffer, BUFFER_FLUSH_INTERVAL_MS);
}

export function stopProviderResultReporter(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}

export async function reportProviderResult(provider: Provider, success: boolean, latencyMs: number): Promise<void> {
  resultBuffer.push({ provider, success, latencyMs, timestamp: Date.now() });

  if (resultBuffer.length >= 100) {
    await flushResultBuffer();
  }
}