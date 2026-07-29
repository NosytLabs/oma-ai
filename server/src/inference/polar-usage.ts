/**
 * Polar usage metering — sends token-consumption events to Polar so the
 * customer portal can show how much of a subscription plan's allocation
 * has been used.
 *
 * This is OPTIONAL: if POLAR_USAGE_METER_ID or POLAR_ACCESS_TOKEN is
 * unset, every call is a no-op. The core usage tracking (usageRecords
 * table + credit deduction) happens in routes/chat/index.ts regardless.
 *
 * Polar TOS forbids reselling compute. Treat this as subscription-bundled
 * credit visibility, NOT pay-per-token metering.
 *
 * Event shape:
 *   name:             "tokens_consumed" (must match the Polar meter's event name)
 *   externalCustomerId: user's wallet address or API key
 *   metadata:         { model, provider, prompt_tokens, output_tokens, total_tokens, cost_cents }
 *   externalId:       requestId (for deduplication)
 */

import { Polar } from "@polar-sh/sdk";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

let polarClient: Polar | null = null;

function getPolar(): Polar | null {
  if (polarClient) return polarClient;
  if (!config.POLAR_ACCESS_TOKEN || !config.POLAR_USAGE_METER_ID) return null;
  polarClient = new Polar({
    accessToken: config.POLAR_ACCESS_TOKEN,
    server: (config.POLAR_SERVER as "production" | "sandbox") ?? "production",
  });
  return polarClient;
}

export interface PolarUsageEvent {
  /** User's external ID — wallet address or API key. */
  externalCustomerId: string;
  /** Request ID for deduplication. */
  requestId: string;
  model: string;
  provider: string;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
}

/**
 * Send a usage event to Polar Meters. No-op if Polar is not configured.
 * Errors are logged and swallowed — usage tracking must never block a
 * chat completion response.
 */
export async function trackPolarUsage(event: PolarUsageEvent): Promise<void> {
  const polar = getPolar();
  if (!polar) return;

  try {
    await polar.events.ingest({
      events: [
        {
          name: "tokens_consumed",
          externalCustomerId: event.externalCustomerId,
          externalId: event.requestId,
          metadata: {
            model: event.model,
            provider: event.provider,
            prompt_tokens: event.promptTokens,
            output_tokens: event.outputTokens,
            total_tokens: event.totalTokens,
            cost_cents: event.costCents,
          },
        },
      ],
    });
  } catch (err) {
    logger.warn(
      { err, requestId: event.requestId },
      "[polar-usage] meter event failed (non-fatal)",
    );
  }
}
