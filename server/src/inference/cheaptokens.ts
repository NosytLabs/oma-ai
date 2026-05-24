import { createWalletClient, http, parseUnits, encodeFunctionData, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import { USDC_BASE } from "../constants.js";

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

interface PricingResponse {
  active: boolean;
  discountPriceCents: number;
  standardPriceCents: number;
}

interface SupplyResponse {
  availableKeys: number;
}

interface BuyResponse {
  apiKey: string;
  expiresAt: number; // timestamp in ms
}

let cachedKey: string | null = null;
let cachedExpiry = 0;
let isRefreshing = false;

export class CheapTokensClient {
  private baseUrl = "https://cheaptokens.ai/api";

  async getPricing(): Promise<PricingResponse> {
    if (config.FACILITATOR_MODE === "mock") {
      return {
        active: true,
        discountPriceCents: 25,
        standardPriceCents: 100,
      };
    }

    const res = await fetch(`${this.baseUrl}/pricing`);
    if (!res.ok) throw new Error(`CheapTokens pricing fetch failed: ${res.statusText}`);
    return (await res.json()) as PricingResponse;
  }

  async getSupply(): Promise<SupplyResponse> {
    if (config.FACILITATOR_MODE === "mock") {
      return { availableKeys: 100 };
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
        apiKey: mockKey,
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
        amount: (amountCents / 100).toString(),
        networkId: "base",
        payee: payeeAddress,
        txHash,
      }),
    });

    if (!res.ok) throw new Error(`CheapTokens buy request failed: ${res.statusText}`);
    return (await res.json()) as BuyResponse;
  }
}

const client = new CheapTokensClient();

export function getActiveVeniceKey(): string | null {
  if (cachedKey && Date.now() < cachedExpiry) {
    return cachedKey;
  }
  triggerRefresh().catch((err) => {
    console.error("[CheapTokens] Async refresh failed:", err);
  });
  return null;
}

export async function triggerRefresh(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const pricing = await client.getPricing();
    if (pricing.active && pricing.discountPriceCents < pricing.standardPriceCents) {
      console.log(`[CheapTokens] Profit optimization: discount active (${pricing.discountPriceCents}c vs ${pricing.standardPriceCents}c). Fetching reseller key...`);
      const supply = await client.getSupply();
      if (supply.availableKeys > 0) {
        const keyInfo = await client.buyKey(pricing.discountPriceCents);
        cachedKey = keyInfo.apiKey;
        cachedExpiry = keyInfo.expiresAt;
        console.log(`[CheapTokens] Successfully leased Venice key (expires: ${new Date(cachedExpiry).toISOString()})`);
      } else {
        console.warn("[CheapTokens] Discount active but supply is exhausted.");
      }
    } else {
      console.log("[CheapTokens] No active discount or not profitable. Falling back to default Venice key.");
    }
  } catch (err) {
    console.error("[CheapTokens] Failed to query or lease reseller key:", err);
  } finally {
    isRefreshing = false;
  }
}