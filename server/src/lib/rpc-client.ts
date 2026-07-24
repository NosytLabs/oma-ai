/**
 * Shared viem public client with automatic RPC fallback.
 *
 * Transport order (viem tries each in sequence on failure):
 *   1. QuickNode (paid, covered by $300 credit — fast, archive data)
 *   2. Free public RPCs (base.llamarpc.com, mainnet.base.org, publicnode)
 *
 * Usage:
 *   import { getPublicClient } from "../lib/rpc-client.js";
 *   const client = getPublicClient();
 *   const receipt = await client.getTransactionReceipt({ hash });
 */
import { createPublicClient, fallback, http } from "viem";
import { base } from "viem/chains";
import { config } from "../config.js";
import { logger } from "./logger.js";

// Free public Base RPCs — no API key, rate-limited but reliable for reads.
const FREE_BASE_RPCS = [
  "https://base.llamarpc.com",
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
];

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
let cachedClient: any = null;

/**
 * Returns a singleton viem PublicClient for Base mainnet with fallback
 * transport. Primary = CHAIN_RPC_URL (QuickNode), fallbacks = free public
 * RPCs. If CHAIN_RPC_URL is unset (dev/test), uses free RPCs only.
 */
export function getPublicClient() {
  if (cachedClient) return cachedClient;

  const transports: ReturnType<typeof http>[] = [];

  if (config.CHAIN_RPC_URL) {
    transports.push(http(config.CHAIN_RPC_URL));
  }

  // Explicit fallback from env (e.g. QUICKNODE_RPC_URL_FALLBACK)
  if (
    config.CHAIN_RPC_URL_FALLBACK &&
    config.CHAIN_RPC_URL_FALLBACK !== config.CHAIN_RPC_URL
  ) {
    transports.push(http(config.CHAIN_RPC_URL_FALLBACK));
  }

  // Free public RPCs — deduped against what's already in the list
  const seen = new Set(transports.map((t) => (t as any).url ?? ""));
  for (const url of FREE_BASE_RPCS) {
    if (!seen.has(url)) {
      transports.push(http(url));
      seen.add(url);
    }
  }

  if (transports.length === 0) {
    // Absolute last resort — viem's default public transport
    transports.push(http());
  }

  logger.info(
    `[rpc] fallback transport: ${transports.length} endpoints (primary: ${config.CHAIN_RPC_URL ? "QuickNode" : "free"})`,
  );

  cachedClient = createPublicClient({
    chain: base,
    transport: fallback(transports, { rank: true }),
  });

  return cachedClient;
}

/** Reset cached client (for tests). */
export function resetPublicClient(): void {
  cachedClient = null;
}
