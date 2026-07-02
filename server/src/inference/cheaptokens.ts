import { createWalletClient, http, parseUnits, encodeFunctionData, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import { USDC_BASE } from "../constants.js";
import { logger } from "../lib/logger.js";

const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// Real CheapTokens.ai /api/pricing response shape (cheaptokens.ai/llms.txt).
// Earlier code used a different (incorrect) shape: { active, discountPriceCents,
// standardPriceCents } which did not match the live response. The refresh
// loop silently fell through to "no discount" because the real keys are
// `discountPercent` / `standardPrice` / `finalDiscount`.
interface PricingResponse {
  discountPercent: number;
  creditsPerDollar: number;
  standardPrice?: number;
  finalDiscount?: number;
  tier?: string;
  // Be permissive: live API has returned additional fields in the past.
  [k: string]: unknown;
}

interface SupplyResponse {
  availableKeys?: number;
  total?: number;
  sold?: number;
  remaining?: number;
  percent?: number;
  [k: string]: unknown;
}

interface BuyResponse {
  veniceApiKey: string;
  expiresAt?: number; // optional in some response variants
  // Be permissive.
  [k: string]: unknown;
}

// H6: per-day USDC spend counter. Resets at midnight UTC. This is
// intentionally in-process (no Redis) because (a) CheapTokens auto-
// buy is a single-process loop on a single server, and (b) the
// fallback when the cap is hit is "no auto-buy" — never a wrong
// purchase. Restarting the server resets the counter, which is
// acceptable for an operator-facing internal cap.
let dailyUsdcCentsSpent = 0;
let dailyUsdcCentsSpentUtcDay = 0;

function getUtcDay(now: number = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

function getDailyUsdcCentsSpent(): number {
  const today = getUtcDay();
  if (today !== dailyUsdcCentsSpentUtcDay) {
    dailyUsdcCentsSpent = 0;
    dailyUsdcCentsSpentUtcDay = today;
  }
  return dailyUsdcCentsSpent;
}

function recordDailyUsdcCents(additionalCents: number): void {
  getDailyUsdcCentsSpent();
  dailyUsdcCentsSpent += additionalCents;
}

let cachedKey: string | null = null;
let cachedExpiry = 0;
let cachedAt = 0;
let isRefreshing = false;

/** Maximum age of a cached key before we re-validate with CheapTokens. */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
/** Floor under which we never re-fetch (avoids thrashing if upstream is slow). */
const CACHE_REFRESH_BACKOFF_MS = 30 * 1000; // 30 seconds

class CheapTokensClient {
  private baseUrl = "https://cheaptokens.ai/api";

  async getPricing(): Promise<PricingResponse> {
    if (config.FACILITATOR_MODE === "mock") {
      return { discountPercent: 60, creditsPerDollar: 2.5, tier: "mock" };
    }

    const res = await fetch(`${this.baseUrl}/pricing`);
    if (!res.ok) throw new Error(`CheapTokens pricing fetch failed: ${res.statusText}`);
    return (await res.json()) as PricingResponse;
  }

  async getSupply(): Promise<SupplyResponse> {
    if (config.FACILITATOR_MODE === "mock") {
      return { availableKeys: 100, total: 100, sold: 0, remaining: 100, percent: 0 };
    }

    const res = await fetch(`${this.baseUrl}/supply`);
    if (!res.ok) throw new Error(`CheapTokens supply fetch failed: ${res.statusText}`);
    return (await res.json()) as SupplyResponse;
  }

  async buyKey(amountCents: number): Promise<BuyResponse> {
    if (config.FACILITATOR_MODE === "mock") {
      // Return a simulated Venice API key for development/test purposes
      const mockKey = `ct_sk_venice_mock_${Math.random().toString(36).substring(2, 15)}`;
      return {
        veniceApiKey: mockKey,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // Valid for 24 hours
      };
    }

    // Live mode x402 programmatic buy:
    // Requires on-chain Base USDC transfer to CheapTokens hot wallet.
    const payeeAddress = config.CHEAPTOKENS_ADDRESS as Address | undefined;
    if (!payeeAddress) {
      throw new Error("CHEAPTOKENS_ADDRESS must be set in live mode. Refusing to buy from TREASURY_BASE_ADDRESS (would send USDC to self).");
    }
    const pk = config.FACILITATOR_PRIVATE_KEY;
    if (!pk) throw new Error("FACILITATOR_PRIVATE_KEY required for live-mode CheapTokens purchase");
    if (payeeAddress === "0x0000000000000000000000000000000000000000" || payeeAddress === "0x3333333333333333333333333333333333333333") {
      throw new Error("CHEAPTOKENS_ADDRESS or TREASURY_BASE_ADDRESS must be set to a real address for live-mode purchases");
    }

    const account = privateKeyToAccount(pk as Hex);
    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(config.CHAIN_RPC_URL),
    });

    const amountWei = parseUnits((amountCents / 100).toFixed(6), 6);
    const txHash = await walletClient.sendTransaction({
      to: USDC_BASE,
      data: encodeFunctionData({
        abi: USDC_ABI,
        functionName: "transfer",
        args: [payeeAddress, amountWei],
      }),
    });

    const res = await fetch(`${this.baseUrl}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usdPaid: (amountCents / 100).toString(),
        networkId: "base",
        payee: payeeAddress,
        txHash,
      }),
    });

    if (!res.ok) throw new Error(`CheapTokens buy request failed: ${res.statusText}`);
    const json = (await res.json()) as BuyResponse;
    // CheapTokens returns the key as `veniceApiKey`; tolerate `apiKey` for older
    // API versions.
    const legacy = json as unknown as { apiKey?: string };
    if (!json.veniceApiKey && typeof legacy.apiKey === "string") {
      json.veniceApiKey = legacy.apiKey;
    }
    return json;
  }
}

const client = new CheapTokensClient();

export function getActiveVeniceKey(forceRefresh: boolean = false): string | null {
  if (process.env.CHEAPTOKENS_FORCE_DISABLE === "true") {
    return null;
  }
  const now = Date.now();
  const isStale = now - cachedAt > CACHE_TTL_MS;
  const isExpired = cachedKey !== null && now >= cachedExpiry;

  if (!forceRefresh && cachedKey && !isExpired && !isStale) {
    logger.debug(
      `[CheapTokens] Reusing cached Venice key (age=${Math.round((now - cachedAt) / 1000)}s, ttl=${CACHE_TTL_MS / 1000}s)`,
    );
    return cachedKey;
  }

  if (forceRefresh) {
    logger.info("[CheapTokens] Force refresh requested — bypassing cache");
  } else if (isExpired) {
    logger.info(
      `[CheapTokens] Cached key expired ${Math.round((now - cachedExpiry) / 1000)}s ago — refreshing and falling back to VENICE_API_KEY env var until ready`,
    );
  } else if (cachedKey) {
    logger.info(
      `[CheapTokens] Cache stale (age=${Math.round((now - cachedAt) / 1000)}s > ttl=${CACHE_TTL_MS / 1000}s) — refreshing`,
    );
  } else {
    logger.info("[CheapTokens] No cached key — triggering initial refresh");
  }

  triggerRefresh().catch((err) => {
    logger.error("[CheapTokens] Async refresh failed: %s", err);
  });
  if (isExpired) return null;
  return cachedKey;
}

export async function triggerRefresh(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    // CheapTokens hits involve on-chain USDC transfers. The 30s backoff
    // prevents a tight loop from spamming RPC if upstream is having a bad
    // day. Skip the backoff when the cached key is expired (we need to
    // refresh right away, not wait 30s).
    const sinceLastAttempt = Date.now() - cachedAt;
    const isExpired = cachedKey !== null && Date.now() >= cachedExpiry;
    if (cachedKey && !isExpired && sinceLastAttempt < CACHE_REFRESH_BACKOFF_MS) {
      logger.debug(
        `[CheapTokens] Refresh suppressed by backoff (${Math.round(sinceLastAttempt / 1000)}s < ${CACHE_REFRESH_BACKOFF_MS / 1000}s)`,
      );
      return;
    }

    const pricing = await client.getPricing();
    const supply = await client.getSupply();
    const discountPct = Number(pricing.discountPercent ?? 0);
    const available = Number(supply.availableKeys ?? supply.remaining ?? 0);
    if (Number.isFinite(discountPct) && discountPct >= 30 && available > 0) {
      // H6: enforce the per-day USDC cap BEFORE signing the on-chain
      // transfer. The buy is $1 (100 cents) so we check the running
      // counter plus this buy. A single buy always fits in the cap
      // unless we've already spent the daily limit.
      const buyCents = 100;
      const capCents = config.CT_DAILY_USDC_CENTS_MAX;
      if (capCents > 0) {
        const alreadySpent = getDailyUsdcCentsSpent();
        if (alreadySpent + buyCents > capCents) {
          logger.info(
            `[CheapTokens] daily USDC cap reached (${alreadySpent}/${capCents} cents) — skipping buy`,
          );
          return;
        }
      }
      logger.info(`[CheapTokens] Profit optimization: discount ${discountPct}% active, ${available} keys available. Leasing reseller key...`);
      // Buy $1 of credits to seed the cached key.
      const keyInfo = await client.buyKey(buyCents);
      if (keyInfo.veniceApiKey) {
        const now = Date.now();
        cachedKey = keyInfo.veniceApiKey;
        cachedAt = now;
        cachedExpiry = keyInfo.expiresAt ?? now + 24 * 60 * 60 * 1000;
        recordDailyUsdcCents(buyCents);
        logger.info(
          `[CheapTokens] Successfully leased Venice key (cached at ${new Date(cachedAt).toISOString()}, expires: ${new Date(cachedExpiry).toISOString()}, ttl=${CACHE_TTL_MS / 1000}s)`,
        );
      } else {
        logger.warn("[CheapTokens] Buy succeeded but no veniceApiKey in response.");
      }
    } else {
      logger.info(`[CheapTokens] Discount ${discountPct}% below 30% threshold or supply ${available} exhausted. Falling back to default Venice key.`);
    }
  } catch (err) {
    logger.error("[CheapTokens] Failed to query or lease reseller key: %s", err);
  } finally {
    isRefreshing = false;
  }
}