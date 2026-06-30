/**
 * x402 V2 wire-format adapter (additive alongside the existing V1 facilitator).
 *
 * Spec:    https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
 * Transport: https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md
 *
 * Scope of THIS module:
 *   - V2 type definitions (PaymentRequired, PaymentRequirements, PaymentPayload, SettlementResponse)
 *   - base64-encoded header encode/decode helpers
 *   - `pay-req-test` endpoint that emits a V2-shape 402 with `PAYMENT-REQUIRED` header
 *   - `verify` endpoint that accepts V2-shape `PAYMENT-SIGNATURE` and returns a V2-shape settlement
 *
 * Scope of FUTURE work (NOT in this module):
 *   - EIP-3009 transferWithAuthorization settlement (replaces on-chain tx receipt lookup)
 *   - Coinbase CDP facilitator wiring (recommended for production Base)
 *   - `upto` scheme (streaming / per-token metering)
 *   - `batch-settlement` scheme (agent loops, channel-based micro-tx)
 *
 * Migration notes:
 *   - V1 routes under /x402/* continue to work unchanged (no breaking change).
 *   - V2 routes are mounted under /v2/x402/* as a separate namespace.
 *   - The V1 facilitator still owns settlement infrastructure (DB, DLQ, HMAC receipts).
 *     V2 currently returns a 501 on its verify endpoint because EIP-3009 settlement
 *     is not implemented; the 402 wire format is fully exercised so V2 clients can
 *     validate protocol-level compatibility today.
 */
import { Hono } from "hono";
import { USDC_BASE } from "../constants.js";
import { config } from "../config.js";
import { rateLimit } from "../middleware/rate-limit.js";
import type { OmaEnv } from "../types.js";

// ============================================================
// V2 Types — mirrored from the canonical spec
// ============================================================

/** CAIP-2 network identifier. Base mainnet = eip155:8453. */
export type V2Network = `${string}:${string}`;

export interface V2ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

export interface V2PaymentRequirements {
  scheme: "exact";
  network: V2Network;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  /** Server-pinned recipient address (treasury). */
  payTo: `0x${string}`;
  /** Settlement window in seconds. */
  maxTimeoutSeconds: number;
  /** ERC-20 token contract (USDC on Base = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913). */
  asset: `0x${string}`;
  /** Scheme-specific extras (e.g. EIP-3009 name/version for USDC). */
  extra?: Record<string, unknown>;
}

export interface V2PaymentRequired {
  x402Version: 2;
  error?: string;
  accepts: V2PaymentRequirements[];
  resource?: V2ResourceInfo;
}

export interface V2PaymentPayload {
  x402Version: 2;
  scheme: "exact";
  network: V2Network;
  /** Scheme-specific payment data (EIP-3009 authorization tuple in production). */
  payload: Record<string, unknown>;
  resource: string;
}

export interface V2SettlementResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  /** Empty string if settlement failed. */
  transaction: string;
  network: V2Network;
}

// ============================================================
// Encoding helpers — all three V2 headers are base64-encoded JSON
// ============================================================

function b64encode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function b64decode<T>(s: string): T {
  return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as T;
}

export function encodeV2PaymentRequired(p: V2PaymentRequired): string {
  return b64encode(p);
}

export function decodeV2PaymentRequired(s: string): V2PaymentRequired {
  return b64decode<V2PaymentRequired>(s);
}

export function encodeV2PaymentPayload(p: V2PaymentPayload): string {
  return b64encode(p);
}

export function decodeV2PaymentPayload(s: string): V2PaymentPayload {
  return b64decode<V2PaymentPayload>(s);
}

export function encodeV2SettlementResponse(r: V2SettlementResponse): string {
  return b64encode(r);
}

export function decodeV2SettlementResponse(s: string): V2SettlementResponse {
  return b64decode<V2SettlementResponse>(s);
}

// ============================================================
// Builders
// ============================================================

const TREASURY = (config.HOUDINI_ADDRESS_TO || config.TREASURY_BASE_ADDRESS || "").toLowerCase() as `0x${string}`;

export function buildV2PaymentRequired(opts: {
  resource: string;
  description?: string;
  mimeType?: string;
  /** Amount in USDC atomic units (6 decimals) OR human-readable string ("1.00"). */
  amountUsdc: string;
  network?: V2Network;
  asset?: `0x${string}`;
  timeoutSeconds?: number;
}): V2PaymentRequired {
  const network = opts.network ?? "eip155:8453";
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network,
        maxAmountRequired: opts.amountUsdc,
        resource: opts.resource,
        description: opts.description,
        mimeType: opts.mimeType,
        payTo: TREASURY,
        maxTimeoutSeconds: opts.timeoutSeconds ?? 300,
        asset: opts.asset ?? (USDC_BASE as `0x${string}`),
      },
    ],
  };
}

