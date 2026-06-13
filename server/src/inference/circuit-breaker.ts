import { getRedisClient } from "../lib/redis-client.js";

const ERROR_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30_000;
const MAX_RESET_TIMEOUT_MS = 300_000;
const HALF_OPEN_SUCCESS_THRESHOLD = 3;
const REDIS_TTL_SECONDS = Math.ceil(MAX_RESET_TIMEOUT_MS / 1000);

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
  consecutiveSuccesses?: number;
  consecutiveFailures?: number;
  lastStateChange: number;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

export function getCircuitBreakerKey(provider: string, model?: string): string {
  return model ? `${provider}:${model}` : provider;
}

function getRedisCircuitKey(provider: string, model?: string): string {
  return `circuit:provider:${provider}:model:${model || "default"}`;
}

// Backoff is a fixed window after the last failure. Exponential growth would
// create a paradox: the longer a provider is down, the longer the backoff —
// the circuit would never close. We instead re-check on a flat interval so
// half-open probes have a chance to recover.
function calculateBackoffMs(_lastFailure: number): number {
  return RESET_TIMEOUT_MS;
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
    // Redis unavailable - in-memory circuit breaker state is sufficient fallback
  }
}

export async function recordProviderError(provider: string, model?: string): Promise<void> {
  const key = getCircuitBreakerKey(provider, model);
  const redisKey = getRedisCircuitKey(provider, model);

  const newState: CircuitBreakerState = (() => {
    const existing = circuitBreakers.get(key);
    const failures = (existing?.failures ?? 0) + 1;
    const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;
    const now = Date.now();
    
    let state: "closed" | "open" | "half-open" = existing?.state ?? "closed";
    
    if (state === "half-open") {
      if (consecutiveFailures >= HALF_OPEN_SUCCESS_THRESHOLD) {
        state = "open";
      }
    } else if (failures >= ERROR_THRESHOLD) {
      state = "open";
    }
    
    return {
      failures,
      lastFailure: now,
      state,
      consecutiveFailures: state === "half-open" ? consecutiveFailures : 0,
      lastStateChange: state !== existing?.state ? now : (existing?.lastStateChange ?? now),
    };
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
    const consecutiveSuccesses = (state.consecutiveSuccesses || 0) + 1;
    if (consecutiveSuccesses >= HALF_OPEN_SUCCESS_THRESHOLD) {
      state.state = "closed";
      state.failures = 0;
      state.consecutiveSuccesses = 0;
      state.consecutiveFailures = 0;
      state.lastStateChange = Date.now();
    } else {
      state.consecutiveSuccesses = consecutiveSuccesses;
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
    const backoffMs = calculateBackoffMs(state.lastFailure);
    if (Date.now() - state.lastFailure >= backoffMs) {
      state.state = "half-open";
      state.consecutiveSuccesses = 0;
      state.consecutiveFailures = 0;
      state.lastStateChange = Date.now();
      await setRedisState(redisKey, state);
      return false;
    }
    return true;
  }

  return false;
}
