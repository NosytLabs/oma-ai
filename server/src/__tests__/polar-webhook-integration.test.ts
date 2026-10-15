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
}, isProductionEnv: false }));
vi.mock("../middleware/rate-limit.js", () => ({ rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../auth/middleware.js", () => ({ sessionOrBearerAuth: async (_c: unknown, next: () => Promise<void>) => next() }));

import { db } from "../db/client.js";
import { polarRoutes } from "../routes/polar.js";

const app = new Hono().route("/", polarRoutes);
const query = (text: string) => db.execute(sql.raw(text));
let schemaCreated = false;
const paid = { type: "order.paid", data: { product: { id: "prod_builder" }, metadata: { userId: "buyer" } } };

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
		await deliver("purchase-b");
		const refund = { ...paid, type: "order.refunded" };
		const responses = await Promise.all(Array.from({ length: 8 }, () => deliver("same-refund", refund)));
		expect(responses.map(r => r.status)).toEqual(Array(8).fill(200));
		expect(await balance()).toBe(5000);
	});

	it.each([{ standard: true }, { multiple: true }])("accepts Polar-supported signature format %j", async (options) => {
		expect((await deliver("signed-event", paid, options)).status).toBe(200);
		expect(await balance()).toBe(5000);
	});

	it("deduplicates legacy subscription notifications for the same billing period", async () => {
		const subscription = (type: string, period: string) => ({ type, data: { ...paid.data, status: "active", current_period_start: period } });
		for (const [id, type] of [["created", "subscription.created"], ["active", "subscription.active"], ["updated", "subscription.updated"]]) {
			expect((await deliver(id, subscription(type, "2026-10-01T00:00:00Z"))).status).toBe(200);
		}
		expect(await balance()).toBe(5000);
		expect((await deliver("next-period", subscription("subscription.active", "2026-11-01T00:00:00Z"))).status).toBe(200);
		expect(await balance()).toBe(10000);
	});

	it.each([{ tamper: true }, { timestamp: 1 }])("rejects unauthentic or expired deliveries %j", async (options) => {
		expect((await deliver("rejected-event", paid, options)).status).toBe(401);
		expect(await balance()).toBe(0);
		expect((await query("select * from polar_webhook_events")).rows).toHaveLength(0);
	});
});
