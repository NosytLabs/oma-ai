/**
 * Polar.sh checkout + webhook integration.
 *
 * Endpoints:
 *   POST /v1/checkout           — create a Polar checkout session
 *   POST /webhooks/polar        — handle Polar webhook events
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
import { Polar } from "@polar-sh/sdk";
import { sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { db } from "../db/client.js";
import { creditBalances, polarWebhookEvents, siteSettings } from "../db/schema.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { emitDepositMatched } from "../lib/deposit-events.js";
import { logPaymentEvent } from "../lib/payment-observability.js";

export const polarRoutes = new Hono<OmaEnv>();

const PLAN_CREDITS: Record<string, { productEnv: keyof typeof config; credits: number; label: string }> = {
	hobby: { productEnv: "POLAR_HOBBY_PRODUCT_ID", credits: 1000, label: "Hobby ($10)" },
	builder: { productEnv: "POLAR_BUILDER_PRODUCT_ID", credits: 5000, label: "Builder ($50)" },
	scale: { productEnv: "POLAR_SCALE_PRODUCT_ID", credits: 25000, label: "Scale ($250)" },
};

function getPolarClient(): Polar | null {
	if (!config.POLAR_ACCESS_TOKEN) return null;
	return new Polar({
		accessToken: config.POLAR_ACCESS_TOKEN,
		server: config.POLAR_SERVER,
	});
}

const checkoutSchema = z.object({
	plan: z.enum(["hobby", "builder", "scale"]),
	successUrl: z.string().url().optional(),
});

/**
 * POST /v1/checkout
 * Body: { plan: "hobby" | "builder" | "scale", successUrl?: string }
 * Returns: { id: string, url: string } — redirect the user to `url`.
 */
