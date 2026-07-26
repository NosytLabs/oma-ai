/**
 * x402 v2 transport adapter (2026 spec, x402 Foundation / Coinbase + Cloudflare).
 *
 * v2 differs from our v1 wire shape in three ways:
 *   - transport header is `X-PAYMENT` carrying base64-encoded JSON (v1 used
 *     a raw-JSON `PAYMENT-SIGNATURE` header),
 *   - networks are CAIP-2 ids (`eip155:8453`), not aliases (`base`),
 *   - the 402 challenge is a machine-readable body:
 *     `{ x402Version: 2, accepts: [{ scheme: "exact", network, maxAmountRequired
 *     (atomic units), asset, payTo, maxTimeoutSeconds, ... }] }`.
 *
 * The signing core is unchanged — EIP-3009 transferWithAuthorization over
 * USDC — so this module only translates the v2 envelope to the internal
 * `PaymentSignature` consumed by `verifyPayment`, and builds the v2
 * challenge/response artifacts. v1 clients keep working untouched.
 *
 * Spec: https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
 */

import { USDC_BASE } from "../constants.js";
import { parseUsdcAtomic } from "./facilitator-signing.js";
import type { PaymentSignature } from "./facilitator.js";

/** CAIP-2 id for Base mainnet (the only network OMA settles on today). */
export const CAIP2_BASE_MAINNET = "eip155:8453";

const CAIP2_TO_INTERNAL: Record<string, string> = {
  [CAIP2_BASE_MAINNET]: "base",
  base: "base",
};

const USDC_DECIMALS = 6n;
const ATOMIC_PER_USDC = 10n ** USDC_DECIMALS;

/** Atomic USDC units → decimal string ("100000" → "0.10"). */
export function atomicToDecimal(atomic: bigint): string {
  const whole = atomic / ATOMIC_PER_USDC;
  const frac = (atomic % ATOMIC_PER_USDC).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export interface XPaymentV2 {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string | number;
      validBefore: string | number;
      nonce: string;
    };
  };
}

/**
 * Parse a v2 `X-PAYMENT` header (base64 JSON) into the internal
 * `PaymentSignature` envelope. Throws with a client-safe message on any
 * malformed input — callers surface it as a 400/402, never a 500.
 */
export function parseXPaymentHeader(headerValue: string): PaymentSignature {
  let decoded: string;
  try {
    decoded = Buffer.from(headerValue, "base64").toString("utf-8");
  } catch {
    throw new Error("X-PAYMENT header is not valid base64");
  }
  let parsed: XPaymentV2;
  try {
    parsed = JSON.parse(decoded) as XPaymentV2;
  } catch {
    throw new Error("X-PAYMENT header does not decode to valid JSON");
  }
  if (parsed.x402Version !== 2) {
    throw new Error(`Unsupported x402Version in X-PAYMENT: ${parsed.x402Version} (expected 2)`);
  }
  if (parsed.scheme !== "exact") {
    throw new Error(`Unsupported scheme in X-PAYMENT: ${parsed.scheme} (expected "exact")`);
  }
  const internalNetwork = CAIP2_TO_INTERNAL[parsed.network];
  if (!internalNetwork) {
    throw new Error(`Unsupported network in X-PAYMENT: ${parsed.network} (expected ${CAIP2_BASE_MAINNET})`);
  }
  const auth = parsed.payload?.authorization;
  const signature = parsed.payload?.signature;
  if (!signature || !auth?.from || !auth?.to || !auth?.value || auth?.nonce === undefined) {
    throw new Error("X-PAYMENT payload must include signature and a full EIP-3009 authorization tuple");
  }

  let valueAtomic: bigint;
  try {
    valueAtomic = BigInt(auth.value);
  } catch {
    throw new Error("X-PAYMENT authorization.value must be an integer string of atomic USDC units");
  }
  if (valueAtomic <= 0n) {
    throw new Error("X-PAYMENT authorization.value must be positive");
  }
  const amountDecimal = atomicToDecimal(valueAtomic);

  return {
    x402Version: "2",
    signature,
    // Internal shape: `authorization` is the JSON-stringified EIP-3009
    // tuple (string fields), auto-detected by isEip3009Authorization.
    authorization: JSON.stringify({
      from: auth.from,
      to: auth.to,
      value: auth.value.toString(),
      validAfter: auth.validAfter.toString(),
      validBefore: auth.validBefore.toString(),
      nonce: auth.nonce,
    }),
    payload: {
      x402Version: "2",
      scheme: "evm",
      networkId: internalNetwork,
      asset: USDC_BASE,
      amount: amountDecimal,
      payee: auth.to,
      payFrom: auth.from,
      maxAmountRequired: amountDecimal,
      validBefore: Number(auth.validBefore),
      validAfter: Number(auth.validAfter),
      nonce: auth.nonce,
    },
  };
}

/**
 * Build the v2 402 challenge body. `priceUsd` is the decimal USD price
 * ("0.10"); `resource` is the absolute URL (or path) being purchased.
 */
export function buildV2Challenge(params: {
  priceUsd: string;
  payTo: string;
  resource: string;
  description?: string;
  maxTimeoutSeconds?: number;
}): {
  x402Version: 2;
  error: string;
  accepts: Array<Record<string, unknown>>;
} {
  const atomic = parseUsdcAtomic(params.priceUsd).toString();
  return {
    x402Version: 2,
    error: "Payment required",
    accepts: [
      {
        scheme: "exact",
        network: CAIP2_BASE_MAINNET,
        maxAmountRequired: atomic,
        asset: USDC_BASE,
        payTo: params.payTo,
        resource: params.resource,
        description: params.description ?? `Payment required for ${params.resource}`,
        mimeType: "application/json",
        maxTimeoutSeconds: params.maxTimeoutSeconds ?? 300,
        // EIP-712 domain hints for the USDC contract on Base.
        extra: { name: "USD Coin", version: "2" },
      },
    ],
  };
}

/**
 * Build the v2 `X-PAYMENT-RESPONSE` header value (base64 JSON) returned on
 * a successfully settled request.
 */
export function buildXPaymentResponse(params: {
  txHash?: string;
  payer?: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      success: true,
      transaction: params.txHash ?? null,
      network: CAIP2_BASE_MAINNET,
      payer: params.payer ?? null,
    }),
    "utf-8",
  ).toString("base64");
}
