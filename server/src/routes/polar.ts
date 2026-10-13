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
	* drains the granted credits.
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
import { createHmac, timingSafeEqual } from "node:crypto";
import { createPolar, type Polar } from "@polar-sh/sdk/2026-10";
import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { requirePaymentRail } from "../middleware/payment-rail.js";
import { db } from "../db/client.js";
import {
		creditBalances,
		polarWebhookEvents,
} from "../db/schema.js";
import { config, isProductionEnv } from "../config.js";
import { logger } from "../lib/logger.js";
import { logPaymentEvent } from "../lib/payment-observability.js";
import { errorResponse } from "../lib/error-response.js";

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

/**
	* Polar webhook signature scheme (standardwebhooks):
	*   headers: webhook-id, webhook-timestamp, webhook-signature
	*   signature: v1,<base64(hmac_sha256(secret, "{id}.{timestamp}.{body}"))>
	*
	* Compare with timingSafeEqual. Reject if timestamp drift > 5 min
	* (replay protection).
	*/
function verifyPolarSignature(
		rawBody: string,
		headers: { id: string | null; ts: string | null; sig: string | null },
		secret: string,
): boolean {
		if (!headers.id || !headers.ts || !headers.sig) return false;
		const ts = Number(headers.ts);
		if (!Number.isFinite(ts)) return false;
		const now = Math.floor(Date.now() / 1000);
		if (ts > now + 30 || now - ts > 5 * 60) return false;
		const expected =
				"v1," +
				createHmac("sha256", secret)
						.update(`${headers.id}.${headers.ts}.${rawBody}`)
						.digest("base64");
		const a = Buffer.from(expected);
		const b = Buffer.from(headers.sig);
		if (a.length !== b.length) return false;
		return timingSafeEqual(a, b);
}

