// ============================================================
// x402 facilitator — HTTP surface (routes + payment middleware)
// ============================================================
//
// This file is the FAÇADE for the x402 payment facilitator. The
// implementation was split into focused modules (2026-07-26):
//
//   types.ts            wire types + PAYMENT_WINDOW_SECONDS
//   treasury.ts         SERVER_TREASURY pin + fail-closed startup check
//   replay.ts           nonce replay protection (Redis + bounded LRU fallback)
//   settlement-cache.ts verified/settled LRU cache
//   eip3009.ts          EIP-3009 transferWithAuthorization verify path
//   verify.ts           verifyPayment core (mock / QuickNode / EVM dispatch)
//   settle.ts           settlePayment(Async), receipts, idempotency, locks
//   facilitator-signing.ts  receipt HMAC signing + parseUsdcAtomic
//
// Every public symbol is re-exported here so importers (routes, tests,
// lib/settlement-retry) keep using "./x402/facilitator.js" unchanged.

import { Hono } from "hono";
import type { Context, Next, MiddlewareHandler } from "hono";
import { config } from "../config.js";
import { buildV2Challenge, buildXPaymentResponse, parseXPaymentHeader } from "./v2.js";
import type { OmaEnv } from "../types.js";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { settlements } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { rateLimit } from "../middleware/rate-limit.js";
import { USDC_BASE } from "../constants.js";
import { logger } from "../lib/logger.js";
import { parseUsdcAtomic } from "./facilitator-signing.js";
import { atomicCacheSet, settlementCache } from "./settlement-cache.js";
import { settlePaymentAsync } from "./settle.js";
import { SERVER_TREASURY } from "./treasury.js";
import { verifyPayment } from "./verify.js";
import {
  PAYMENT_WINDOW_SECONDS,
  type PaymentMiddlewareConfig,
  type PaymentRequired,
  type PaymentSignature,
} from "./types.js";

// ── Public surface (unchanged import paths for routes, tests, retry lib) ────
export { parseUsdcAtomic };
export { verifyPayment } from "./verify.js";
export {
  getSettlementReceipt,
  getSettlementReceiptAsync,
  isSettled,
  isSettledAsync,
  settlePayment,
  settlePaymentAsync,
  verifySettlementReceipt,
} from "./settle.js";
export type {
  PaymentMiddlewareConfig,
  PaymentPayload,
  PaymentRequired,
  PaymentResponse,
  PaymentSignature,
  SettlementRecord,
  SettlementResponse,
  X402Version,
} from "./types.js";

// ============================================================
// Hono Routes
// ============================================================

export const x402Routes = new Hono<OmaEnv>();

x402Routes.post("/x402/verify", rateLimit({ windowMs: 60_000, maxRequests: 10 }), async (c) => {
  const headerVal = c.req.header("PAYMENT-SIGNATURE");
  if (!headerVal) {
    return c.json(
      { error: { message: "Missing PAYMENT-SIGNATURE header", type: "payment_error" } },
      400,
    );
  }

  let paymentSig: PaymentSignature;
  try {
    paymentSig = JSON.parse(headerVal) as PaymentSignature;
  } catch {
    return c.json(
      { error: { message: "Invalid PAYMENT-SIGNATURE: must be valid JSON", type: "payment_error" } },
      400,
    );
  }

  // ponytail: V6 #8 — pin the merchant payee on the public verify endpoint.
  // Previously any valid USDC transfer verified regardless of who received
  // the funds, which let a third party use this endpoint to launder a
  // verification receipt for an arbitrary tx. The settle route already pins
  // payee; verify now matches that contract.
  if (SERVER_TREASURY) {
    const declared = (paymentSig.payload?.payee ?? "").toLowerCase();
    if (!declared || declared !== SERVER_TREASURY) {
      return c.json(
        { error: { message: "Invalid payee: payload does not match configured merchant address", type: "invalid_payee" } },
        400,
      );
    }
  }

  if (!paymentSig.signature || !paymentSig.payload) {
    return c.json(
      { error: { message: "PAYMENT-SIGNATURE must include signature and payload", type: "payment_error" } },
      400,
    );
  }

  if (!paymentSig.payload.scheme || !paymentSig.payload.amount || !paymentSig.payload.networkId) {
    return c.json(
      { error: { message: "Payload must include scheme, amount, and networkId", type: "payment_error" } },
      400,
    );
  }

  const result = await verifyPayment(paymentSig);
  return c.json(result, result.valid ? 200 : 422);
});

