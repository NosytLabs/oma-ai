// facilitator-verification.ts — x402 payment verification functions
// Extracted from facilitator.ts 2026-07-24

import type { Context, Next, MiddlewareHandler } from "hono";
import { verifyPayment } from "./facilitator.js";
import type { PaymentSignature, PaymentResponse, SettlementRecord } from "./facilitator.js";

// Re-export for backward compat
export { verifyPayment };
export type { PaymentSignature, PaymentResponse, SettlementRecord } from "./facilitator.js";