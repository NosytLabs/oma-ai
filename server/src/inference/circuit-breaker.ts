import { getRedisClient } from "../lib/redis-client.js";

const ERROR_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30_000;
const REDIS_TTL_SECONDS = Math.ceil(RESET_TIMEOUT_MS / 1000);

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
  consecutiveSuccesses?: number;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

export function getCircuitBreakerKey(provider: string, model?: string): string {
  return model ? `${provider}:${model}` : provider;
}

function getRedisCircuitKey(provider: string, model?: string): string {
  return `circuit:provider:${provider}:model:${model || "default"}`;
}

async function getRedisState(key: string): Promise<CircuitBreakerState | null> {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as CircuitBreakerState;
  } catch {
    return null;
  }
}

async function setRedisState(key: string, state: CircuitBreakerState): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.setEx(key, REDIS_TTL_SECONDS, JSON.stringify(state));
  } catch {
    // Redis unavailable, in-memory fallback handles it
  }
}

export async function recordProviderError(provider: string, model?: string): Promise<void> {
  const key = getCircuitBreakerKey(provider, model);
  const redisKey = getRedisCircuitKey(provider, model);

  const newState: CircuitBreakerState = (() => {
    const existing = circuitBreakers.get(key);
    const failures = (existing?.failures ?? 0) + 1;
    const state: CircuitBreakerState = {
      failures,
      lastFailure: Date.now(),
      state: failures >= ERROR_THRESHOLD ? "open" : (existing?.state ?? "closed"),
    };
    return state;
  })();

  circuitBreakers.set(key, newState);
  await setRedisState(redisKey, newState);
}

export async function recordProviderSuccess(provider: string, model?: string): Promise<void> {
  const key = getCircuitBreakerKey(provider, model);
  const redisKey = getRedisCircuitKey(provider, model);
  const state = circuitBreakers.get(key);

  if (!state) return;

  if (state.state === "half-open") {
    state.consecutiveSuccesses = (state.consecutiveSuccesses || 0) + 1;
    if (state.consecutiveSuccesses >= 3) {
      state.state = "closed";
      state.failures = 0;
      state.consecutiveSuccesses = 0;
    }
  } else {
    state.failures = Math.max(0, state.failures - 1);
  }

  await setRedisState(redisKey, state);
}

export async function isCircuitOpen(provider: string, model?: string): Promise<boolean> {
  const key = getCircuitBreakerKey(provider, model);
  const redisKey = getRedisCircuitKey(provider, model);

  let state = circuitBreakers.get(key);

  if (!state) {
    const redisState = await getRedisState(redisKey);
    if (redisState) {
      state = redisState;
      circuitBreakers.set(key, state);
    }
  }

  if (!state || state.state === "closed") return false;

  if (state.state === "open") {
    if (Date.now() - state.lastFailure > RESET_TIMEOUT_MS) {
      state.state = "half-open";
      state.consecutiveSuccesses = 0;
      await setRedisState(redisKey, state);
      return false;
    }
    return true;
  }

  return false;
}