interface WebhookEventPayload {
		type: string;
		data?: {
				id?: string;
				status?: string;
				product?: { id?: string };
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

async function revokeUser(userId: string): Promise<void> {
		// We don't drain existing credits on cancel — they remain usable.
		// The user just won't be eligible for the next renewal's allocation.
		logger.info(
				{ userId },
				"[polar] subscription canceled (existing credits retained)",
		);
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
		const ok = verifyPolarSignature(
				rawBody,
				{
						id: eventId,
						ts: c.req.header("webhook-timestamp") ?? null,
						sig: c.req.header("webhook-signature") ?? null,
				},
				config.POLAR_WEBHOOK_SECRET,
		);
		if (!ok) {
			logger.warn("[polar] webhook signature verification failed");
			return errorResponse(c, "Invalid webhook signature", 401, { code: "invalid_signature" });
		}
		let event: WebhookEventPayload;
		try {
			event = JSON.parse(rawBody) as WebhookEventPayload;
		} catch {
			return errorResponse(c, "Request body is not valid JSON", 400, { code: "invalid_json" });
		}
		if (!eventId) {
			return errorResponse(c, "Missing Webhook-Id header", 400, { code: "missing_webhook_id" });
		}
		// Claim the event, and decide whether this delivery should actually run
		// the credit/refund step.
		//
		// BUG (audit HIGH): the original code returned `{duplicate:true}` for ANY
		// unique-constraint collision. The row is inserted with `processed = 0`
		// and committed BEFORE the credit transaction runs, so a transient failure
		// (DB blip, timeout, crash) left a row stuck at processed=0. Every
		// subsequent Polar retry then took the duplicate branch and returned 200 —
		// the customer was never credited, and nothing ever repaired it. The
		// comment below claiming the claim, the grant, and the processed flip are
		// "one transaction" was false: the claim commits on its own.
		//
		// Fix: only short-circuit when the existing row is already processed. An
		// existing processed=0 row means a prior attempt failed partway, so we
		// resume it. `processInTransaction` flips processed=1 with a
		// `processed = 0` guard, so concurrent retries can still never
		// double-credit.
		try {
			await db.insert(polarWebhookEvents).values({
				polarEventId: eventId,
				eventType: event.type,
				payload: rawBody,
				processed: 0,
			});
		} catch (err) {
			if (
				err &&
				typeof err === "object" &&
				"code" in err &&
				(err as { code?: string }).code === "23505"
			) {
				const existing = await db
					.select({ processed: polarWebhookEvents.processed })
					.from(polarWebhookEvents)
					.where(sql`${polarWebhookEvents.polarEventId} = ${eventId}`)
					.limit(1);

				if (existing[0]?.processed === 1) {
					logPaymentEvent({
						kind: "polar",
						outcome: "double_spend_blocked",
						signature: eventId,
						latencyMs: Date.now() - startedAt,
					});
					return c.json({ ok: true, duplicate: true });
				}

				// processed = 0 on an existing row => a previous delivery claimed
				// the event but never completed. Resume it rather than dropping it.
				logger.warn(
					{ eventId, eventType: event.type },
					"[polar] resuming previously-failed webhook event",
				);
			} else {
				logger.error({ err, eventId }, "[polar] failed to claim webhook event");
				return errorResponse(c, "Webhook processing is temporarily unavailable", 503, { code: "polar_claim_failed" });
			}
		}

		// SECURITY: derive credits from the server-side product→plan mapping, not
		// from webhook metadata. Metadata is attacker-controlled; a compromised
		// operator secret could otherwise credit any user any amount.
		// See audit: polar.ts:353-362 IDOR.
		const plan = planFromProductId(event.data?.product?.id) ?? null;
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

		if (event.type === "order.paid") {
				if (userId && credits) {
						// SECURITY (audit 2.2 / HIGH): wrap the credit grant + the
						// processed-flag flip in a single DB transaction. If the server
						// crashes between the two writes, a re-delivery from Polar will
						// see the webhook row exists (idempotency holds), but the
						// transaction either fully completed or rolled back — never
						// partial. The unique-constraint on `polarEventId` plus the
						// `processed = 0` guard on the update prevent double-credits.
						await processInTransaction(eventId, async (tx) => {
								await creditUserTx(tx, userId, credits as number, event.type);
								await markEventProcessedTx(tx, eventId);
						});
				} else {
					logger.error(
						{ type: event.type, hasUserId: !!userId, hasCredits: !!credits, plan, eventId },
						"[polar] order.paid missing userId or credits; returning 5xx so Polar retries",
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
								message: "order.paid missing userId or credits — not processed",
								code: "missing_credit_target",
							},
						},
						500,
					);
				}
		} else if (event.type === "order.refunded") {
				if (userId && credits) {
						await processInTransaction(eventId, async (tx) => {
								await drainUserTx(tx, userId, credits as number);
								await markEventProcessedTx(tx, eventId);
						});
				} else {
						logger.warn(
								{ type: event.type, hasUserId: !!userId, hasCredits: !!credits, plan },
								"[polar] order.refunded missing userId or credits; check product/metadata",
						);
				}
		} else if (
				event.type === "subscription.created" ||
				event.type === "subscription.active" ||
				event.type === "subscription.updated"
		) {
				if (userId && credits) {
						if (
								event.data?.status === "active" ||
								event.data?.status === "trialing" ||
								event.type === "subscription.active"
						) {
								// SECURITY (audit 2026-09-27 / P0): Polar re-delivers
								// created/active/updated for the SAME billing period with
								// DIFFERENT event ids. Event-id idempotency alone let one
								// monthly period mint credits three times. Insert a
								// synthetic period row (unique polarEventId) inside the
								// credit tx; if it already exists, this period was
								// credited and we must not credit again.
								const d = event.data as Record<string, unknown> | undefined;
								const periodStartRaw =
										(d?.current_period_start ?? d?.ended_at ?? d?.created_at) as
												| string
												| number
												| undefined;
								const periodStart = String(
										periodStartRaw ??
												eventId,
								);
								const periodKey = `period-credit-${periodStart}`;
								await processInTransaction(eventId, async (tx) => {
										const claimed = await tx
												.insert(polarWebhookEvents)
												.values({
													polarEventId: `${userId}:${periodKey}`,
													eventType: `${event.type}:period`,
													payload: JSON.stringify({ userId, period: periodStart }),
													processed: 1,
												})
												.onConflictDoNothing()
												.returning({ id: polarWebhookEvents.id });
										if (claimed.length === 0) {
												logger.warn(
														{ userId, periodStart, eventId },
														"[polar] subscription period already credited; skipping duplicate grant",
												);
												await markEventProcessedTx(tx, eventId);
												return;
										}
										await creditUserTx(tx, userId, credits as number, event.type);
										await markEventProcessedTx(tx, eventId);
								});
						} else {
								logger.info(
										{ userId, type: event.type, status: event.data?.status },
										"[polar] subscription event with non-active status; no credit",
								);
						}
				} else {
						logger.warn(
								{ type: event.type, hasUserId: !!userId, hasCredits: !!credits, plan },
								"[polar] subscription event missing userId or credits; check product/metadata",
						);
				}
		} else if (
				event.type === "subscription.canceled" ||
				event.type === "subscription.revoked"
		) {
				if (userId) {
						await revokeUser(userId);
				}
		} else {
				logger.info({ type: event.type }, "[polar] webhook event (unhandled type)");
				await markEventProcessed(eventId);
		}

