/**
	* Polar.sh checkout + webhook integration.
	*
	* Endpoints:
	*   POST /v1/checkout           — create a Polar checkout session
	*   POST /webhooks/polar        — handle Polar webhook events
	*   POST /api/webhook/polar     — alternate webhook path (Polar dashboard
	*                                 may be pointed at either URL)
	*
	* The checkout route creates a Polar checkout for the authenticated
	* user based on the chosen plan. On `order.paid` (via the webhook),
	* we credit the user's balance with the plan's allocation. Products
	* are one-time credit purchases (no recurring billing); `order.refunded`
	* reverses the refunded share of its granted credits.
	*
	* Plans (configurable via env):
	*   hobby   — POLAR_HOBBY_PRODUCT_ID    — 1000 credits ($10)
	*   builder — POLAR_BUILDER_PRODUCT_ID  — 5000 credits ($50)
	*   scale   — POLAR_SCALE_PRODUCT_ID    — 25000 credits ($250)
	*
	* Webhook signature verification uses HMAC-SHA256 with the
	* standardwebhooks spec (Polar's recommended approach). See
	* https://docs.polar.sh/api-reference/webhooks/verification for
	* details.
	*/
import { Hono } from "hono";
import { z } from "zod";
import { createPolar, webhooks, type Polar } from "@polar-sh/sdk/2026-10";
import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { requirePaymentRail } from "../middleware/payment-rail.js";
import { db } from "../db/client.js";
import { polarWebhookEvents } from "../db/schema.js";
import { config, isProductionEnv } from "../config.js";
import { logger } from "../lib/logger.js";
import { logPaymentEvent } from "../lib/payment-observability.js";
import { errorResponse } from "../lib/error-response.js";
import { reconcilePolarOrderCredit } from "../lib/polar-order-credit.js";

export const polarRoutes = new Hono<OmaEnv>();

const PLAN_CREDITS: Record<
		string,
		{ productEnv: keyof typeof config; credits: number; label: string }
> = {
		hobby: {
				productEnv: "POLAR_HOBBY_PRODUCT_ID",
				credits: 1000,
				label: "Hobby ($10)",
		},
		builder: {
				productEnv: "POLAR_BUILDER_PRODUCT_ID",
				credits: 5000,
				label: "Builder ($50)",
		},
		scale: {
				productEnv: "POLAR_SCALE_PRODUCT_ID",
				credits: 25000,
				label: "Scale ($250)",
		},
};

function getPolarClient(): Polar | null {
		if (!config.POLAR_ACCESS_TOKEN) return null;
		return createPolar({
				accessToken: config.POLAR_ACCESS_TOKEN,
				environment: config.POLAR_SERVER,
		});
}

const checkoutSchema = z.object({
		plan: z.enum(["hobby", "builder", "scale"]),
		successUrl: z.string().url().optional(),
	});

/**
 * Only accept a client-supplied `successUrl` whose origin belongs to this app
 * (the Next.js frontend). A supplied value otherwise lets a merchant pass an
 * arbitrary redirect target, which after a real payment would land the buyer
 * on an attacker-controlled page (open-redirect / post-checkout phishing).
 * Fixes the default-only origin used in the historical `localhost:3002`
 * test checkouts. Any disallowed or nonexistent value falls back to the
 * server-computed default below.
 */
export function isAllowedCheckoutOrigin(url: string): boolean {
		try {
				const u = new URL(url);
				const origin = u.origin;
				const host = u.hostname;
				// Local app origins (dev / localhost) are permitted ONLY outside
				// production, so the hosted checkout can redirect a dev buyer back
				// to the local app. In production a localhost/127.0.0.1 success URL
				// (e.g. supplied by a local proxy or a malicious origin) must never
				// be honoured — fall through to the server-computed default.
				if ((host === "localhost" || host === "127.0.0.1") && !isProductionEnv) return true;
				// Production app domain(s): apex + www of PRIMARY_DOMAIN.
				const pd = config.PRIMARY_DOMAIN;
				if (pd && (host === pd || host === `www.${pd}`)) return true;
				// PUBLIC_APP_URL, if it differs from the above.
				const appOrigin = (() => {
						try {
								return new URL(config.PUBLIC_APP_URL).origin;
						} catch {
								return "";
						}
				})();
				if (appOrigin && appOrigin === origin) return true;
				return false;
		} catch {
				return false;
		}
}

/**
	* POST /v1/checkout
	* Body: { plan: "hobby" | "builder" | "scale", successUrl?: string }
	* Returns: { id: string, url: string } — redirect the user to `url`.
	*/