// ============================================================
// Routes — mounted at /v2/x402 (see server/src/index.ts)
// ============================================================

export const x402V2Routes = new Hono<OmaEnv>();

/**
 * Emits a V2-shape 402 Payment Required response. Used for protocol-level
 * testing and as the foundation for any V2 payment-required flow.
 */
x402V2Routes.post(
  "/v2/x402/pay-req-test",
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  async (c) => {
  const url = new URL(c.req.url);
  const required = buildV2PaymentRequired({
    resource: url.pathname,
    description: "x402 V2 payment required (protocol test)",
    mimeType: "application/json",
    amountUsdc: "1.00",
  });
  const headerB64 = encodeV2PaymentRequired(required);
  c.header("PAYMENT-REQUIRED", headerB64);
  return c.json(
    {
      error: { message: "Payment required", type: "payment_required" },
      payment: required,
    },
    402,
  );
});

/**
 * V2 verify endpoint — accepts base64 PAYMENT-SIGNATURE, decodes to V2
 * PaymentPayload, validates protocol-level shape. Full EIP-3009 settlement
 * is not implemented yet (see ARCHITECTURE.md §"x402 & Cross-Chain Payments"
 * → Implementation Phases — Phase 2). Until EIP-3009 lands, this endpoint
 * returns a 501 with V2 wire-format headers so clients can validate
 * compatibility without breaking the V1 flow.
 */
x402V2Routes.post(
  "/v2/x402/verify",
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  async (c) => {
    const url = new URL(c.req.url);
    const required = buildV2PaymentRequired({
      resource: url.pathname,
      description: "x402 V2 payment required",
      mimeType: "application/json",
      amountUsdc: "1.00",
    });
    const headerB64 = encodeV2PaymentRequired(required);
    const headerVal = c.req.header("PAYMENT-SIGNATURE");
    if (!headerVal) {
      c.header("PAYMENT-REQUIRED", headerB64);
      return c.json(
        { error: { message: "Missing PAYMENT-SIGNATURE header", type: "payment_error" } },
        400,
      );
    }

    let payload: V2PaymentPayload;
    try {
      payload = decodeV2PaymentPayload(headerVal);
    } catch {
      return c.json(
        {
          error: {
            message: "Invalid PAYMENT-SIGNATURE: must be valid base64-encoded JSON",
            type: "payment_error",
          },
        },
        400,
      );
    }

    if (payload.x402Version !== 2) {
      return c.json(
        {
          error: {
            message: `Unsupported x402Version: ${payload.x402Version} (expected 2)`,
            type: "payment_error",
          },
        },
        400,
      );
    }

    if (payload.scheme !== "exact") {
      return c.json(
        {
          error: {
            message: `Unsupported scheme: ${payload.scheme} (only "exact" is wired)`,
            type: "payment_error",
          },
        },
        400,
      );
    }

    // Protocol-level validation passes. EIP-3009 settlement is the next step.
    c.header("PAYMENT-REQUIRED", headerB64);
    return c.json(
      {
        error: {
          message:
            "V2 protocol shape validated. EIP-3009 transferWithAuthorization settlement is not yet implemented; use the V1 facilitator at /x402/verify or pre-fund credits at /v1/deposit/usdc.",
          type: "not_implemented",
          code: "x402_v2_settlement_pending",
          docs: "https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md",
        },
        accepted: payload,
      },
      501,
    );
  },
);

/**
 * V2 settlement endpoint — equivalent to /x402/settle for the V2 shape.
 * Same status as /v2/x402/verify until EIP-3009 lands.
 */
x402V2Routes.post("/v2/x402/settle", async (c) => {
  const url = new URL(c.req.url);
  const required = buildV2PaymentRequired({
    resource: url.pathname,
    description: "x402 V2 payment required",
    mimeType: "application/json",
    amountUsdc: "1.00",
  });
  c.header("PAYMENT-REQUIRED", encodeV2PaymentRequired(required));
  return c.json(
    {
      error: {
        message:
          "V2 settlement is not yet implemented. See /v2/x402/verify and ARCHITECTURE.md §x402 & Cross-Chain Payments (Implementation Phases — Phase 2).",
        type: "not_implemented",
        code: "x402_v2_settlement_pending",
      },
    },
    501,
  );
});