polarRoutes.post(
	"/v1/checkout",
	rateLimit({ windowMs: 60_000, maxRequests: 10 }),
	sessionOrBearerAuth,
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

		// Check if card payments are disabled by admin
		try {
			const [settings] = await db.select({ cardPaymentsEnabled: siteSettings.cardPaymentsEnabled }).from(siteSettings).limit(1);
			if (settings && !settings.cardPaymentsEnabled) {
				return c.json(
					{
						error: {
							message: "Card payments are temporarily disabled by the administrator.",
							type: "service_unavailable",
						},
					},
					503,
				);
			}
		} catch (err) {
			logger.error({ err }, "[polar] failed to check site settings for card payments");
		}

		const polar = getPolarClient();
		if (!polar) {
			return c.json(
				{
					error: {
						message: "Polar is not configured. Set POLAR_ACCESS_TOKEN + product IDs in server/.env.",
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
						message: `Plan '${parsed.data.plan}' is not configured (${plan.productEnv} missing).`,
						type: "not_configured",
					},
				},
				503,
			);
		}
		const userId = c.get("userId");
		const session = await polar.checkouts.create({
			products: [String(productId)],
			successUrl: parsed.data.successUrl ?? `${config.PUBLIC_APP_URL}/dashboard?checkout=success`,
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

function planFromProductId(productId: string | undefined): keyof typeof PLAN_CREDITS | null {
	if (!productId) return null;
	for (const [plan, info] of Object.entries(PLAN_CREDITS)) {
		if (config[info.productEnv] === productId) {
			return plan as keyof typeof PLAN_CREDITS;
		}
	}
	return null;
}

async function creditUser(userId: string, credits: number, source: string): Promise<void> {
	await db
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
	logger.info(
		{ userId, credits, source },
		"[polar] credited user balance",
	);
	// Notify any /v1/deposit/feed subscribers.
	emitDepositMatched({
		id: `polar-${Date.now()}`,
		userId,
		type: "card",
		amountUsd: (credits / 100).toFixed(2),
		creditsIssued: credits.toString(),
		txHash: null,
		status: "completed",
		createdAt: new Date(),
		completedAt: new Date(),
	});
}

async function revokeUser(userId: string): Promise<void> {
	// We don't drain existing credits on cancel — they remain usable.
	// The user just won't be eligible for the next renewal's allocation.
	logger.info({ userId }, "[polar] subscription canceled (existing credits retained)");
}

async function drainUser(userId: string, credits: number): Promise<void> {
	await db
		.insert(creditBalances)
		.values({
			userId,
			balanceCents: "0",
			totalDepositedCents: "0",
			totalUsedCents: "0",
		})
		.onConflictDoUpdate({
			target: creditBalances.userId,
			set: {
				balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric - ${credits}::numeric, 0)`,
				totalDepositedCents: sql`GREATEST(${creditBalances.totalDepositedCents}::numeric - ${credits}::numeric, 0)`,
				lastActivityAt: sql`NOW()`,
			},
		});
	logger.info({ userId, credits }, "[polar] refunded; credits drained");
}

/**
 * POST /webhooks/polar
 * Body: raw JSON of the Polar webhook event. Headers carry the
 * signature.
 */
polarRoutes.post("/webhooks/polar", async (c) => {
	if (!config.POLAR_WEBHOOK_SECRET) {
		return c.json({ error: "webhook secret not configured" }, 503);
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
		return c.json({ error: "invalid signature" }, 401);
	}
	let event: WebhookEventPayload;
	try {
		event = JSON.parse(rawBody) as WebhookEventPayload;
	} catch {
		return c.json({ error: "invalid json" }, 400);
	}
	if (!eventId) {
		return c.json({ error: "missing webhook id" }, 400);
	}
	try {
		await db.insert(polarWebhookEvents).values({
			polarEventId: eventId,
			eventType: event.type,
			payload: rawBody,
			processed: 0,
		});
	} catch (err) {
		if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
			logPaymentEvent({
				kind: "polar",
				outcome: "double_spend_blocked",
				signature: eventId,
				latencyMs: Date.now() - startedAt,
			});
			return c.json({ ok: true, duplicate: true });
		}
		logger.error({ err, eventId }, "[polar] failed to claim webhook event");
		return c.json({ error: "webhook processing unavailable" }, 503);
	}
	const plan =
		planFromProductId(event.data?.product?.id) ?? null;
	const metadata = event.data?.metadata ?? {};
	const userId = typeof metadata.userId === "string" ? metadata.userId : null;
	const creditsRaw = metadata.credits;
	const credits = typeof creditsRaw === "number" && Number.isSafeInteger(creditsRaw) && creditsRaw > 0
		? creditsRaw
		: null;

	// One-time credit purchases. Metadata set on the checkout is copied to
	// the resulting order, so we can credit the exact amount the user paid for.
	if (event.type === "order.paid") {
		if (userId && credits) {
			await creditUser(userId, credits, event.type);
		} else {
			logger.warn(
				{ type: event.type, hasUserId: !!userId, hasCredits: !!credits, plan },
				"[polar] order.paid missing userId or credits; check product/metadata",
			);
		}
	} else if (event.type === "order.refunded") {
		if (userId && credits) {
			await drainUser(userId, credits);
		} else {
			logger.warn(
				{ type: event.type, hasUserId: !!userId, hasCredits: !!credits, plan },
				"[polar] order.refunded missing userId or credits; check product/metadata",
			);
		}
	} else if (event.type === "subscription.created" || event.type === "subscription.active" || event.type === "subscription.updated") {
		if (userId && credits) {
			if (event.data?.status === "active" || event.data?.status === "trialing" || event.type === "subscription.active") {
				await creditUser(userId, credits, event.type);
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
	} else if (event.type === "subscription.canceled" || event.type === "subscription.revoked") {
		if (userId) {
			await revokeUser(userId);
		}
	} else {
		logger.info({ type: event.type }, "[polar] webhook event (unhandled type)");
	}

	await db
		.update(polarWebhookEvents)
		.set({ processed: 1 })
		.where(sql`${polarWebhookEvents.polarEventId} = ${eventId}`);
	logPaymentEvent({
		kind: "polar",
		outcome: "settled",
		userId: userId ?? undefined,
		amountCents: credits ?? undefined,
		signature: eventId,
		latencyMs: Date.now() - startedAt,
	});
	return c.json({ ok: true });
});
