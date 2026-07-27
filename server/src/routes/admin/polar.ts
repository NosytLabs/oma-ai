/**
 * Admin-facing Polar.sh endpoints.
 *
 *   GET /v1/admin/polar/subscriptions — list active subscriptions with
 *     user + customer linkage.
 *   GET /v1/admin/polar/orders — list orders with customer + user.
 *   GET /v1/admin/polar/webhook-events — paginated webhook event log
 *     for debugging failed deliveries (processed=0 + error_message set).
 *
 * All routes inherit sessionAuth + requireAdmin from adminRoutes parent.
 */
import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
	polarCustomers,
	polarSubscriptions,
	polarOrders,
	polarWebhookEvents,
	users,
} from "../../db/schema.js";
import type { OmaEnv } from "../../types.js";

export const adminPolarRoutes = new Hono<OmaEnv>();

adminPolarRoutes.get("/v1/admin/polar/subscriptions", async (c) => {
	const limit = Math.min(
		Math.max(Number(new URL(c.req.url).searchParams.get("limit") ?? 50), 1),
		200,
	);
	const rows = await db
		.select({
			id: polarSubscriptions.id,
			polarSubscriptionId: polarSubscriptions.polarSubscriptionId,
			polarProductId: polarSubscriptions.polarProductId,
			status: polarSubscriptions.status,
			currentPeriodStart: polarSubscriptions.currentPeriodStart,
			currentPeriodEnd: polarSubscriptions.currentPeriodEnd,
			cancelAtPeriodEnd: polarSubscriptions.cancelAtPeriodEnd,
			userId: users.id,
			userAddress: users.address,
			userAccountNumber: users.accountNumber,
			polarCustomerId: polarCustomers.polarCustomerId,
			email: polarCustomers.email,
		})
		.from(polarSubscriptions)
		.innerJoin(polarCustomers, eq(polarSubscriptions.customerId, polarCustomers.id))
		.innerJoin(users, eq(polarCustomers.userId, users.id))
		.orderBy(desc(polarSubscriptions.updatedAt))
		.limit(limit);
	return c.json({ subscriptions: rows });
});

adminPolarRoutes.get("/v1/admin/polar/orders", async (c) => {
	const limit = Math.min(
		Math.max(Number(new URL(c.req.url).searchParams.get("limit") ?? 50), 1),
		200,
	);
	const rows = await db
		.select({
			id: polarOrders.id,
			polarOrderId: polarOrders.polarOrderId,
			polarProductId: polarOrders.polarProductId,
			amount: polarOrders.amount,
			currency: polarOrders.currency,
			status: polarOrders.status,
			createdAt: polarOrders.createdAt,
			userId: users.id,
			userAddress: users.address,
			email: polarCustomers.email,
		})
		.from(polarOrders)
		.innerJoin(polarCustomers, eq(polarOrders.customerId, polarCustomers.id))
		.innerJoin(users, eq(polarCustomers.userId, users.id))
		.orderBy(desc(polarOrders.createdAt))
		.limit(limit);
	return c.json({ orders: rows });
});

adminPolarRoutes.get("/v1/admin/polar/webhook-events", async (c) => {
	const url = new URL(c.req.url);
	const limit = Math.min(
		Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
		200,
	);
	const onlyFailed = url.searchParams.get("failed") === "1";

	const baseQuery = db
		.select({
			id: polarWebhookEvents.id,
			polarEventId: polarWebhookEvents.polarEventId,
			eventType: polarWebhookEvents.eventType,
			processed: polarWebhookEvents.processed,
			errorMessage: polarWebhookEvents.errorMessage,
			createdAt: polarWebhookEvents.createdAt,
		})
		.from(polarWebhookEvents);

	const rows = await (onlyFailed
		? baseQuery
				.where(eq(polarWebhookEvents.processed, 0))
				.orderBy(desc(polarWebhookEvents.createdAt))
				.limit(limit)
		: baseQuery
				.orderBy(desc(polarWebhookEvents.createdAt))
				.limit(limit));

	return c.json({
		events: rows,
		summary: {
			totalRows: rows.length,
			onlyFailed,
			// Quick counter: how many events have a non-null error_message?
			// Surface in the admin UI as a badge.
			failedCount: rows.filter((r) => r.processed === 0).length,
		},
	});
});

// Lightweight aggregate for the admin overview tile.
adminPolarRoutes.get("/v1/admin/polar/stats", async (c) => {
	const [activeSubs] = await db
		.select({ count: sql<number>`COUNT(*)::int` })
		.from(polarSubscriptions)
		.where(sql`${polarSubscriptions.status} IN ('active', 'trialing')`);
	const [totalCustomers] = await db
		.select({ count: sql<number>`COUNT(*)::int` })
		.from(polarCustomers);
	const [totalOrders] = await db
		.select({ count: sql<number>`COUNT(*)::int` })
		.from(polarOrders);
	const [failedWebhooks] = await db
		.select({ count: sql<number>`COUNT(*)::int` })
		.from(polarWebhookEvents)
		.where(eq(polarWebhookEvents.processed, 0));

	return c.json({
		activeSubscriptions: activeSubs?.count ?? 0,
		totalCustomers: totalCustomers?.count ?? 0,
		totalOrders: totalOrders?.count ?? 0,
		failedWebhooks: failedWebhooks?.count ?? 0,
	});
});