import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { getOmaPriceChange24h, isOracleFresh, getOmaUsdPrice, isOracleLive } from './oracle.js'

const PRICE_GUARD_KEY = "circuitbreaker:price-guard";

let cachedState: { omaBonusPercent: number; omaDepositsAllowed: boolean } | null = null;
let lastPersistedAt = 0;
const CACHE_TTL_MS = 5_000;

export function resetCircuitBreakerCache(): void {
  cachedState = null;
  lastPersistedAt = 0;
}

export async function getCircuitBreakerState(): Promise<{ omaBonusPercent: number; omaDepositsAllowed: boolean }> {
  if (cachedState && lastPersistedAt > 0 && Date.now() - lastPersistedAt < CACHE_TTL_MS) {
    return cachedState;
  }

  const redis = await getRedisClient();
  if (redis && isRedisReady()) {
    const data = await redis.hGetAll(PRICE_GUARD_KEY);
    if (data && Object.keys(data).length > 0) {
      const parsedBonus = parseInt(data.omaBonusPercent, 10);
      cachedState = {
        omaBonusPercent: !isNaN(parsedBonus) && parsedBonus >= 0 ? parsedBonus : 5,
        omaDepositsAllowed: data.omaDepositsAllowed === "true",
      };
      lastPersistedAt = Date.now();
      return cachedState;
    }
  }

  cachedState = { omaBonusPercent: 5, omaDepositsAllowed: true };
  return cachedState;
}

async function persistState(omaBonusPercent: number, omaDepositsAllowed: boolean): Promise<void> {
  cachedState = { omaBonusPercent, omaDepositsAllowed };
  lastPersistedAt = Date.now();

  const redis = await getRedisClient();
  if (redis && isRedisReady()) {
    await redis.hSet(PRICE_GUARD_KEY, {
      omaBonusPercent: String(omaBonusPercent),
      omaDepositsAllowed: String(omaDepositsAllowed),
      lastUpdated: String(Date.now()),
    });
  }
}

export async function checkCircuitBreaker(): Promise<{ omaBonusPercent: number; omaDepositsAllowed: boolean; reason?: string }> {
  if (!isOracleLive()) {
    const result = { omaBonusPercent: 0, omaDepositsAllowed: false, reason: 'Oracle not live - OMA deposits disabled' };
    await persistState(0, false);
    return result;
  }

  const change24h = await getOmaPriceChange24h();

  if (change24h <= -50) {
    const result = { omaBonusPercent: 0, omaDepositsAllowed: false, reason: 'OMA price dropped >50% in 24h - deposits halted' };
    await persistState(0, false);
    return result;
  }
  if (change24h <= -35) {
    const result = { omaBonusPercent: 0, omaDepositsAllowed: true, reason: 'OMA price dropped >35% in 24h - bonus suspended' };
    await persistState(0, true);
    return result;
  }
  if (change24h <= -20) {
    const result = { omaBonusPercent: 2, omaDepositsAllowed: true, reason: 'OMA price dropped >20% in 24h - bonus reduced' };
    await persistState(2, true);
    return result;
  }
  const result = { omaBonusPercent: 5, omaDepositsAllowed: true };
  await persistState(5, true);
  return result;
}

export async function checkOracleCircuitBreaker(): Promise<boolean> {
  const fresh = await isOracleFresh();
  if (!fresh) return true;

  const spot = await getOmaUsdPrice();
  if (spot === 0) return true;

  return false;
}