x402Routes.post("/x402/settle", sessionAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: { message: "Unauthorized", type: "authentication_error" } }, 401);
  }

  // ponytail: C2 — amount is derived from the verified cache, NEVER from the
  // body. Without this, a client could call `/x402/verify` with a 0.01 USDC tx,
  // get a valid receipt, then call `/x402/settle` with `amount: "1000000"` and
  // stamp a receipt claiming they paid a million dollars. The receipt signed
  // here is what downstream services (credit ledger, audit log) consume.
  let body: { txHash?: string; amount?: string; networkId?: string; payee?: string };
  try {
    body = await c.req.json<{ txHash?: string; amount?: string; networkId?: string; payee?: string }>();
  } catch {
    return c.json(
      { error: { message: "Invalid JSON body", type: "payment_error" } },
      400,
    );
  }

  if (!body.txHash || !body.networkId) {
    return c.json(
      { error: { message: "txHash and networkId are required (amount is derived from verified cache, not the body)", type: "payment_error" } },
      400,
    );
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
    return c.json({ error: { message: "Invalid txHash format", type: "validation_error" } }, 400);
  }

  // Pin payee to the configured merchant address; never trust user-supplied
  // recipients. The x402 spec requires the merchant to receive the payment.
  const expectedPayee = (config.TREASURY_BASE_ADDRESS || "").toLowerCase();
  if (!expectedPayee) {
    return c.json(
      { error: { message: "Server merchant address not configured", type: "server_misconfigured" } },
      500,
    );
  }
  if (body.payee && body.payee.toLowerCase() !== expectedPayee) {
    return c.json(
      { error: { message: "Payee does not match configured merchant address", type: "payment_error" } },
      400,
    );
  }

  // ponytail: log a warning when the legacy client sends body.amount, so we
  // can track migration progress and surface it in the docs changelog.
  if (body.amount !== undefined) {
    logger.warn(
      { txHash: body.txHash, clientAmount: body.amount },
      "[FACILITATOR] /x402/settle body.amount is ignored; amount is derived from the verified cache",
    );
  }

  // Optional PAYMENT-SIGNATURE header: if present, parse and validate JSON
  // shape (legacy dual-channel settle+verify path).
  const paymentHeader = c.req.header("PAYMENT-SIGNATURE");
  if (paymentHeader) {
    try {
      JSON.parse(paymentHeader);
    } catch {
      return c.json(
        { error: { message: "Invalid PAYMENT-SIGNATURE header: must be valid JSON", type: "payment_error" } },
        400,
      );
    }
  }

  // Look up the verified record from the in-memory cache. The cache is
  // populated by `/x402/verify` after a successful on-chain verification.
  // If the cache has no entry for this txHash, fall back to the DB so that
  // settlements survive server restarts (CRIT-4).
  const cacheKey = `${body.networkId}:${body.txHash}`;
  const cached = settlementCache.get(cacheKey);
  if (cached) {
    // Use settlePaymentAsync which persists the receipt to the DB.
    const result = await settlePaymentAsync(body.txHash, cached.amount, cached.networkId, expectedPayee);
    return c.json(result, result.settled ? 200 : 422);
  }

  // Cache miss — check the DB for an existing settlement.
  const existingSettlement = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.txHash, body.txHash), eq(settlements.networkId, body.networkId)))
    .limit(1);
  if (existingSettlement.length > 0) {
    // Repopulate the cache and return the stored receipt.
    atomicCacheSet(cacheKey, {
      txHash: existingSettlement[0].txHash,
      amount: existingSettlement[0].amount,
      networkId: existingSettlement[0].networkId,
      payee: existingSettlement[0].payee,
      settledAt: existingSettlement[0].settledAt.getTime(),
      receipt: existingSettlement[0].receipt,
    });
    return c.json({ settled: true, receipt: existingSettlement[0].receipt }, 200);
  }

  // No record anywhere — client must call /x402/verify first.
  return c.json(
    {
      error: {
        message: "No verified payment on file for this txHash. Call /x402/verify first.",
        type: "missing_verify",
        code: "x402_verify_required",
      },
    },
    400,
  );
});

