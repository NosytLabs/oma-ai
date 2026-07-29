// x402 wire types shared across the facilitator modules.
// Extracted from facilitator.ts (2026-07-26 module split) — the public
// surface is still re-exported from "./facilitator.js".

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
  // per-payload random nonce for replay protection (CRIT-2).
  // Mirrors the field on `types.ts` PaymentPayload. Optional for v1 clients.
  nonce?: string;
}

export interface PaymentSignature {
  x402Version: X402Version;
  signature: string;
  authorization: string;
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
  // receipt is optional on a *cached verified record* written by
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
  /** Per-path Bazaar discovery descriptors included in v2 402 challenges. */
  bazaar?: Record<string, import("./v2.js").BazaarResourceInfo>;
}

/** Seconds a 402 challenge (and its authorization window) stays valid. */
export const PAYMENT_WINDOW_SECONDS = 300;
