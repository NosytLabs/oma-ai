import { config } from "../config.js";

const LIFI_API = config.LIFI_API_URL;
const INTEGRATOR = config.LIFI_INTEGRATOR;

export interface LiFiToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  coinKey?: string;
  logoURI?: string;
  chainId: number;
}

export interface LiFiChain {
  id: number;
  key: string;
  name: string;
  nativeToken: LiFiToken;
  enabled: boolean;
}

export interface LiFiQuote {
  id: string;
  estimatedAmount: string;
  fromAmount: string;
  fromToken: LiFiToken;
  toToken: LiFiToken;
  fromChain: LiFiChain;
  toChain: LiFiChain;
  estimatedDuration: number;
  steps?: Array<{
    id: string;
    type: string;
    tool: string;
    estimate: {
      toAmount: string;
      toAmountMin: string;
      fromAmount: string;
      approvalAddress: string;
      executionDuration: number;
    };
  }>;
}

export interface LiFiRoute {
  id: string;
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    executionDuration: number;
    gasCosts?: Array<{
      type: string;
      price: string;
      estimate: string;
      limit: string;
      token: LiFiToken;
    }>;
    feeCosts?: Array<{
      name: string;
      description: string;
      token: LiFiToken;
      amount: string;
      percentage: string;
      included: boolean;
    }>;
  };
  steps: Array<Record<string, unknown>>;
}

export interface LiFiStatus {
  status: "NOT_FOUND" | "PENDING" | "DONE" | "FAILED";
  subStatus?: string;
  txHash?: string;
  receivingTxHash?: string;
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
}

const LIFI_CHAIN_MAP: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  avalanche: 43114,
  bsc: 56,
  gnosis: 100,
  fantom: 250,
  solana: 792703809,
};

const CCTP_CHAIN_MAP: Record<string, number> = {
  solana: 792703809,
  ethereum: 1,
  avalanche: 43114,
  optimism: 10,
  arbitrum: 42161,
  polygon: 137,
  base: 8453,
};

function parseChain(chain: string | number): { id: number; name: string } {
  if (typeof chain === "number") {
    const entry = Object.entries(LIFI_CHAIN_MAP).find(([, v]) => v === chain);
    return { id: chain, name: entry?.[0] ?? `chain-${chain}` };
  }
  const c = chain.toLowerCase();
  const id = LIFI_CHAIN_MAP[c];
  if (!id) throw new Error(`Unsupported LI.FI chain: ${chain}`);
  return { id, name: c };
}

export async function getSupportedChains(): Promise<LiFiChain[]> {
  const configured = config.LIFI_SOURCE_CHAINS.split(",").map((c) => c.trim().toLowerCase());
  const res = await fetch(`${LIFI_API}/chains`);
  if (!res.ok) throw new Error(`LI.FI chains API error: ${res.status}`);
  const data = await res.json() as { chains: LiFiChain[] };
  return data.chains.filter((c) => configured.includes(c.key) || configured.includes(c.name.toLowerCase()));
}

export async function getTokens(chain: string): Promise<LiFiToken[]> {
  const { id } = parseChain(chain);
  const res = await fetch(`${LIFI_API}/tokens?chains=${id}`);
  if (!res.ok) throw new Error(`LI.FI tokens API error: ${res.status}`);
  const data = await res.json() as Record<string, { tokens: LiFiToken[] }>;
  return data[String(id)]?.tokens ?? [];
}

export async function getQuote(
  fromChain: string,
  fromToken: string,
  fromAmount: string,
  destChain = "base",
  destToken = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  fromAddress?: string,
  slippage = 1,
): Promise<LiFiQuote> {
  const fromChainParsed = parseChain(fromChain);
  const toChainParsed = parseChain(destChain);
  const maxSlippage = slippage;

  const params = new URLSearchParams({
    fromChain: String(fromChainParsed.id),
    toChain: String(toChainParsed.id),
    fromToken,
    toToken: destToken,
    fromAmount,
    slippage: String(maxSlippage),
    integrator: INTEGRATOR,
  });

  if (fromAddress) params.set("fromAddress", fromAddress);

  const res = await fetch(`${LIFI_API}/quote?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LI.FI quote error (${res.status}): ${text}`);
  }
  return res.json() as Promise<LiFiQuote>;
}

export async function getQuoteForSwap(
  fromChain: string,
  fromToken: string,
  fromAmount: string,
): Promise<LiFiQuote> {
  return getQuote(fromChain, fromToken, fromAmount, "base", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
}

export async function getRoutes(
  fromChain: string,
  fromToken: string,
  fromAmount: string,
  toAddress?: string,
): Promise<LiFiRoute[]> {
  const fromChainParsed = parseChain(fromChain);
  const toChainParsed = parseChain("base");

  const params = new URLSearchParams({
    fromChain: String(fromChainParsed.id),
    toChain: String(toChainParsed.id),
    fromToken,
    toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    fromAmount,
    integrator: INTEGRATOR,
    order: "RECOMMENDED",
  });

  if (toAddress) params.set("toAddress", toAddress);

  const res = await fetch(`${LIFI_API}/routes?${params}`);
  if (!res.ok) throw new Error(`LI.FI routes error: ${res.status}`);
  const data = await res.json() as { routes: LiFiRoute[] };
  return data.routes ?? [];
}

export async function getRouteStatus(
  txHash: string,
  fromChain: string,
  destChain = "base",
): Promise<LiFiStatus> {
  const fromChainParsed = parseChain(fromChain);
  const toChainParsed = parseChain(destChain);

  const params = new URLSearchParams({
    fromChain: String(fromChainParsed.id),
    toChain: String(toChainParsed.id),
    txHash,
    integrator: INTEGRATOR,
  });

  const res = await fetch(`${LIFI_API}/status?${params}`);
  if (!res.ok) throw new Error(`LI.FI status API error: ${res.status}`);
  return res.json() as Promise<LiFiStatus>;
}

export async function checkPossibleRoutes(
  fromChain: string,
  fromToken: string,
  fromAmount: string,
): Promise<boolean> {
  try {
    const routes = await getRoutes(fromChain, fromToken, fromAmount);
    return routes.length > 0;
  } catch {
    return false;
  }
}

export function getLifiSourceChains(): string[] {
  return config.LIFI_SOURCE_CHAINS.split(",").map((c) => c.trim().toLowerCase());
}

export function isCctpChain(chain: string): boolean {
  return chain.toLowerCase() in CCTP_CHAIN_MAP;
}