polarRoutes.post(
		"/v1/checkout",
		rateLimit({ windowMs: 60_000, maxRequests: 10 }),
		sessionOrBearerAuth,
		requirePaymentRail("card"),
		async (c) => {
				const body = await c.req.json().catch(() => null);
				const parsed = checkoutSchema.safeParse(body);
				if (!parsed.success) {
						return c.json(
								{
										error: {
												message: "Invalid plan",
												type: "invalid_request_error",
												issues: parsed.error.flatten(),
										},
								},
								400,
						);
				}

				const polar = getPolarClient();
				if (!polar) {
						return c.json(
								{
										error: {
												message:
														"Card payments are temporarily unavailable. Please try another available payment method.",
												type: "not_configured",
										},
								},
								503,
						);
				}
				const plan = PLAN_CREDITS[parsed.data.plan];
				const productId = config[plan.productEnv];
				if (!productId) {
						return c.json(
								{
										error: {
												message: "This credit pack is not available right now.",
												type: "not_configured",
										},
								},
								503,
						);
				}
				const userId = c.get("userId");
				const session = await polar.checkouts.create({
						products: [String(productId)],
						success_url:
								parsed.data.successUrl && isAllowedCheckoutOrigin(parsed.data.successUrl)
										? parsed.data.successUrl
										: `${config.PUBLIC_APP_URL}/dashboard?checkout=success`,
						metadata: { userId, plan: parsed.data.plan, credits: plan.credits },
				});
				return c.json({
						id: session.id,
						url: session.url,
						plan: parsed.data.plan,
						creditsOnSuccess: plan.credits,
				});
		},
);

// ─── Webhook verification ──────────────────────────────────────────────

interface WebhookEventPayload {
		type: string;
		data?: {
				id?: string;
				status?: string;
				product?: { id?: string };
				product_id?: string;
				metadata?: Record<string, unknown>;
				customer?: { id?: string; email?: string };
		};
}

function planFromProductId(
		productId: string | undefined,
): keyof typeof PLAN_CREDITS | null {
		if (!productId) return null;
		for (const [plan, info] of Object.entries(PLAN_CREDITS)) {
				if (config[info.productEnv] === productId) {
						return plan as keyof typeof PLAN_CREDITS;
				}
		}
		return null;
}

/**
	* Shared Polar webhook handler — mounted at both /webhooks/polar and
	* /api/webhook/polar so operators can point the Polar dashboard at either
	* URL without breaking delivery.
	*/
