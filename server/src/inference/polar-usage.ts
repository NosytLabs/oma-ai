/**
 * Polar usage-event hook.
 *
 * Fires a usage-based billing event to Polar Meters on every successful
 * chat completion when both `POLAR_ACCESS_TOKEN` and
 * `POLAR_USAGE_METER_ID` are configured. The hook is dormant by default —
 * set `POLAR_USAGE_METER_ID=metr_…` in `.env` to enable usage-tracking.
 *
 * This file is the LATENT half of the Polar integration: subscriptions
 * (Polar Plans) are sold via /v1/polar/checkout, and meter events bill
 * the customer for what they actually used. Polar's TOS explicitly
 * forbids reselling COMPUTE via Polar (see crypto-native-saas-billing
 * skill's references/polar-tos.md), so this hook is OFF by default and
 * the operator is responsible for deciding whether their business model
 * is "compute resale" (forbidden) or "subscription for usage credits"
 * (allowed — which is what we ship).
 *
 * Failure semantics: this hook is fire-and-forget. A failed Polar call
 * never breaks the user's chat request — we log a warning and move on.
 * Operators monitoring Polar webhooks (the parallel `_events` admin tab)
 * will see usage drift; that signal is already plumbed.
 */
import { config } from "../config.js";
import { polarEnabled, getPolarClient } from "../routes/polar.js";
import { logger } from "../lib/logger.js";

export interface PolarUsageEvent {
	/** External customer ID we used at checkout — usually the user's wallet. */
	externalCustomerId: string;
	/** Polar meter event name; defaults to "api.usage". */
	eventName?: string;
	/** How much the user paid in cents (for tiered meters). */
	totalCents: number;
	/** Model id (surfaced as metadata for the customer's portal view). */
	model: string;
	/** Provider that served the request. */
	provider: string;
	/** Optional usage breakdown for per-modality meters. */
	inputTokens?: number;
	outputTokens?: number;
	modality?: "chat" | "image" | "video" | "tts" | "embedding" | "asr" | "music" | "upscale" | "inpaint";
}

/**
 * True iff Polar is fully configured AND a usage meter ID is set.
 * Cheap pre-check so the hot path can early-return without allocating.
 */
export function polarUsageTrackingEnabled(): boolean {
	return (
		polarEnabled() &&
		typeof config.POLAR_USAGE_METER_ID === "string" &&
		config.POLAR_USAGE_METER_ID.length > 4 &&
		config.POLAR_USAGE_METER_ID !== "metr_..."
	);
}

/**
 * Send a single usage event to Polar. Never throws — operators monitoring
 * `polarWebhookEvents` will see drift if this drops events. The hook is
 * fire-and-forget at the call site (`trackPolarUsage(...)` returns void,
 * callers do not await it).
 */
export function trackPolarUsage(evt: PolarUsageEvent): void {
	if (!polarUsageTrackingEnabled()) return;
	const client = getPolarClient();
	if (!client) return;

	// Async IIFE — the parent caller doesn't wait. We catch internally so
	// a Polar outage doesn't bubble up and break the user's chat request.
	(async () => {
		try {
			await client.events.ingest({
				events: [
					{
						name: evt.eventName ?? "api.usage",
						externalCustomerId: evt.externalCustomerId,
						metadata: {
							model: evt.model,
							provider: evt.provider,
							modality: evt.modality ?? "chat",
							inputTokens: evt.inputTokens ?? 0,
							outputTokens: evt.outputTokens ?? 0,
						},
					},
				],
			});
		} catch (err) {
			logger.warn(
				{
					err: err instanceof Error ? err.message : String(err),
					userId: evt.externalCustomerId,
					model: evt.model,
					type: "polar_usage_ingest_failed",
				},
				"[polar-usage] Failed to ingest meter event — non-fatal, dashboard chart will drift until Polar recovers.",
			);
		}
	})();
}