import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Hono, type Context, type Next } from "hono";
import { sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";

const fixture = vi.hoisted(() => ({
	url: process.env.CREDIT_TEST_DATABASE_URL,
	schema: `refund_test_${process.pid}`,
}));
vi.mock("../db/client.js", async () => {
	const { default: pg } = await import("pg");
	const { drizzle } = await import("drizzle-orm/node-postgres");
	const schema = await import("../db/schema.js");
	const pool = new pg.Pool({ connectionString: fixture.url, options: `-c search_path=${fixture.schema}` });
	return { db: drizzle(pool, { schema }), testPool: pool };
});
// The real HTTP/auth suite covers these gates. Keep refund SQL and handlers real.
vi.mock("../auth/middleware.js", () => ({
	sessionOrBearerAuth: async (c: Context<OmaEnv>, next: Next) => {
		c.set("userId", c.req.header("X-Test-User") ?? "buyer");
		await next();
	},
	requireAdmin: () => async (_c: Context<OmaEnv>, next: Next) => next(),
}));

import { db } from "../db/client.js";
import { refundsRoutes } from "../routes/refunds.js";
import { adminRefundsRoutes } from "../routes/admin-refunds.js";
import { creditsRoutes } from "../routes/credits.js";
import { adminRoutes } from "../routes/admin.js";

const app = new Hono().route("/", refundsRoutes).route("/", adminRefundsRoutes).route("/", creditsRoutes).route("/", adminRoutes);
const query = (text: string) => db.execute(sql.raw(text));
let schemaCreated = false;
async function charge(cents = "5", owner = "buyer", age = "1 hour") {
	const result = await db.execute(sql`insert into usage_records
		(request_id, user_id, model, provider, cost_cents, markup_cents, total_cents, created_at)
		values (${randomUUID()}, ${owner}, 'minimax-m2-7', 'oma-ai', 0, 0, ${cents}, now() - ${age}::interval) returning id`);
	return result.rows[0].id as string;
}
function post(path: string, body: object, user = "buyer") {
	return app.request(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Test-User": user }, body: JSON.stringify(body) });
}
function create(usageId: string, extra = {}) {
	return post("/v1/refunds", { usageId, reason: "The provider returned an unusable response.", ...extra });
}
function decide(id: string, decision = "granted") {
	return post("/v1/admin/refunds", { id, decision, adminNote: "Reviewed the request." }, "operator");
}
async function ledger() {
	return (await query("select balance_cents, total_used_cents, total_deposited_cents from credit_balances where user_id = 'buyer'")).rows[0];
}

describe.skipIf(!fixture.url)("usage credit refunds (Postgres)", () => {
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
		await query('truncate "user", audit_logs cascade');
		await query(`insert into "user" (id, name, email) values ('buyer', 'Buyer', 'buyer@example.test'), ('other', 'Other', 'other@example.test'), ('operator', 'Operator', 'operator@example.test')`);
		await query("insert into credit_balances (user_id, balance_cents, total_used_cents, total_deposited_cents) values ('buyer', 100, 10, 110)");
	});
	afterAll(async () => {
		if (schemaCreated) await query(`drop schema "${fixture.schema}" cascade`);
		const { testPool } = await import("../db/client.js") as unknown as { testPool: { end(): Promise<void> } };
		await testPool.end();
	});

	it("restores spendable credits and net usage without inventing a deposit", async () => {
		const usageId = await charge();
		const intake = await create(usageId);
		expect(intake.status).toBe(200);
		expect((await decide((await intake.json()).id)).status).toBe(200);
		expect(await ledger()).toEqual({ balance_cents: "105.00000000", total_used_cents: "5.00000000", total_deposited_cents: "110.00000000" });
		expect((await query("select refunded_at from usage_records")).rows[0].refunded_at).not.toBeNull();
		expect((await query("select action from audit_logs")).rows).toEqual([{ action: "REFUND_GRANTED" }]);
	});

	it("preserves sub-cent charges through intake, approval and transaction history", async () => {
		const intake = await create(await charge("0.00000234"));
		const body = await intake.json();
		expect(body.amountCents).toBe(0.00000234);
		expect((await query("select amount_cents from refund_requests")).rows[0].amount_cents).toBe("0.00000234");
		expect((await decide(body.id)).status).toBe(200);
		expect((await ledger()).balance_cents).toBe("100.00000234");
		const history = await app.request("/v1/credits/transactions");
		expect((await history.json()).transactions.find((r: { type: string }) => r.type === "refund").amountCents).toBe(0.00000234);
	});

	it("denies a request without changing the charge or balance", async () => {
		const { id } = await (await create(await charge())).json();
		expect((await decide(id, "denied")).status).toBe(200);
		expect((await ledger()).balance_cents).toBe("100.00000000");
		expect((await query("select refunded_at from usage_records")).rows[0].refunded_at).toBeNull();
	});

	it("retains the provider cost as a loss in admin markup after refunding revenue", async () => {
		const usageId = await charge();
		await db.execute(sql`update usage_records set provider = 'venice', cost_cents = 3, markup_cents = 2 where id = ${usageId}`);
		const { id } = await (await create(usageId)).json();
		expect((await decide(id)).status).toBe(200);
		const summary = await app.request("/v1/admin/usage/summary");
		expect(summary.status).toBe(200);
		const body = await summary.json();
		expect(body.totals).toMatchObject({ totalCents: 0, upstreamCents: 3, markupCents: -3 });
		expect(body.items[0]).toMatchObject({ totalCents: 0, upstreamCents: 3, markupCents: -3 });
	});

	it("rejects malformed legacy charge references without changing credits", async () => {
		const id = randomUUID();
		await db.execute(sql`insert into refund_requests (id, user_id, amount_cents, reason, notes)
			values (${id}, 'buyer', 5, 'Legacy invalid link', 'not-a-uuid')`);
		expect((await decide(id)).status).toBe(409);
		expect((await ledger()).balance_cents).toBe("100.00000000");
		expect((await query("select status from refund_requests")).rows[0].status).toBe("pending");
	});

	it("applies one terminal decision under concurrent grant and denial", async () => {
		const { id } = await (await create(await charge())).json();
		const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => decide(id, i % 2 ? "denied" : "granted")));
		expect(responses.filter(r => r.status === 200)).toHaveLength(1);
		expect(responses.filter(r => r.status === 409)).toHaveLength(7);
		const saved = (await query("select status from refund_requests")).rows[0].status;
		expect((await ledger()).balance_cents).toBe(saved === "granted" ? "105.00000000" : "100.00000000");
	});

	it("cannot credit two legacy requests for the same usage charge", async () => {
		const usageId = await charge();
		const ids = [randomUUID(), randomUUID()];
		for (const id of ids) await db.execute(sql`insert into refund_requests (id, user_id, amount_cents, reason, notes) values (${id}, 'buyer', 5, 'Legacy duplicate', ${JSON.stringify({ u: usageId })})`);
		const responses = await Promise.all(ids.map(id => decide(id)));
		expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
		expect((await ledger()).balance_cents).toBe("105.00000000");
	});

	it("rolls back the credit and usage mark when saving the decision fails", async () => {
		const { id } = await (await create(await charge())).json();
		await query(`create function reject_decision() returns trigger language plpgsql as $$ begin raise exception 'simulated decision failure'; end $$`);
		await query("create trigger reject_decision before update on refund_requests for each row execute function reject_decision()");
		try {
			expect((await decide(id)).status).toBe(500);
			expect((await ledger()).balance_cents).toBe("100.00000000");
			expect((await query("select refunded_at from usage_records")).rows[0].refunded_at).toBeNull();
			expect((await query("select status from refund_requests")).rows[0].status).toBe("pending");
		} finally {
			await query("drop trigger reject_decision on refund_requests");
			await query("drop function reject_decision()");
		}
		expect((await decide(id)).status).toBe(200);
	});

	it("rejects a grant with an unrelated usage owner", async () => {
		const usageId = await charge("5", "other");
		const id = randomUUID();
		await db.execute(sql`insert into refund_requests (id, user_id, amount_cents, reason, notes) values (${id}, 'buyer', 5, 'Legacy invalid link', ${JSON.stringify({ u: usageId })})`);
		expect((await decide(id)).status).toBe(409);
		expect((await ledger()).balance_cents).toBe("100.00000000");
		expect((await query("select refunded_at from usage_records")).rows[0].refunded_at).toBeNull();
	});

	it("rejects zero charges and unsupported partial refunds", async () => {
		expect((await create(await charge("0"))).status).toBe(400);
		expect((await create(await charge(), { amountCents: 1 })).status).toBe(400);
		expect((await query("select * from refund_requests")).rows).toHaveLength(0);
	});

	it("rejects another account's charge and expired charges", async () => {
		expect((await create(await charge("5", "other"))).status).toBe(404);
		expect((await create(await charge("5", "buyer", "31 days"))).status).toBe(400);
	});

	it("deduplicates concurrent intake for the same usage charge", async () => {
		const usageId = await charge();
		const responses = await Promise.all(Array.from({ length: 8 }, () => create(usageId)));
		expect(responses.filter(r => r.status === 200)).toHaveLength(1);
		expect(responses.filter(r => r.status === 409)).toHaveLength(7);
		expect((await query("select * from refund_requests")).rows).toHaveLength(1);
	});

	it("keeps the five-pending-request cap under concurrent intake", async () => {
		const usageIds = await Promise.all(Array.from({ length: 8 }, () => charge()));
		const responses = await Promise.all(usageIds.map(usageId => create(usageId)));
		expect(responses.filter(r => r.status === 200)).toHaveLength(5);
		expect(responses.filter(r => r.status === 429)).toHaveLength(3);
		expect((await query("select * from refund_requests")).rows).toHaveLength(5);
	});
});