export async function polarWebhookHandler(c: Context<OmaEnv>) {
	if (!config.POLAR_WEBHOOK_SECRET) {
		return errorResponse(c, "Webhook secret not configured on the server. Set POLAR_WEBHOOK_SECRET in server/.env.", 503, { type: "not_configured", code: "polar_webhook_secret_missing" });
	}
		const rawBody = await c.req.text();
		const startedAt = Date.now();
		const eventId = c.req.header("webhook-id") ?? null;
		let event: WebhookEventPayload;
		try {
			event = await webhooks.validateEvent(rawBody, {
				"webhook-id": eventId ?? "",
				"webhook-timestamp": c.req.header("webhook-timestamp") ?? "",
				"webhook-signature": c.req.header("webhook-signature") ?? "",
			}, config.POLAR_WEBHOOK_SECRET) as WebhookEventPayload;
		} catch (err) {
			if (err instanceof webhooks.PolarWebhookVerificationError) {
				logger.warn("[polar] webhook signature verification failed");
				return errorResponse(c, "Invalid webhook signature", 401, { code: "invalid_signature" });
			}
			// Authenticated events from a newer API version do not grant credits.
			if (err instanceof webhooks.PolarWebhookUnknownTypeError && typeof err.eventType === "string") {
				return c.json({ ok: true, ignored: true });
			}
			return errorResponse(c, "Invalid webhook payload", 400, { code: "invalid_json" });
		}
		if (!eventId) {
			return errorResponse(c, "Missing Webhook-Id header", 400, { code: "missing_webhook_id" });
		}
		// Preserve failed deliveries for retry. Conflict handling must not rely
		// on driver-specific error shapes (Drizzle wraps Postgres errors).
		try {
			const inserted = await db.insert(polarWebhookEvents).values({
				polarEventId: eventId, eventType: event.type, payload: rawBody, processed: 0,
			}).onConflictDoNothing().returning({ id: polarWebhookEvents.id });
			if (inserted.length === 0) {
				const [existing] = await db.select({ processed: polarWebhookEvents.processed })
					.from(polarWebhookEvents).where(eq(polarWebhookEvents.polarEventId, eventId)).limit(1);
				if (existing?.processed === 1) {
					logPaymentEvent({ kind: "polar", outcome: "double_spend_blocked", signature: eventId, latencyMs: Date.now() - startedAt });
					return c.json({ ok: true, duplicate: true });
				}
			}
		} catch (err) {
			logger.error({ err, eventId }, "[polar] failed to claim webhook event");
			return errorResponse(c, "Webhook processing is temporarily unavailable", 503, { code: "polar_claim_failed" });
		}

		// SECURITY: derive credits from the server-side product→plan mapping, not
		// from webhook metadata. Metadata is attacker-controlled; a compromised
		// operator secret could otherwise credit any user any amount.
		// See audit: polar.ts:353-362 IDOR.
		const plan = planFromProductId(event.data?.product_id ?? event.data?.product?.id) ?? null;
		const credits = plan ? PLAN_CREDITS[plan].credits : null;
		const metadata = event.data?.metadata ?? {};
		// userId comes from checkout metadata (Polar echoes it back on every
		// order event; the webhook signature authenticates the payload).
		const userId = typeof metadata.userId === "string" ? metadata.userId : null;
		if (metadata.credits !== undefined && metadata.credits !== credits) {
				logger.warn(
						{
								eventId,
								eventType: event.type,
								metadataCredits: metadata.credits,
								derivedCredits: credits,
						},
						"[polar] webhook metadata credits diverged from product map; using server-side value",
				);
		}

		let appliedOrderDeltaCents: number | undefined;
		if (event.type === "order.paid" || event.type === "order.refunded") {
				if (userId && credits) {
						await processInTransaction(eventId, async (tx) => {
								appliedOrderDeltaCents = await reconcilePolarOrderCredit(tx, eventId, event.data, credits);
						});
				} else {
					logger.error(
						{ type: event.type, hasUserId: !!userId, hasCredits: !!credits, plan, eventId },
						"[polar] order event missing userId or credits; returning 5xx so Polar retries",
					);
					// SECURITY (audit 2026-09-27 / P0): returning 200 here told Polar
					// "handled" while the customer paid real money and got nothing —
					// the webhook row stayed processed=0 with no repair path.
					// Returning 5xx makes Polar retry until the payload is correct.
					logPaymentEvent({
						kind: "polar",
						outcome: "rejected",
						userId: userId ?? undefined,
						amountCents: credits ?? undefined,
						signature: eventId,
						latencyMs: Date.now() - startedAt,
					});
					return c.json(
						{
							error: {
								message: "Order event missing userId or credits — not processed",
								code: "missing_credit_target",
							},
						},
						500,
					);
				}
		} else {
				// Subscription lifecycle/trial state is not evidence of payment.
				logger.info({ type: event.type }, "[polar] webhook acknowledged without credit");
				await markEventProcessed(eventId);
		}

		logPaymentEvent({
				kind: "polar",
				outcome: "settled",
				userId: userId ?? undefined,
				amountCents: appliedOrderDeltaCents,
				signature: eventId,
				latencyMs: Date.now() - startedAt,
		});
		return c.json({ ok: true });
}

/**
	* Mark a webhook event as processed. Guards against double-processing by
	* only updating rows where `processed = 0`. Source of truth remains the
	* unique constraint on `polarEventId` (insert path); this is a defensive
	* belt-and-suspenders.
	*/
async function markEventProcessed(eventId: string): Promise<void> {
		await db
				.update(polarWebhookEvents)
				.set({ processed: 1 })
				.where(
						sql`${polarWebhookEvents.polarEventId} = ${eventId} AND ${polarWebhookEvents.processed} = 0`,
				);
}

/** Claim the event and apply its balance change atomically. Concurrent retries
 * wait for this update's row lock, then skip the already-completed event.
 * A failed step rolls back the claim so Polar can retry the grant/refund. */
async function processInTransaction(
		eventId: string,
		step: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>,
): Promise<void> {
		try {
				await db.transaction(async (tx) => {
						const claimed = await tx.update(polarWebhookEvents).set({ processed: 1 })
							.where(sql`${polarWebhookEvents.polarEventId} = ${eventId} AND ${polarWebhookEvents.processed} = 0`)
							.returning({ id: polarWebhookEvents.id });
						if (claimed.length === 0) return;
						await step(tx);
				});
		} catch (err) {
				logger.error(
						{ err, eventId },
						"[polar] transactional processing step failed",
				);
				throw err;
		}
}

// Signature verification is the security boundary. Keep webhook delivery
// available during Redis outages with the bounded in-process fallback cap.
const polarWebhookRateLimit = rateLimit({
	windowMs: 60_000,
	maxRequests: 1000,
	keyPrefix: "polar-webhook",
	failClosed: false,
});

polarRoutes.post("/webhooks/polar", polarWebhookRateLimit, polarWebhookHandler);
polarRoutes.post("/api/webhook/polar", polarWebhookRateLimit, polarWebhookHandler);
