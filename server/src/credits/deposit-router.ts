import { getCctpSupportedChains } from "./cctp-client.js";
import { getLifiSourceChains } from "./lifi-client.js";

export type RouteMethod = "cctp" | "lifi" | "houdini";

export interface RouteOption {
  method: RouteMethod;
  label: string;
  description: string;
  estimatedTime: string;
  fee: string;
  requiredFields: string[];
  requiresWallet: boolean;
  privacyLevel: "high" | "medium" | "standard";
}

export interface DepositRouteResult {
  best: RouteOption;
  all: RouteOption[];
}

function isUsdc(token: string): boolean {
  const t = token.toUpperCase();
  return t === "USDC" || t === "USDC.E" || t === "USDCCIRCLE";
}

function isPrivacyCoin(token: string): boolean {
  const t = token.toUpperCase();
  return t === "XMR" || t === "BTC";
}

function getNativeCctpChains(): string[] {
  return getCctpSupportedChains();
}

function getLifiChains(): string[] {
  return getLifiSourceChains();
}

export function routeDeposit(
  sourceChain: string,
  sourceToken: string,
  _amount: string,
): DepositRouteResult {
  const chain = sourceChain.toLowerCase();
  const token = sourceToken.toUpperCase();
  const isUsdcToken = isUsdc(token);
  const isPrivacy = isPrivacyCoin(token);

  const cctpChains = getNativeCctpChains();
  const lifiChains = getLifiChains();
  const allOptions: RouteOption[] = [];

  if (isPrivacy) {
    allOptions.push({
      method: "houdini",
      label: "Private Swap (HoudiniSwap)",
      description: "Multi-hop CEX routing with optional privacy layer. Best for XMR, BTC, and privacy-sensitive deposits.",
      estimatedTime: "15-45 minutes",
      fee: "1-2% (included in rate)",
      requiredFields: ["fromCoin", "amount"],
      requiresWallet: false,
      privacyLevel: "high",
    });
  } else if (isUsdcToken && cctpChains.includes(chain)) {
    allOptions.push({
      method: "cctp",
      label: "USDC via CCTP",
      description: `Circle Cross-Chain Transfer Protocol. Burn USDC on ${chain}, mint on Base. Fast and low cost.`,
      estimatedTime: "~30 seconds (Fast) / 1-20 minutes (Standard)",
      fee: "~0.0001% (Fast) / 0% (Standard) + gas",
      requiredFields: ["amount", "txHash"],
      requiresWallet: true,
      privacyLevel: "standard",
    });

    allOptions.push({
      method: "lifi",
      label: "Swap via LI.FI",
      description: "Cross-chain DEX aggregator. Routes through bridges and DEXs to deliver USDC on Base.",
      estimatedTime: "15 seconds - 20 minutes",
      fee: "0.05-0.3%",
      requiredFields: ["fromChain", "fromToken", "fromAmount", "txHash"],
      requiresWallet: true,
      privacyLevel: "standard",
    });
  } else if (lifiChains.includes(chain)) {
    allOptions.push({
      method: "lifi",
      label: "Swap via LI.FI",
      description: `Swap ${token} on ${chain} to USDC on Base through LI.FI's DEX/bridge aggregator.`,
      estimatedTime: "15 seconds - 20 minutes",
      fee: "0.05-0.3%",
      requiredFields: ["fromChain", "fromToken", "fromAmount", "txHash"],
      requiresWallet: true,
      privacyLevel: "standard",
    });

    allOptions.push({
      method: "houdini",
      label: "Swap via HoudiniSwap",
      description: "CEX-backed swap with privacy options. No wallet connection needed.",
      estimatedTime: "3-45 minutes",
      fee: "1-2% (included in rate)",
      requiredFields: ["fromCoin", "amount"],
      requiresWallet: false,
      privacyLevel: "medium",
    });
  } else {
    allOptions.push({
      method: "houdini",
      label: "Swap via HoudiniSwap",
      description: "HoudiniSwap supports 100+ coins across multiple chains. Best for exotic assets and privacy.",
      estimatedTime: "3-45 minutes",
      fee: "1-2% (included in rate)",
      requiredFields: ["fromCoin", "amount"],
      requiresWallet: false,
      privacyLevel: "medium",
    });
  }

  const sorted = [...allOptions].sort((a, b) => {
    const score: Record<RouteMethod, number> = { cctp: 0, lifi: 1, houdini: 2 };
    return score[a.method] - score[b.method];
  });

  return {
    best: sorted[0],
    all: sorted,
  };
}

export function routeDepositByToken(token: string, amount: string): DepositRouteResult {
  return routeDeposit("base", token, amount);
}

export function getSupportedMethods(): RouteMethod[] {
  return ["cctp", "lifi", "houdini"];
}
