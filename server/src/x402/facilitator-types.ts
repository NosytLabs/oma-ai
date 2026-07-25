// facilitator-types.ts — x402 type definitions, constants, cache helpers
// Extracted from facilitator.ts 2026-07-24

import { parseAbi } from "viem";
import type { Hex } from "viem";
import { config } from "../config.js";

export type X402Version = "1" | "2";

export interface PaymentPayload {
  x402Version: X402Version;
  scheme: "evm";
  networkId: string;
  asset: string;
  amount: string;
  payee: string;
  payFrom: string;
  maxAmountRequired: string;
  validBefore: number;
  validAfter: number;
  description?: string;
  // ponytail: per-payload random nonce for replay protection (CRIT-2).
  // Mirrors the field on `types.ts` PaymentPayload. Optional for v1 clients.
  nonce?: string;
}

export interface PaymentSignature {
  x402Version: X402Version;
  signature: string;
  authorization: unknown;
  payload: PaymentPayload;
}

export interface PaymentRequired {
  x402Version: X402Version;
  scheme: "evm";
  networkId: string;
  asset: string;
  amount: string;
  payee: string;
  maxAmountRequired: string;
  validBefore: number;
  validAfter: number;
  description?: string;
  "payment-URL"?: string;
}

export interface PaymentResponse {
  valid: boolean;
  txHash?: string;
  amount?: string;
  networkId?: string;
  error?: string;
}

export interface SettlementRecord {
  txHash: string;
  amount: string;
  networkId: string;
  payee: string;
  settledAt: number;
  // ponytail: receipt is optional on a *cached verified record* written by
  // /x402/verify. The full settlement (with receipt) is written by
  // settlePayment/settlePaymentAsync. This makes the cache state
  // distinguishable: `receipt` undefined = verified-but-not-settled;
  // `receipt` present = fully settled (idempotent re-lookup).
  receipt?: string;
}

export interface SettlementResponse {
  settled: boolean;
  receipt: string;
  error?: string;
}

export interface PaymentMiddlewareConfig {
  pricing: Record<string, string>;
  payeeAddress: string;
  asset?: string;
  networkId?: string;
  scheme?: "evm";
}

// ============================================================
// Settlement Cache (Thread-safe LRU with max size)
// ============================================================

const settlementCache = new Map<string, SettlementRecord>();
const cacheAccessOrder: string[] = [];
const MAX_CACHE_SIZE = 1_000;
const PAYMENT_WINDOW_SECONDS = 300;
const CACHE_TTL_MS = PAYMENT_WINDOW_SECONDS * 1000;
let cacheLock = false;

export function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, record] of settlementCache) {
    if (now - record.settledAt > CACHE_TTL_MS) {
      settlementCache.delete(key);
      const idx = cacheAccessOrder.indexOf(key);
      if (idx !== -1) cacheAccessOrder.splice(idx, 1);
    }
  }
}

function evictLRU(): void {
  if (settlementCache.size >= MAX_CACHE_SIZE && cacheAccessOrder.length > 0) {
    const firstKey = cacheAccessOrder.shift();
    if (firstKey !== undefined) {
      settlementCache.delete(firstKey);
    }
  }
}

export function atomicCacheSet(cacheKey: string, record: SettlementRecord): void {
  if (cacheLock) {
    setTimeout(() => atomicCacheSet(cacheKey, record), 0);
    return;
  }
  cacheLock = true;
  try {
    if (!settlementCache.has(cacheKey)) {
      evictLRU();
      cacheAccessOrder.push(cacheKey);
    }
    settlementCache.set(cacheKey, record);
  } finally {
    cacheLock = false;
  }
}

export function getCacheEntry(cacheKey: string): SettlementRecord | undefined {
  return settlementCache.get(cacheKey);
}

export function hasCacheEntry(cacheKey: string): boolean {
  return settlementCache.has(cacheKey);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ponytail: EIP-3009 USDC authorization domain constants live here
// (used by both signing and verification paths).
export const USDC_EIP712_DOMAIN = {
  name: "USDC",
  version: "1",
  chainId: config.BASE_CHAIN_ID,
  verifyingContract: config.SURPLUS_USDC_CONTRACT ?? config.TREASURY_BASE_ADDRESS ?? "0x0000000000000000000000000000000000000000",
} as const;

export const EIP3009_TRANSFER_WITH_AUTH_TYPES = {
  USDC: [
    { name: "name", type: "string" },
    { name: "symbol", type: "string" },
    { name: "decimals", type: "uint8" },
    { name: "totalSupply", type: "uint256" },
  ],
  EIP3009Authorization: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "authorizedCurrency", type: "address" },
    { name: "allowedContract", type: "address" },
    { name: "allowedTransferAmount", type: "uint256" },
    { name: "validAfter", type: "uint40" },
    { name: "validBefore", type: "uint40" },
  ],
} as const;

export const USDC_EIP3009_ABI = parseAbi([
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
] as const);

export interface Eip3009Authorization {
  owner: `0x${string}`;
  spender: `0x${string}`;
  nonce: bigint;
  authorizedCurrency: `0x${string}`;
  allowedContract: `0x${string}`;
  allowedTransferAmount: bigint;
  validAfter: number;
  validBefore: number;
}

export function isEip3009Authorization(
  value: unknown,
): value is Eip3009Authorization {
  const auth = value as Record<string, unknown> | undefined;
  if (!auth || typeof auth !== "object") return false;
  return (
    typeof auth.owner === "string" &&
    typeof auth.spender === "string" &&
    typeof auth.nonce === "bigint" &&
    typeof auth.authorizedCurrency === "string" &&
    typeof auth.allowedContract === "string" &&
    typeof auth.allowedTransferAmount === "bigint" &&
    typeof auth.validAfter === "number" &&
    typeof auth.validBefore === "number"
  );
}

export function syntheticEip3009TxHash(
  auth: Eip3009Authorization,
  signature: Hex,
): Hex {
  const sigHex = signature.slice(2);
  const authHash =
    auth.owner.slice(2) +
    auth.spender.slice(2) +
    auth.nonce.toString(16).padStart(64, "0") +
    auth.authorizedCurrency.slice(2) +
    auth.allowedContract.slice(2) +
    auth.allowedTransferAmount.toString(16).padStart(64, "0") +
    auth.validAfter.toString(16).padStart(16, "0") +
    auth.validBefore.toString(16).padStart(16, "0");
  return (`0x${authHash}${sigHex}`) as Hex;
}