// ── Test routes — dev/staging only ──────────────────────────────────────────
if (config.NODE_ENV !== "production") {
x402Routes.post("/x402/pay-req-test",
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  async (c) => {
  // ponytail: refuse to mount the test route with an unset merchant address —
  // falling back to 0x000… lets an attacker mint a Pay-Req header with a
  // bogus payee and probe verification behavior. Returns 503 (not 500) so
  // it's clearly "intentionally disabled", not "broken".
  const payeeAddress = config.TREASURY_BASE_ADDRESS;
  if (!payeeAddress) {
    return c.json(
      { error: { message: "x402 test endpoint disabled: TREASURY_BASE_ADDRESS unset", type: "feature_disabled" } },
      503,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const paymentURL = `https://oma-ai.com/deposit?route=x402&network=base&asset=USDC&return_to=${encodeURIComponent(c.req.url)}`;
  const amount = "1.00";

  const paymentRequired: PaymentRequired = {
    x402Version: "1",
    scheme: "evm",
    networkId: "base",
    asset: USDC_BASE,
    amount,
    payee: payeeAddress,
    maxAmountRequired: amount,
    validBefore: now + PAYMENT_WINDOW_SECONDS,
    validAfter: now,
    description: "Payment required for x402 test",
    "payment-URL": paymentURL,
  };

  c.header("PAYMENT-REQUIRED", JSON.stringify(paymentRequired));
  return c.json(
    {
      error: {
        message: "Payment required",
        type: "payment_required",
        payment: paymentRequired,
      },
    },
    402,
  );
});

const testPricing: Record<string, string> = {
  "/x402/middleware-test": "0.50",
};

const testPayeeAddress = config.TREASURY_BASE_ADDRESS;
// ponytail: only mount the middleware test when a real merchant address is set.
// Falling back to the zero address would let `/x402/middleware-test` accept
// payments to nobody and falsely report "success" — see audit X402-2026-06-14.
if (testPayeeAddress) {
  x402Routes.use("/x402/middleware-test", paymentMiddleware({
    pricing: testPricing,
    payeeAddress: testPayeeAddress,
  }));
}

x402Routes.post("/x402/middleware-test", async (c) => {
  return c.json({ success: true });
});
} // end NODE_ENV !== "production" test routes

// Houdini/crosschain deposit flow removed — /v1/x402/proxy/chat/completions no longer exists.

// =============================================================================
// x402 SPEC NOTE (post-2026-07-02 audit fix):
//
// As of audit-x402-eip3009-fix-2026-07-02, the V1 verify path now uses
// EIP-3009 transferWithAuthorization (gasless for the user, facilitator pays
// gas). The canonical Coinbase x402 v2 spec lives at
//   https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
//   (transport: https://github.com/coinbase/x402/blob/main/specs/transports-v2/http.md)
//
// V1 wire shape (now EIP-3009-aligned; was: receipt-check of pre-paid transfer):
//   * x402Version: string ("1"|"2"). V2 spec uses number (2); v2.ts adapts
//     the v2 wire (base64 PAYMENT-SIGNATURE / X-PAYMENT) onto this envelope.
//   * Transport header: PAYMENT-SIGNATURE (JSON-encoded PaymentSignature).
//   * signature     = 65-byte EIP-712 sig over TransferWithAuthorization typed data.
//   * authorization = JSON { from, to, value, validAfter, validBefore, nonce }.
//   * payload       = { scheme, networkId, asset, amount, payee, payFrom,
//                      maxAmountRequired, validBefore, validAfter, nonce? }.
//   * Legacy back-compat: if authorization is not a JSON EIP-3009 tuple, the
//     verify path falls through to `verifyUsdcTransferReceipt` which decodes
//     `transfer`/`transferFrom` calldata from a tx hash (pre-paid flow).
//
// EIP-3009 verify path (verifyEip3009Payment):
//   1. Consume nonce (CRIT-2 replay protection).
//   2. Parse + shape-check the authorization tuple.
//   3. Pin payee to SERVER_TREASURY (reject mismatches).
//   4. Pin amount >= payload.maxAmountRequired.
//   5. Validate validAfter <= now < validBefore.
//   6. Recover EIP-712 signer via viem.recoverTypedDataAddress; reject if
//      recovered != authorization.from.
//   7. Simulate via eth_call (catches double-spend attempts where the
//      contract would revert because the nonce is already used).
//   8. Settle: if FACILITATOR_PRIVATE_KEY is configured, submit the real
//      transferWithAuthorization tx (facilitator pays gas). Otherwise emit
//      a deterministic synthetic txHash (keccak256 of tuple+sig) so the
//      verify+settle cache key still works for dev/preview deployments.
//
// Canonical chain IDs: Base mainnet = eip155:8453, USDC = 0x833589…29913;
// Base Sepolia = eip155:84532, USDC = 0x036CbD…CF7e (matches v2 spec).
// Only mainnet is supported today.
//
// =============================================================================

// ============================================================
// Payment Middleware
// ============================================================

export function paymentMiddleware(
  middlewareConfig: PaymentMiddlewareConfig,
): MiddlewareHandler<OmaEnv> {
  const {
    pricing,
    payeeAddress,
    asset = USDC_BASE,
    networkId = "base",
    scheme = "evm",
  } = middlewareConfig;

  return async (c: Context<OmaEnv>, next: Next) => {
    const path = new URL(c.req.url).pathname;
    const price = pricing[path];

    if (price === undefined) {
      await next();
      return;
    }

    // v2 transport (X-PAYMENT, base64 JSON, CAIP-2 networks) is checked
    // first; the legacy v1 PAYMENT-SIGNATURE raw-JSON header remains fully
    // supported. Both map onto the same EIP-3009 verify/settle core.
    const xPaymentHeader = c.req.header("X-PAYMENT");
    const paymentHeader = c.req.header("PAYMENT-SIGNATURE");

    if (!xPaymentHeader && !paymentHeader) {
      const now = Math.floor(Date.now() / 1000);
      const paymentURL = `https://oma-ai.com/deposit?route=x402&network=${networkId}&asset=${encodeURIComponent(asset)}&return_to=${encodeURIComponent(c.req.url)}`;

      const paymentRequired: PaymentRequired = {
        x402Version: "1",
        scheme,
        networkId,
        asset,
        amount: price,
        payee: payeeAddress,
        maxAmountRequired: price,
        validBefore: now + PAYMENT_WINDOW_SECONDS,
        validAfter: now,
        description: `Payment required for ${path}`,
        "payment-URL": paymentURL,
      };

      const v2Challenge = buildV2Challenge({
        priceUsd: price,
        payTo: payeeAddress,
        resource: c.req.url,
        maxTimeoutSeconds: PAYMENT_WINDOW_SECONDS,
        bazaar: middlewareConfig.bazaar?.[path],
      });

      c.header("PAYMENT-REQUIRED", JSON.stringify(paymentRequired));
      // Spec-shaped v2 body (x402Version/accepts) with the legacy v1
      // error envelope folded in so both client generations can parse it.
      return c.json(
        {
          ...v2Challenge,
          error: {
            message: "Payment required",
            type: "payment_required",
            payment: paymentRequired,
          },
        },
        402,
      );
    }

    let paymentSig: PaymentSignature;
    if (xPaymentHeader) {
      try {
        paymentSig = parseXPaymentHeader(xPaymentHeader);
      } catch (err) {
        return c.json(
          { error: { message: err instanceof Error ? err.message : "Invalid X-PAYMENT header", type: "payment_error" } },
          400,
        );
      }
    } else {
      // PAYMENT-SIGNATURE carries either the legacy OMA raw-JSON envelope or,
      // per the current v2 spec (which renamed X-PAYMENT → PAYMENT-SIGNATURE),
      // base64-encoded v2 JSON. Sniff the first character to tell them apart.
      const raw = (paymentHeader as string).trim();
      try {
        paymentSig = raw.startsWith("{")
          ? (JSON.parse(raw) as PaymentSignature)
          : parseXPaymentHeader(raw);
      } catch (err) {
        return c.json(
          { error: { message: err instanceof Error ? err.message : "Invalid PAYMENT-SIGNATURE header", type: "payment_error" } },
          400,
        );
      }
    }

    if (paymentSig.payload?.payee?.toLowerCase() !== payeeAddress.toLowerCase()) {
      return c.json(
        { error: { message: "Payment payee mismatch", type: "payment_error" } },
        402,
      );
    }

    const requestedAtomic = parseUsdcAtomic(paymentSig.payload?.amount ?? "0");
    const requiredAtomic = parseUsdcAtomic(price);
    // Reject underpayment first (the client is paying less than the price).
    if (requestedAtomic < requiredAtomic) {
      return c.json(
        { error: { message: `Insufficient payment: requested ${requestedAtomic} but ${requiredAtomic} required`, type: "payment_error" } },
        402,
      );
    }
    // Reject overpayment — the actual settled amount is determined by
    // verifyPayment (on-chain), not the client-supplied amount field.
    if (requestedAtomic > requiredAtomic) {
      return c.json(
        { error: { message: `Payment amount exceeds maximum: requested ${requestedAtomic} but ${requiredAtomic} allowed`, type: "payment_error" } },
        402,
      );
    }

    const verification = await verifyPayment(paymentSig);

    if (!verification.valid) {
      return c.json(
        { error: { message: verification.error ?? "Payment verification failed", type: "payment_error" } },
        402,
      );
    }

    if (verification.txHash) {
      await settlePaymentAsync(
        verification.txHash,
        verification.amount ?? paymentSig.payload.amount,
        verification.networkId ?? paymentSig.payload.networkId,
        payeeAddress,
        { idempotencyKey: paymentSig.signature },
      );
    }

    c.set("payment", { txHash: verification.txHash, amount: verification.amount ?? paymentSig.payload.amount, networkId: verification.networkId ?? paymentSig.payload.networkId });
    // Settlement receipt headers: PAYMENT-RESPONSE is the current v2 spec
    // name; X-PAYMENT-RESPONSE is kept for clients built against the older
    // draft. Same base64 payload in both.
    const receiptHeader = buildXPaymentResponse({
      txHash: verification.txHash,
      payer: paymentSig.payload.payFrom,
    });
    c.header("PAYMENT-RESPONSE", receiptHeader);
    if (xPaymentHeader) {
      c.header("X-PAYMENT-RESPONSE", receiptHeader);
    }
    await next();
  };
}
