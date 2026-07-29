/**
 * Polar.sh billing integration — production-ready.
 *
 * Endpoints:
 *   GET  /v1/polar/plans           — list configured Polar products (admin-curated)
 *   POST /v1/polar/checkout        — create a Polar checkout session for a productId
 *   GET  /v1/polar/subscription    — current user's active subscription (if any)
 *   GET  /v1/polar/orders          — current user's recent orders
 *   POST /v1/polar/portal          — redirect to Polar's hosted customer portal
 *   POST /webhooks/polar           — Polar webhook receiver (Standard Webhooks)
 *   POST /api/webhook/polar        — alias for /webhooks/polar (dual-mount per skill spec)
 *
 * Behavior contract:
 *   - All `/v1/polar/*` endpoints require `sessionOrBearerAuth`; `c.var.userId`
 *     is populated by the middleware and used as the `externalCustomerId` for
 *     Polar customer creation.
 *   - Webhook handler is UNAUTHENTICATED but verifies the `webhook-id` /
 *     `webhook-timestamp` / `webhook-signature` Standard Webhooks headers
 *     against POLAR_WEBHOOK_SECRET using `validateEvent` from
 *     `@polar-sh/sdk/webhooks`. Re-deliveries are deduped on `polar_event_id`.
 *   - When POLAR_ACCESS_TOKEN / POLAR_WEBHOOK_SECRET are missing OR are
 *     obvious placeholders (`polar_oat_...`, `polar_whsec_...`), every
 *     endpoint returns 503 `polar_not_configured` so the UI can degrade
 *     gracefully. The placeholder-guard prevents the `Polar SDK client
 *     is null` pitfall from the polar-integration skill.
 *
 * Dual webhook mount is intentional: Polar's dashboard registers one URL
 * per webhook endpoint, and operators forget which convention their server
 * uses. Mounting both means the same handler fires regardless of which
 * URL Polar delivers to.
 */
import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { Polar } from "@polar-sh/sdk";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { config } from "../config.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import {
	polarCustomers,
	polarSubscriptions,
	polarOrders,
	polarWebhookEvents,
} from "../db/schema.js";
import { logger } from "../lib/logger.js";
import type { Context } from "hono";
import type { OmaEnv } from "../types.js";

// ---------------------------------------------------------------------------
// Bootstrap guards — the polar-integration skill warns that `new Polar(...)`
// returns a nullable client. Detect placeholder tokens before constructing
// the client so we can short-circuit to 503 without TS18047 noise.
// ---------------------------------------------------------------------------

/**
 * Obvious placeholder strings that ship in .env.example. We refuse to
 * construct the SDK client against these because Polar returns
 * `401 invalid_token` for them, which masks the real "you forgot to set
 * the env var" diagnostic.
 */
const PLACEHOLDER_TOKENS = new Set([
	"polar_oat_...",
	"polar_oat_test",
	"",
]);

function isRealPolarToken(t: string | undefined): t is string {
	return typeof t === "string" && t.length >= 20 && !PLACEHOLDER_TOKENS.has(t);
}

/** True iff both env vars are set to real values, not placeholders. */
export function polarEnabled(): boolean {
	return isRealPolarToken(config.POLAR_ACCESS_TOKEN) &&
		isRealPolarToken(config.POLAR_WEBHOOK_SECRET);
}

/** Construct the SDK client; returns `null` when env is misconfigured. */
export function getPolarClient(): Polar | null {
	if (!polarEnabled()) return null;
	return new Polar({
		accessToken: config.POLAR_ACCESS_TOKEN,
		server: (config.POLAR_SERVER as "production" | "sandbox" | undefined) ?? "production",
	});
}

// ---------------------------------------------------------------------------
// Curated plan catalog (mirrors what polar-integration skill shipped to
// cheapai/datavalid/proxyresell — admin edits this file when adding plans).
// Polar product IDs are environment-specific; hardcoding them here keeps
// the frontend dumb. Use `POLAR_<NAME>_PRODUCT_ID` env vars per plan.
// ---------------------------------------------------------------------------

