/** Shared Base transport for balance reads, receipt checks and settlement. */
import { createPublicClient, fallback, http, type FallbackTransport, type PublicClient } from "viem";
import { base } from "viem/chains";
import { config } from "../config.js";

const FREE_BASE_RPCS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
];

type BasePublicClient = PublicClient<FallbackTransport, typeof base>;

/** Each endpoint gets one bounded attempt. Signing stays with the wallet;
 * fallback only resends the same signed transaction, never a new payment. */
export function createBaseTransport(): FallbackTransport {
  const urls = [...new Set([
    config.CHAIN_RPC_URL,
    config.CHAIN_RPC_URL_FALLBACK,
    ...FREE_BASE_RPCS,
  ].filter((url): url is string => Boolean(url) && !/placeholder|changeme/i.test(url!)))];
  return fallback(urls.map((url) => http(url, { timeout: 5_000, retryCount: 0 })), { retryCount: 0 });
}

let cachedClient: BasePublicClient | null = null;
export function getPublicClient(): BasePublicClient {
  cachedClient ??= createPublicClient({ chain: base, transport: createBaseTransport() });
  return cachedClient;
}

export function resetPublicClient(): void {
  cachedClient = null;
}
