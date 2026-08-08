import { logger } from "./logger.js";

type PaymentKind = "x402" | "polar" | "usdc_deposit";
type PaymentOutcome = "verified" | "settled" | "rejected" | "double_spend_blocked";

interface PaymentEvent {
  kind: PaymentKind;
  outcome: PaymentOutcome;
  userId?: string;
  amountCents?: number;
  signature?: string;
  latencyMs: number;
}

export function logPaymentEvent(event: PaymentEvent): void {
  logger.info({
    "payment.kind": event.kind,
    "payment.outcome": event.outcome,
    "payment.userId": event.userId,
    "payment.amountCents": event.amountCents,
    "payment.signaturePrefix": event.signature?.slice(0, 8),
    "payment.latencyMs": event.latencyMs,
  }, "payment event");
}