		logPaymentEvent({
				kind: "polar",
				outcome: "settled",
				userId: userId ?? undefined,
				amountCents: credits ?? undefined,
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

/**
	* Run a Polar webhook processing step inside a DB transaction.
	*
	* SECURITY (audit 2.2 / HIGH): the credit grant + processed-flag flip
	* must be atomic. Without a tx, a crash between the two writes leaves
	* a row with `processed = 0` after the user has already been credited.
	* A re-delivery from Polar would see the row exists (unique constraint
	* on polarEventId) but `processed = 0`, and the next handler invocation
	* would double-credit.
	*
	* The `processed = 0` guard on the update (in markEventProcessedTx)
	* also keeps a duplicate re-delivery from re-running the credit grant
	* even if a transaction somehow commits twice.
	*/
async function processInTransaction(
		eventId: string,
		step: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>,
): Promise<void> {
		try {
				await db.transaction(async (tx) => {
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

/**
	* Inside-transaction variant of creditUser. Caller controls the tx.
	*/
async function creditUserTx(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		userId: string,
		credits: number,
		source: string,
): Promise<void> {
		await tx
				.insert(creditBalances)
				.values({
						userId,
						balanceCents: credits.toString(),
						totalDepositedCents: credits.toString(),
						totalUsedCents: "0",
				})
				.onConflictDoUpdate({
						target: creditBalances.userId,
						set: {
								balanceCents: sql`${creditBalances.balanceCents}::numeric + ${credits}::numeric`,
								totalDepositedCents: sql`${creditBalances.totalDepositedCents}::numeric + ${credits}::numeric`,
								lastActivityAt: sql`NOW()`,
						},
				});
		logger.info({ userId, credits, source }, "[polar] credited user balance");
}

/**
	* Inside-transaction variant of drainUser. Caller controls the tx.
	*/
async function drainUserTx(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		userId: string,
		credits: number,
): Promise<void> {
		// Known limitation (audit MEDIUM, not yet migrated): this drains the
		// AGGREGATE balance, not the specific grant the refund belongs to. A
		// user who buys pack A, spends it, then buys pack B will have pack B's
		// credits drained when pack A is refunded.
		//
		// The correct fix is a per-grant credit-lot ledger (FIFO consume, refund
		// reverses its own lot) plus a migration. That is a schema change and a
		// money-semantics decision, so it is NOT done blind here.
		//
		// What we DO have: GREATEST(...,0) means the balance can never go
		// negative, and capturing the post-drain balance makes an over-drain
		// visible in logs instead of silent.
		const [after] = await tx
			.update(creditBalances)
			.set({
				balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric - ${credits}::numeric, 0)`,
				totalDepositedCents: sql`GREATEST(${creditBalances.totalDepositedCents}::numeric - ${credits}::numeric, 0)`,
				lastActivityAt: sql`NOW()`,
			})
			.where(eq(creditBalances.userId, userId))
			.returning({ balanceCents: creditBalances.balanceCents });

		const remaining = after?.balanceCents != null ? Number(after.balanceCents) : null;
		if (remaining !== null && remaining === 0 && credits > 0) {
			// We asked to take more than remained. Legitimate if the user
			// already spent the credits, but it means the refund consumed
			// balance from other grants — flag it for reconciliation.
			logger.warn(
				{ userId, requested: credits, remaining },
				"[polar] refund drained balance to zero; may have consumed credits from other grants (per-grant lot ledger not yet implemented)",
			);
		}
		logger.info({ userId, credits, remaining }, "[polar] refunded; credits drained");
}

/**
	* Inside-transaction variant of markEventProcessed. Caller controls the tx.
	*/
async function markEventProcessedTx(
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
		eventId: string,
): Promise<void> {
		await tx
				.update(polarWebhookEvents)
				.set({ processed: 1 })
				.where(
						sql`${polarWebhookEvents.polarEventId} = ${eventId} AND ${polarWebhookEvents.processed} = 0`,
				);
}

// Fails OPEN on purpose.
//
// `rateLimit` defaults to `failClosed: true`, which returns 503 whenever the
// Redis backend is unreachable. The rate limiter here uses @upstash/redis
// (REST) and the deployment only sets REDIS_URL — no UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN — so `isRedisReady()` is false and EVERY Polar
// webhook delivery was rejected with 503. That silently blocks all revenue:
// the endpoint URL and signature secret are both correct, orders settle on
// Polar's side, and our ledger never gets credited.
//
// This endpoint is cryptographically signature-verified with standardwebhooks
// (see polarWebhookHandler), so an attacker cannot forge an accepted payload
// without the secret. That verification — not this limiter — is the real
// security boundary. A Redis outage must not be able to stop payments.
//
// The in-process fallback cap still applies when Redis is down, so this is
// bounded, not unlimited.
const polarWebhookRateLimit = rateLimit({
	windowMs: 60_000,
	maxRequests: 1000,
	keyPrefix: "polar-webhook",
	failClosed: false,
});

polarRoutes.post("/webhooks/polar", polarWebhookRateLimit, polarWebhookHandler);
polarRoutes.post("/api/webhook/polar", polarWebhookRateLimit, polarWebhookHandler);
