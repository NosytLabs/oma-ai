import { config } from "../config.js";

const COINGECKO_OMA_ID = "oma-2";
const FALLBACK_PRICE_CENTS = 10;
const CACHE_TTL_MS = 60_000;
const TWAP_WINDOW_MS = 30 * 60_000;
const TWAP_SAMPLE_INTERVAL_MS = 60_000; // 1 sample per minute

let cachedPrice: number | null = null;
let cachedPriceChange24h: number | null = null;
let lastFetchTime = 0;
let liveFeedWorking = false;

// TWAP ring buffer
const twapSamples: { price: number; time: number }[] = [];
let twapLastSampleTime = 0;

async function fetchCoinGeckoPrice(): Promise<{ price: number; change24h: number } | null> {
  try {
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_OMA_ID}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) },
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as Record<string, { usd: number; usd_24h_change?: number }>;
    const entry = data[COINGECKO_OMA_ID];
    if (!entry || typeof entry.usd !== "number") return null;
    return { price: entry.usd, change24h: entry.usd_24h_change ?? 0 };
  } catch {
    return null;
  }
}

async function refreshPrice(): Promise<void> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL_MS && cachedPrice !== null) return;
  lastFetchTime = now;

  const coinGecko = await fetchCoinGeckoPrice();
  if (coinGecko) {
    cachedPrice = coinGecko.price;
    cachedPriceChange24h = coinGecko.change24h;
    liveFeedWorking = true;
    recordTwapSample(now, cachedPrice);
    return;
  }

  if (config.OMA_PRICE_OVERRIDE) {
    cachedPrice = config.OMA_PRICE_OVERRIDE;
    cachedPriceChange24h = 0;
    liveFeedWorking = false;
    console.warn(`[oracle] CoinGecko unreachable, using OMA_PRICE_OVERRIDE=${config.OMA_PRICE_OVERRIDE}`);
    recordTwapSample(now, cachedPrice);
    return;
  }

  cachedPrice = FALLBACK_PRICE_CENTS / 100;
  cachedPriceChange24h = 0;
  liveFeedWorking = false;
  console.warn(`[oracle] CoinGecko unreachable and no OMA_PRICE_OVERRIDE set, using fallback price $${(FALLBACK_PRICE_CENTS / 100).toFixed(2)}`);
  recordTwapSample(now, cachedPrice);
}

function recordTwapSample(now: number, price: number): void {
  if (now - twapLastSampleTime < TWAP_SAMPLE_INTERVAL_MS) return;
  twapLastSampleTime = now;
  twapSamples.push({ price, time: now });
  // Prune samples older than TWAP window
  const cutoff = now - TWAP_WINDOW_MS;
  while (twapSamples.length > 0 && twapSamples[0].time < cutoff) {
    twapSamples.shift();
  }
}

export function isOracleLive(): boolean {
  return liveFeedWorking || !!config.OMA_PRICE_OVERRIDE;
}

export async function getOmaUsdPrice(): Promise<number> {
  await refreshPrice();
  return cachedPrice ?? FALLBACK_PRICE_CENTS / 100;
}

export async function getOmaPriceChange24h(): Promise<number> {
  await refreshPrice();
  return cachedPriceChange24h ?? 0;
}

export async function getTwap30m(): Promise<number> {
  await refreshPrice();
  const now = Date.now();
  const cutoff = now - TWAP_WINDOW_MS;
  const windowed = twapSamples.filter((s) => s.time >= cutoff);
  if (windowed.length === 0) return cachedPrice ?? FALLBACK_PRICE_CENTS / 100;
  const sum = windowed.reduce((acc, s) => acc + s.price, 0);
  return sum / windowed.length;
}

export async function isOracleFresh(): Promise<boolean> {
  return isOracleLive();
}
