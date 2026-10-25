import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { sql } from "drizzle-orm";

const fixture = vi.hoisted(() => ({
	url: process.env.CREDIT_TEST_DATABASE_URL,
	schema: `polar_webhook_test_${process.pid}`,
	secret: "whsec_cG9sYXItd2ViaG9vay10ZXN0LWtleQ==",
}));
vi.mock("../db/client.js", async () => {
	const { default: pg } = await import("pg");
	const { drizzle } = await import("drizzle-orm/node-postgres");
	const schema = await import("../db/schema.js");
	const pool = new pg.Pool({ connectionString: fixture.url, options: `-c search_path=${fixture.schema}` });
	return { db: drizzle(pool, { schema }), testPool: pool };
});
vi.mock("../config.js", () => ({ config: {
	POLAR_WEBHOOK_SECRET: fixture.secret, POLAR_BUILDER_PRODUCT_ID: "prod_builder",
	POLAR_HOBBY_PRODUCT_ID: "prod_hobby",
}, isProductionEnv: false }));
vi.mock("../middleware/rate-limit.js", () => ({ rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../auth/middleware.js", () => ({ sessionOrBearerAuth: async (_c: unknown, next: () => Promise<void>) => next() }));

import { db } from "../db/client.js";
import { polarRoutes } from "../routes/polar.js";
import { failInferenceReservation, reserveInferenceCredits, settleInferenceReservation } from "../inference/credit-reservations.js";

const app = new Hono().route("/", polarRoutes);
const query = (text: string) => db.execute(sql.raw(text));
let schemaCreated = false;
const paid = { type: "order.paid", data: {
	id: "order-a", paid: true, product_id: "prod_builder", product: { id: "prod_builder" }, metadata: { userId: "buyer" },
	net_amount: 5000, refunded_amount: 0, refunded_tax_amount: 0, applied_balance_amount: 0, currency: "usd",
} };
const refund = (refundedAmount = 5000, extra: Partial<typeof paid.data> = {}) => ({
	type: "order.refunded", data: { ...paid.data, refunded_amount: refundedAmount, ...extra },
});

function deliver(id: string, event: unknown = paid, options: { standard?: boolean; multiple?: boolean; timestamp?: number; tamper?: boolean } = {}) {
	const body = JSON.stringify(event);
	const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
	const key = options.standard ? Buffer.from(fixture.secret.slice(6), "base64") : fixture.secret;
	const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
	return app.request("/webhooks/polar", {
		method: "POST", body: options.tamper ? body.replace("buyer", "intruder") : body,
		headers: { "webhook-id": id, "webhook-timestamp": String(timestamp),
			"webhook-signature": `${options.multiple ? "v1,aW52YWxpZA== " : ""}v1,${signature}` },
	});
}
async function balance() {
	return Number((await query("select balance_cents from credit_balances where user_id = 'buyer'")).rows[0]?.balance_cents ?? 0);
}

describe.skipIf(!fixture.url)("Polar signed deliveries (Postgres)", () => {
	beforeAll(async () => {
		if (!fixture.url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(fixture.url).hostname)) throw new Error("Use local Postgres only");
		await query(`create schema "${fixture.schema}"`);
		schemaCreated = true;
		const journal = JSON.parse(await readFile(new URL("../db/migrations/meta/_journal.json", import.meta.url), "utf8"));
		for (const migration of journal.entries) {
			const source = await readFile(new URL(`../db/migrations/${migration.tag}.sql`, import.meta.url), "utf8");
			await query(source.replaceAll('"public".', `"${fixture.schema}".`));
		}
	});
	beforeEach(async () => {
		await query('truncate table "user", polar_webhook_events cascade');
		await query("truncate inference_financial_receipts");
		await query(`insert into "user" (id, name, email) values ('buyer', 'Buyer', 'buyer@example.test')`);
	});
	afterAll(async () => {
		if (schemaCreated) await query(`drop schema "${fixture.schema}" cascade`);
		const { testPool } = await import("../db/client.js") as unknown as { testPool: { end(): Promise<void> } };
		await testPool.end();
	});

	it("credits concurrent redeliveries exactly once and acknowledges every retry", async () => {
		// Keep the first grant in flight long enough for retries to reach the
		// event guard. This catches a guard checked outside the credit transaction.
		await query(`create function delay_grant() returns trigger language plpgsql as $$ begin perform pg_sleep(0.1); return NEW; end $$`);
		await query(`create trigger delay_grant before insert on credit_balances for each row execute function delay_grant()`);
		let responses: Response[];
		try {
			responses = await Promise.all(Array.from({ length: 8 }, () => deliver("same-paid-event")));
		} finally {
			await query("drop trigger delay_grant on credit_balances");
			await query("drop function delay_grant()");
		}
		expect(responses.map(r => r.status)).toEqual(Array(8).fill(200));
		expect(await balance()).toBe(5000);
		expect((await deliver("same-paid-event")).status).toBe(200);
		expect(await balance()).toBe(5000);
	});

	it("resumes an unprocessed event after a prior delivery failed", async () => {
		await db.execute(sql`insert into polar_webhook_events (polar_event_id, event_type, payload, processed) values ('pending-event', 'order.paid', ${JSON.stringify(paid)}, 0)`);
		expect((await deliver("pending-event")).status).toBe(200);
		expect(await balance()).toBe(5000);
	});

	it("rolls back the event claim with a failed grant so a later retry can credit", async () => {
		await query(`delete from "user" where id = 'buyer'`);
		expect((await deliver("failed-grant")).status).toBeGreaterThanOrEqual(500);
		expect((await query("select processed from polar_webhook_events")).rows[0]?.processed).toBe(0);
		await query(`insert into "user" (id, name, email) values ('buyer', 'Buyer', 'buyer@example.test')`);
		expect((await deliver("failed-grant")).status).toBe(200);
		expect(await balance()).toBe(5000);
	});

	it("drains a refunded event only once under concurrent delivery", async () => {
		await deliver("purchase-a");
		await deliver("purchase-b", { ...paid, data: { ...paid.data, id: "order-b" } });
		const responses = await Promise.all(Array.from({ length: 8 }, () => deliver("same-refund", refund())));
		expect(responses.map(r => r.status)).toEqual(Array(8).fill(200));
		expect(await balance()).toBe(5000);
	});

	it("grants one order once even when paid notifications have different event IDs", async () => {
		const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => deliver(`paid-${i}`)));
		expect(responses.map(r => r.status)).toEqual(Array(8).fill(200));
		expect(await balance()).toBe(5000);
	});

	it("reverses only the cumulative partial refund, ignoring duplicate and older snapshots", async () => {
		await deliver("paid");
		expect((await deliver("partial", refund(1000))).status).toBe(200);
		expect(await balance()).toBe(4000);
		const responses = await Promise.all([deliver("partial-again", refund(1000)), deliver("newer", refund(3000)), deliver("older", refund(500))]);
		expect(responses.map(r => r.status)).toEqual([200, 200, 200]);
		expect(await balance()).toBe(2000);
		expect((await deliver("full", refund())).status).toBe(200);
		expect((await deliver("full-new-event", refund())).status).toBe(200);
		expect(await balance()).toBe(0);
	});

	it("prorates discounted orders exactly at ledger precision and excludes refunded tax", async () => {
		await deliver("paid", { ...paid, data: { ...paid.data, net_amount: 3 } });
		await deliver("partial-1", refund(1, { net_amount: 3, refunded_tax_amount: 1 }));
		expect((await query("select balance_cents from credit_balances")).rows[0].balance_cents).toBe("3333.33333334");
		await deliver("partial-2", refund(2, { net_amount: 3, refunded_tax_amount: 1 }));
		expect((await query("select balance_cents from credit_balances")).rows[0].balance_cents).toBe("1666.66666667");
		await deliver("full", refund(3, { net_amount: 3, refunded_tax_amount: 1 }));
		expect(await balance()).toBe(0);
	});

	it("caps stacked provider refund rounding at the original grant without rejecting the final snapshot", async () => {
		// Polar issue 13770: net 52 + tax 10 can yield cumulative net refund
		// 53 after stacked partial refunds, while cash refunded stays bounded.
		await deliver("paid", { ...paid, data: { ...paid.data, net_amount: 52, tax_amount: 10 } });
		expect((await deliver("prior-partial", refund(50, { net_amount: 52, refunded_tax_amount: 8 }))).status).toBe(200);
		expect((await query("select balance_cents from credit_balances")).rows[0].balance_cents).toBe("192.30769231");
		expect((await deliver("provider-over-net", refund(53, { net_amount: 52, refunded_tax_amount: 8 }))).status).toBe(200);
		expect(await balance()).toBe(0);
		const responses = await Promise.all([
			deliver("same-final-different-event", refund(53, { net_amount: 52 })),
			deliver("later-provider-over-net", refund(54, { net_amount: 52 })),
			deliver("stale-partial", refund(50, { net_amount: 52 })),
		]);
		expect(responses.map(r => r.status)).toEqual([200, 200, 200]);
		expect((await query("select balance_cents,total_deposited_cents from credit_balances")).rows[0]).toEqual({ balance_cents: "0.00000000", total_deposited_cents: "0.00000000" });
		const raw = (await query("select payload from polar_webhook_events where polar_event_id='provider-over-net'")).rows[0].payload;
		expect(JSON.parse(String(raw)).data.refunded_amount).toBe(53);
		const ledger = (await query("select payload from polar_webhook_events where polar_event_id='order-credit:order-a'")).rows[0].payload;
		expect(JSON.parse(String(ledger)).refundedAmount).toBe(52);
	});

	it("handles a refund arriving before paid without a later regrant", async () => {
		expect((await deliver("refund-first", refund(3000))).status).toBe(200);
		expect(await balance()).toBe(2000);
		expect((await deliver("paid-late")).status).toBe(200);
		expect(await balance()).toBe(2000);
		await deliver("refund-full", refund());
		await deliver("paid-replayed");
		expect(await balance()).toBe(0);
	});

	it("retains refund debt when in-flight inference settles and blocks new admission", async () => {
		await deliver("paid");
		await reserveInferenceCredits("buyer", "held-request", 4999);
		await deliver("refund", refund());
		expect(await balance()).toBe(-4999);
		await db.transaction(tx => settleInferenceReservation(tx, "buyer", "held-request", 1, true));
		expect(await balance()).toBe(-1);
		await expect(reserveInferenceCredits("buyer", "next-request", 1)).rejects.toMatchObject({ status: 402 });
		await deliver("new-funding", { ...paid, data: { ...paid.data, id: "order-b" } });
		expect(await balance()).toBe(4999);
		await deliver("refund-redelivery", refund());
		expect(await balance()).toBe(4999);
	});

	it("offsets refund debt when a proven pre-execution rejection releases a hold exactly once", async () => {
		await deliver("paid");
		await reserveInferenceCredits("buyer", "rejected-request", 4999);
		await deliver("refund", refund());
		await failInferenceReservation("rejected-request", true);
		await failInferenceReservation("rejected-request", true);
		expect(await balance()).toBe(0);
		expect((await query("select state from inference_credit_reservations")).rows[0].state).toBe("released");
	});

	it("keeps ambiguous inference collateral and its refund debt for reconciliation", async () => {
		await deliver("paid");
		await reserveInferenceCredits("buyer", "uncertain-request", 4999);
		await deliver("refund", refund());
		await failInferenceReservation("uncertain-request", false);
		await failInferenceReservation("uncertain-request", true);
		await deliver("refund-again", refund());
		expect(await balance()).toBe(-4999);
		expect((await query("select state from inference_credit_reservations")).rows[0].state).toBe("reconciliation");
	});

	it("serializes increasing refunds with hold settlement and distinct event redeliveries", async () => {
		await deliver("paid");
		await reserveInferenceCredits("buyer", "racing-request", 4999);
		const responses = await Promise.all([
			...Array.from({ length: 8 }, (_, i) => deliver(`refund-${i}`, refund(i % 2 ? 5000 : 2500))),
			db.transaction(tx => settleInferenceReservation(tx, "buyer", "racing-request", 1, true)),
		]);
		expect(responses.slice(0, 8).map(r => (r as Response).status)).toEqual(Array(8).fill(200));
		expect(await balance()).toBe(-1);
	});

	it.each([
		{ metadata: { userId: "other" } }, { net_amount: 4000 }, { currency: "eur" },
		{ product_id: "prod_hobby", product: { id: "prod_hobby" } },
	])("refuses a changed order identity without moving either account's credit: %j", async extra => {
		await deliver("paid");
		await query(`insert into "user" (id, name, email) values ('other', 'Other', 'other@example.test')`);
		const response = await deliver("wrong-owner", refund(1000, extra));
		expect(response.status).toBeGreaterThanOrEqual(500);
		expect(await balance()).toBe(5000);
		expect((await query("select processed from polar_webhook_events where polar_event_id='wrong-owner'")).rows[0].processed).toBe(0);
	});

	it("rolls back the refund snapshot and balance together so retry can reverse once", async () => {
		await deliver("paid");
		await query(`create function reject_refund() returns trigger language plpgsql as $$ begin raise exception 'fixture refund outage'; end $$`);
		await query(`create trigger reject_refund before update on credit_balances for each row execute function reject_refund()`);
		try {
			expect((await deliver("retry-refund", refund(1000))).status).toBeGreaterThanOrEqual(500);
			expect(await balance()).toBe(5000);
			expect((await query("select processed from polar_webhook_events where polar_event_id='retry-refund'")).rows[0].processed).toBe(0);
		} finally {
			await query("drop trigger reject_refund on credit_balances");
			await query("drop function reject_refund()");
		}
		expect((await deliver("retry-refund", refund(1000))).status).toBe(200);
		expect(await balance()).toBe(4000);
		expect((await deliver("new-delivery", refund(1000))).status).toBe(200);
		expect(await balance()).toBe(4000);
	});

	it("retains pre-ledger orders for opening reconciliation instead of granting them twice", async () => {
		await query("insert into credit_balances(user_id,balance_cents,total_deposited_cents) values ('buyer',5000,5000)");
		await db.execute(sql`insert into polar_webhook_events(polar_event_id,event_type,payload,processed) values ('legacy-paid','order.paid',${JSON.stringify(paid)},1)`);
		expect((await deliver("new-paid-delivery")).status).toBeGreaterThanOrEqual(500);
		expect(await balance()).toBe(5000);
		expect((await query("select processed from polar_webhook_events where polar_event_id='new-paid-delivery'")).rows[0].processed).toBe(0);
	});

	it.each([
		{ id: "" }, { net_amount: 0 }, { net_amount: 1.5 }, { refunded_amount: -1 },
		{ refunded_amount: Number.MAX_SAFE_INTEGER + 1 }, { applied_balance_amount: 100 }, { currency: "invalid" },
	])("retains invalid order snapshots for retry without granting or reversing credit: %j", async extra => {
		const response = await deliver("invalid-order", { type: "order.refunded", data: { ...paid.data, ...extra } });
		expect(response.status).toBeGreaterThanOrEqual(500);
		expect(await balance()).toBe(0);
		expect((await query("select processed from polar_webhook_events where polar_event_id='invalid-order'")).rows[0].processed).toBe(0);
	});

	it.each([{ standard: true }, { multiple: true }])("accepts Polar-supported signature format %j", async (options) => {
		expect((await deliver("signed-event", paid, options)).status).toBe(200);
		expect(await balance()).toBe(5000);
	});

	it("acknowledges subscription lifecycle without granting and credits only distinct paid orders", async () => {
		const subscription = (type: string, period: string) => ({ type, data: { ...paid.data, status: "active", current_period_start: period } });
		for (const [id, type] of [["created", "subscription.created"], ["active", "subscription.active"], ["updated", "subscription.updated"]]) {
			expect((await deliver(id, subscription(type, "2026-10-01T00:00:00Z"))).status).toBe(200);
		}
		expect(await balance()).toBe(0);
		expect((await deliver("paid-order")).status).toBe(200);
		expect(await balance()).toBe(5000);
		expect((await deliver("next-period", subscription("subscription.active", "2026-11-01T00:00:00Z"))).status).toBe(200);
		expect(await balance()).toBe(5000);
		expect((await deliver("renewal-paid", { ...paid, data: { ...paid.data, id: "renewal-order" } })).status).toBe(200);
		expect(await balance()).toBe(10000);
	});

	it("does not fund an unpaid trial from subscription state", async () => {
		expect((await deliver("trial-created", { type: "subscription.created", data: { ...paid.data, status: "trialing" } })).status).toBe(200);
		expect((await deliver("trial-updated", { type: "subscription.updated", data: { ...paid.data, status: "trialing" } })).status).toBe(200);
		expect(await balance()).toBe(0);
	});

	it.each([{ tamper: true }, { timestamp: 1 }])("rejects unauthentic or expired deliveries %j", async (options) => {
		expect((await deliver("rejected-event", paid, options)).status).toBe(401);
		expect(await balance()).toBe(0);
		expect((await query("select * from polar_webhook_events")).rows).toHaveLength(0);
	});
});