interface PolarPlan {
	id: string;
	name: string;
	description: string;
	priceCents: number;
	currency: "USD";
	interval: "month";
	/** Polar product UUID; sourced from `POLAR_<NAME>_PRODUCT_ID` env. */
	productId: string | undefined;
	features: string[];
}

function readPlanCatalog(): PolarPlan[] {
	return [
		{
			id: "hobby",
			name: "Hobby",
			description: "For experimenting with the OMA gateway.",
			priceCents: 900,
			currency: "USD",
			interval: "month",
			productId: config.POLAR_HOBBY_PRODUCT_ID,
			features: ["$5 in API credits", "Standard rate limits", "Community support"],
		},
		{
			id: "builder",
			name: "Builder",
			description: "For shipping a real product on top of OMA.",
			priceCents: 4900,
			currency: "USD",
			interval: "month",
			productId: config.POLAR_BUILDER_PRODUCT_ID,
			features: ["$40 in API credits", "Higher rate limits", "Email support"],
		},
		{
			id: "scale",
			name: "Scale",
			description: "Production workloads with custom needs.",
			priceCents: 49900,
			currency: "USD",
			interval: "month",
			productId: config.POLAR_SCALE_PRODUCT_ID,
			features: ["$500 in API credits", "Priority routing", "Dedicated Slack"],
		},
	];
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export const polarRoutes = new Hono<OmaEnv>();

// All authenticated endpoints share this middleware.
polarRoutes.use("/v1/polar/*", sessionOrBearerAuth);
polarRoutes.use("/v1/polar/*", async (c, next) => {
	if (!polarEnabled()) {
		return c.json(
			{ error: { message: "Polar.sh is not configured", type: "polar_not_configured" } },
			503,
		);
	}
	await next();
});

/**
 * GET /v1/polar/plans — list the curated plans available for checkout.
 * Used by /pricing and the dashboard subscription card.
 */
polarRoutes.get("/v1/polar/plans", (c) => {
	const plans = readPlanCatalog().map((p) => ({
		id: p.id,
		name: p.name,
		description: p.description,
		priceCents: p.priceCents,
		currency: p.currency,
		interval: p.interval,
		features: p.features,
		// Omit productId from the public response — it's a secret-ish
		// identifier that only the server needs.
		available: typeof p.productId === "string" && p.productId.length > 0,
	}));
	return c.json({ plans });
});

/**
 * POST /v1/polar/checkout — body: { planId: string }
 * Returns the URL to redirect the user to Polar's hosted checkout page.
 */
polarRoutes.post("/v1/polar/checkout", async (c) => {
	const polar = getPolarClient();
	if (!polar) {
		return c.json(
			{ error: { message: "Polar.sh is not configured", type: "polar_not_configured" } },
			503,
		);
	}

	const userId = c.var.userId;
	if (!userId) {
		return c.json({ error: { message: "Unauthorized", type: "auth_required" } }, 401);
	}

	let body: { planId?: string };
	try {
		body = (await c.req.json()) as { planId?: string };
	} catch {
		return c.json({ error: { message: "Invalid JSON body", type: "validation_error" } }, 400);
	}
	const plan = readPlanCatalog().find((p) => p.id === body.planId);
	if (!plan || !plan.productId) {
		return c.json(
			{ error: { message: `Unknown planId: ${body.planId ?? "(none)"}`, type: "plan_not_found" } },
			404,
		);
	}

	try {
		// Ensure we have a Polar customer row for this user.
		const existing = await db
			.select()
			.from(polarCustomers)
			.where(eq(polarCustomers.userId, userId))
			.limit(1);

		let polarCustomerId = existing[0]?.polarCustomerId;
		if (!polarCustomerId) {
			// Create the Polar customer with `externalId` = our userId so we
			// can reconcile webhooks back to a local user without storing
			// Polar-internal ids in cookies.
			const created = await polar.customers.create({
				externalId: userId,
				email: existing[0]?.email ?? undefined,
			} as Parameters<typeof polar.customers.create>[0]);
			polarCustomerId = created.id;
			if (existing.length > 0) {
				await db
					.update(polarCustomers)
					.set({ polarCustomerId, updatedAt: new Date() })
					.where(eq(polarCustomers.id, existing[0].id));
			} else {
				await db.insert(polarCustomers).values({
					userId,
					polarCustomerId,
				});
			}
		}

		const checkout = await polar.checkouts.create({
			products: [plan.productId],
			customerId: polarCustomerId,
			successUrl: `${config.PUBLIC_APP_URL}/settings?polar=success&checkout_id={CHECKOUT_ID}`,
			cancelUrl: `${config.PUBLIC_APP_URL}/settings?polar=cancelled`,
		} as Parameters<typeof polar.checkouts.create>[0]);

		return c.json({ url: checkout.url, id: checkout.id });
	} catch (err) {
		logger.error({ err, userId, planId: plan.id }, "[polar] checkout failed");
		return c.json(
			{
				error: {
					message: err instanceof Error ? err.message : "Polar checkout failed",
					type: "polar_checkout_failed",
				},
			},
			502,
		);
	}
});

/**
 * GET /v1/polar/subscription — current user's active subscription (if any).
 */
polarRoutes.get("/v1/polar/subscription", async (c) => {
	const userId = c.var.userId;
	if (!userId) {
		return c.json({ error: { message: "Unauthorized", type: "auth_required" } }, 401);
	}

	const result = await db
		.select({
			id: polarSubscriptions.id,
			polarSubscriptionId: polarSubscriptions.polarSubscriptionId,
			polarProductId: polarSubscriptions.polarProductId,
			status: polarSubscriptions.status,
			currentPeriodStart: polarSubscriptions.currentPeriodStart,
			currentPeriodEnd: polarSubscriptions.currentPeriodEnd,
			cancelAtPeriodEnd: polarSubscriptions.cancelAtPeriodEnd,
		})
		.from(polarSubscriptions)
		.innerJoin(polarCustomers, eq(polarSubscriptions.customerId, polarCustomers.id))
		.where(eq(polarCustomers.userId, userId))
		.orderBy(sql`${polarSubscriptions.createdAt} DESC`)
		.limit(1);

	const sub = result[0];
	if (!sub) {
		return c.json({ subscription: null });
	}
	// Match a curated plan by productId so the UI can show "Builder" / "Scale" etc.
	const plan = readPlanCatalog().find((p) => p.productId === sub.polarProductId);
	return c.json({
		subscription: {
			...sub,
			planId: plan?.id ?? null,
			planName: plan?.name ?? null,
		},
	});
});

/**
 * GET /v1/polar/orders — current user's recent Polar orders (invoices).
 */
polarRoutes.get("/v1/polar/orders", async (c) => {
	const userId = c.var.userId;
	if (!userId) {
		return c.json({ error: { message: "Unauthorized", type: "auth_required" } }, 401);
	}

	const limitRaw = new URL(c.req.url).searchParams.get("limit");
	const limit = Math.min(Math.max(Number(limitRaw ?? 20) || 20, 1), 100);

	const rows = await db
		.select({
			id: polarOrders.id,
			polarOrderId: polarOrders.polarOrderId,
			polarProductId: polarOrders.polarProductId,
			amount: polarOrders.amount,
			currency: polarOrders.currency,
			status: polarOrders.status,
			createdAt: polarOrders.createdAt,
		})
		.from(polarOrders)
		.innerJoin(polarCustomers, eq(polarOrders.customerId, polarCustomers.id))
		.where(eq(polarCustomers.userId, userId))
		.orderBy(sql`${polarOrders.createdAt} DESC`)
		.limit(limit);

	return c.json({ orders: rows });
});

/**
 * POST /v1/polar/portal — redirect to Polar's hosted customer portal so the
 * user can update card / cancel / download invoices without us building
 * those flows ourselves.
 */
polarRoutes.post("/v1/polar/portal", async (c) => {
	const polar = getPolarClient();
	if (!polar) {
		return c.json(
			{ error: { message: "Polar.sh is not configured", type: "polar_not_configured" } },
			503,
		);
	}

	const userId = c.var.userId;
	if (!userId) {
		return c.json({ error: { message: "Unauthorized", type: "auth_required" } }, 401);
	}

	const row = (
		await db
			.select()
			.from(polarCustomers)
			.where(eq(polarCustomers.userId, userId))
			.limit(1)
	)[0];
	if (!row) {
		return c.json(
			{ error: { message: "No Polar customer linked to this account yet", type: "no_polar_customer" } },
			404,
		);
	}

	try {
		const session = await polar.customerSessions.create({
			customerId: row.polarCustomerId,
			returnUrl: `${config.PUBLIC_APP_URL}/settings?polar=portal-return`,
		} as Parameters<typeof polar.customerSessions.create>[0]);
		return c.json({ url: session.customerPortalUrl });
	} catch (err) {
		logger.error({ err, userId }, "[polar] portal session failed");
		return c.json(
			{
				error: {
					message: err instanceof Error ? err.message : "Portal session failed",
					type: "polar_portal_failed",
				},
			},
			502,
		);
	}
});

// ---------------------------------------------------------------------------
// Webhook handler — UNAUTHENTICATED, signature-verified via Standard Webhooks.
// Shared between /webhooks/polar and /api/webhook/polar per the dual-mount
// guidance in the polar-integration skill.
// ---------------------------------------------------------------------------

interface PolarEvent {
	id: string;
	type: string;
	data: unknown;
	timestamp?: string;
}

async function handlePolarEvent(event: PolarEvent): Promise<{ handled: string; ok: boolean }> {
	const data = event.data as Record<string, unknown> | null | undefined;

	switch (event.type) {
		case "customer.created":
		case "customer.updated": {
			const customer = data as { id: string; email?: string | null } | undefined;
			if (!customer?.id) return { handled: "no customer id", ok: false };
			// Upsert by polar_customer_id; userId is null until the customer
			// checks out (we create the customer pre-checkout with externalId,
			// so a webhook with externalId is what we'd actually want).
			const externalId = (data as { external_id?: string })?.external_id;
			if (externalId) {
				const existing = await db
					.select()
					.from(polarCustomers)
					.where(eq(polarCustomers.userId, externalId))
					.limit(1);
				if (existing.length > 0) {
					await db
						.update(polarCustomers)
						.set({
							polarCustomerId: customer.id,
							email: customer.email ?? existing[0].email,
							updatedAt: new Date(),
						})
						.where(eq(polarCustomers.id, existing[0].id));
				} else {
					await db.insert(polarCustomers).values({
						userId: externalId,
						polarCustomerId: customer.id,
						email: customer.email ?? null,
					});
				}
			}
			return { handled: "upsert customer", ok: true };
		}

		case "subscription.created":
		case "subscription.updated": {
			const sub = data as {
				id: string;
				customer: { id: string };
				product: { id: string };
				status: string;
				current_period_start?: string | number;
				current_period_end?: string | number;
				cancel_at_period_end?: boolean;
			};
			const customer = (
				await db
					.select()
					.from(polarCustomers)
					.where(eq(polarCustomers.polarCustomerId, sub.customer.id))
					.limit(1)
			)[0];
			if (!customer) {
				return { handled: "customer not linked", ok: false };
			}
			const periodStart = sub.current_period_start
				? new Date(Number(sub.current_period_start) * 1000)
				: null;
			const periodEnd = sub.current_period_end
				? new Date(Number(sub.current_period_end) * 1000)
				: null;
			await db
				.insert(polarSubscriptions)
				.values({
					customerId: customer.id,
					polarSubscriptionId: sub.id,
					polarProductId: sub.product.id,
					status: sub.status,
					currentPeriodStart: periodStart,
					currentPeriodEnd: periodEnd,
					cancelAtPeriodEnd: sub.cancel_at_period_end ? 1 : 0,
				})
				.onConflictDoUpdate({
					target: polarSubscriptions.polarSubscriptionId,
					set: {
						polarProductId: sub.product.id,
						status: sub.status,
						currentPeriodStart: periodStart,
						currentPeriodEnd: periodEnd,
						cancelAtPeriodEnd: sub.cancel_at_period_end ? 1 : 0,
						updatedAt: new Date(),
					},
				});
			return { handled: "upsert subscription", ok: true };
		}

		case "subscription.canceled": {
			const sub = data as { id: string };
			await db
				.update(polarSubscriptions)
				.set({ status: "canceled", updatedAt: new Date() })
				.where(eq(polarSubscriptions.polarSubscriptionId, sub.id));
			return { handled: "cancel subscription", ok: true };
		}

		case "order.paid":
		case "order.created": {
			const order = data as {
				id: string;
				customer: { id: string };
				product?: { id: string } | null;
				amount: number;
				currency?: string;
				status?: string;
			};
			const customer = (
				await db
					.select()
					.from(polarCustomers)
					.where(eq(polarCustomers.polarCustomerId, order.customer.id))
					.limit(1)
			)[0];
			if (!customer) {
				return { handled: "customer not linked", ok: false };
			}
			await db
				.insert(polarOrders)
				.values({
					customerId: customer.id,
					polarOrderId: order.id,
					polarProductId: order.product?.id ?? "",
					amount: order.amount,
					currency: order.currency ?? "usd",
					status: order.status ?? "completed",
				})
				.onConflictDoNothing({ target: polarOrders.polarOrderId });
			return { handled: "record order", ok: true };
		}

		default:
			return { handled: `ignored ${event.type}`, ok: true };
	}
}

async function polarWebhookHandler(c: Context<OmaEnv>) {
	if (!polarEnabled()) {
		return c.json(
			{ error: { message: "Polar.sh is not configured", type: "polar_not_configured" } },
			503,
		);
	}

	const rawBody = await c.req.text();
	const headers = {
		"webhook-id": c.req.header("webhook-id") ?? "",
		"webhook-timestamp": c.req.header("webhook-timestamp") ?? "",
		"webhook-signature": c.req.header("webhook-signature") ?? "",
	};

	let event: PolarEvent;
	try {
		event = validateEvent(
			rawBody,
			headers,
			config.POLAR_WEBHOOK_SECRET!,
		) as unknown as PolarEvent;
	} catch (err) {
		if (err instanceof WebhookVerificationError) {
			logger.warn({ err }, "[polar] webhook signature verification failed");
			return c.json({ received: false, error: "invalid_signature" }, 403);
		}
		throw err;
	}

	// Persist + dedupe. Polar may redeliver; unique constraint on
	// `polar_event_id` enforces idempotency.
	const inserted = await db
		.insert(polarWebhookEvents)
		.values({
			polarEventId: event.id,
			eventType: event.type,
			payload: rawBody,
		})
		.onConflictDoNothing({ target: polarWebhookEvents.polarEventId })
		.returning({ id: polarWebhookEvents.id });

	if (inserted.length === 0) {
		// Duplicate delivery — nothing to do, return success so Polar stops.
		return c.json({ received: true, deduped: true, type: event.type });
	}

	const eventRowId = inserted[0].id;

	try {
		const result = await handlePolarEvent(event);
		await db
			.update(polarWebhookEvents)
			.set({ processed: 1 })
			.where(sql`${polarWebhookEvents.id} = ${eventRowId}`);
		return c.json({ received: true, type: event.type, handled: result.handled });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error({ err, eventType: event.type }, "[polar] handler failed");
		await db
			.update(polarWebhookEvents)
			.set({ processed: 0, errorMessage: message })
			.where(sql`${polarWebhookEvents.id} = ${eventRowId}`);
		// Return 500 so Polar retries.
		return c.json({ received: false, error: "handler_failed" }, 500);
	}
}

// Dual-mount: same handler at /webhooks/polar AND /api/webhook/polar.
polarRoutes.post("/webhooks/polar", polarWebhookHandler);
polarRoutes.post("/api/webhook/polar", polarWebhookHandler);