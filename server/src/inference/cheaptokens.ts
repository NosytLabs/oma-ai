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

let cachedKey: string | null = null;
let cachedExpiry = 0;
let isRefreshing = false;

export class CheapTokensClient {
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
    const payeeAddress = (config.CHEAPTOKENS_ADDRESS || config.TREASURY_BASE_ADDRESS) as Address;
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

export function getActiveVeniceKey(): string | null {
  if (cachedKey && Date.now() < cachedExpiry) {
    return cachedKey;
  }
  triggerRefresh().catch((err) => {
    logger.error("[CheapTokens] Async refresh failed: %s", err);
  });
  return null;
}

export async function triggerRefresh(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const pricing = await client.getPricing();
    const supply = await client.getSupply();
    const discountPct = Number(pricing.discountPercent ?? 0);
    const available = Number(supply.availableKeys ?? supply.remaining ?? 0);
    if (Number.isFinite(discountPct) && discountPct >= 30 && available > 0) {
      logger.info(`[CheapTokens] Profit optimization: discount ${discountPct}% active, ${available} keys available. Leasing reseller key...`);
      // Buy $1 of credits to seed the cached key.
      const keyInfo = await client.buyKey(100);
      if (keyInfo.veniceApiKey) {
        cachedKey = keyInfo.veniceApiKey;
        cachedExpiry = keyInfo.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000;
        logger.info(`[CheapTokens] Successfully leased Venice key (expires: ${new Date(cachedExpiry).toISOString()})`);
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