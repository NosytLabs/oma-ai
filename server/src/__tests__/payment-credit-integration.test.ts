import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { encodeAbiParameters, encodeEventTopics, parseAbiItem } from "viem";

const fixture = vi.hoisted(() => ({
	schema: `payment_credit_test_${process.pid}`,
	url: process.env.CREDIT_TEST_DATABASE_URL,
	payer: `0x${"12".repeat(20)}`,
	treasury: `0x${"34".repeat(20)}`,
	txHash: `0x${"ab".repeat(32)}`,
	blockTime: BigInt(Math.floor(Date.now() / 1000) + 60),
}));

// Opt in with an isolated local Postgres URL. Every table lives in a temporary
// schema, which is removed after the tests; no existing tables are changed.
vi.mock("../db/client.js", async () => {
	const { default: pg } = await import("pg");
	const { drizzle } = await import("drizzle-orm/node-postgres");
	const schema = await import("../db/schema.js");
	const pool = new pg.Pool({ connectionString: fixture.url, options: `-c search_path=${fixture.schema}` });
	return { db: drizzle(pool, { schema }), testPool: pool };
});
vi.mock("../config.js", () => ({ config: {
	NODE_ENV: "test", FACILITATOR_MODE: "live", TREASURY_BASE_ADDRESS: fixture.treasury,
	USDC_DEPOSIT_ADDRESS: fixture.treasury,
	RECEIPT_HMAC_SECRET: "credit-regression-44e9bc23-8960-4b92-a1cd-67c05af9cc43",
}, isProductionEnv: true }));
vi.mock("../auth/middleware.js", () => ({ sessionAuth: async (c: { req: { header(name: string): string | undefined }; set(name: string, value: string): void }, next: () => Promise<void>) => {
	c.set("userId", c.req.header("Authorization")!);
	await next();
} }));
vi.mock("../lib/redis-client.js", () => ({ getRedisClient: async () => null }));
vi.mock("../lib/rpc-client.js", async () => {
	const { USDC_BASE } = await import("../constants.js");
	const event = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
	return { getPublicClient: () => ({ getBlock: async () => ({ timestamp: fixture.blockTime }), getTransactionReceipt: async () => ({ status: "success", blockHash: `0x${"cd".repeat(32)}`, logs: [{
		address: USDC_BASE,
		topics: encodeEventTopics({ abi: [event], eventName: "Transfer", args: { from: fixture.payer as `0x${string}`, to: fixture.treasury as `0x${string}` } }),
		data: encodeAbiParameters([{ type: "uint256" }], [1234567n]),
	}] }) }) };
});

import { x402Routes } from "../x402/facilitator.js";
import { settlementCache } from "../x402/settlement-cache.js";
import { processTransfer } from "../lib/deposit-recovery.js";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

const app = new Hono().route("/", x402Routes);
const query = (text: string) => db.execute(sql.raw(text));
async function addUser(id: string) {
	await db.execute(sql`insert into "user" (id, name, email, evm_address) values (${id}, ${id}, ${`${id}@example.com`}, ${fixture.payer})`);
}
async function settle(userId: string) {
	return app.request("/x402/settle", { method: "POST", headers: { Authorization: userId, "Content-Type": "application/json" }, body: JSON.stringify({ txHash: fixture.txHash, networkId: "eip155:8453" }) });
}
async function pendingDeposit(userId: string, status = "pending") {
	await db.execute(sql`insert into deposits (user_id, type, amount_usd, credits_issued, tx_hash, from_address, deposit_address, status) values (${userId}, 'usdc_direct', '1.234567', '0', ${fixture.txHash}, ${fixture.payer}, ${fixture.treasury}, ${status})`);
}
async function balance(userId: string) {
	const result = await db.execute(sql`select balance_cents from credit_balances where user_id = ${userId}`);
	return Number(result.rows[0]?.balance_cents ?? 0);
}

describe.skipIf(!fixture.url)("durable credit claims (Postgres)", () => {
	beforeAll(async () => {
		await query(`create schema "${fixture.schema}"`);
		const journal = JSON.parse(await readFile(new URL("../db/migrations/meta/_journal.json", import.meta.url), "utf8"));
		for (const migration of journal.entries) {
			const source = await readFile(new URL(`../db/migrations/${migration.tag}.sql`, import.meta.url), "utf8");
			await query(source.replaceAll('"public".', `"${fixture.schema}".`));
		}
	});
	beforeEach(async () => {
		fixture.blockTime = BigInt(Math.floor(Date.now() / 1000) + 60);
		settlementCache.clear();
		await query('truncate table "user", settlements cascade');
		// The optional query lets the regressions run against the old schema.
		await query(`do $$ begin if to_regclass('payment_credit_claims') is not null then truncate payment_credit_claims; end if; end $$`);
		await addUser("original");
	});
	afterAll(async () => {
		await query(`drop schema "${fixture.schema}" cascade`);
		const { testPool } = await import("../db/client.js") as unknown as { testPool: { end(): Promise<void> } };
		await testPool.end();
	});

	it("rejects the same payment after account deletion and wallet re-registration", async () => {
		expect((await settle("original")).status).toBe(200);
		expect(await balance("original")).toBe(123.4567);
		await query(`delete from "user" where id = 'original'`);
		await addUser("replacement");
		settlementCache.clear();
		expect((await settle("replacement")).status).toBe(409);
		expect(await balance("replacement")).toBe(0);
	});

	it("does not replay a direct deposit as x402 funding after account deletion", async () => {
		await pendingDeposit("original");
		await processTransfer({ getBlockNumber: async () => 1n, getLogs: async () => [] }, {
			transactionHash: fixture.txHash as `0x${string}`, args: { from: fixture.payer as `0x${string}`, to: fixture.treasury as `0x${string}`, value: 1234567n },
		}, fixture.treasury);
		expect(await balance("original")).toBeGreaterThan(0);
		await query(`delete from "user" where id = 'original'`);
		await addUser("replacement");
		expect((await settle("replacement")).status).toBe(409);
		expect(await balance("replacement")).toBe(0);
	});

	it.each(["pending", "failed"])("credits an existing %s deposit only after confirmed payment", async (status) => {
		await pendingDeposit("original", status);
		expect((await settle("original")).status).toBe(200);
		expect(await balance("original")).toBe(123.4567);
		const deposits = await query("select status from deposits");
		expect(deposits.rows[0]?.status).toBe("completed");
	});

	it("credits concurrent retries once and returns success for both", async () => {
		const replies = await Promise.all([settle("original"), settle("original")]);
		expect(replies.map(response => response.status)).toEqual([200, 200]);
		expect(await balance("original")).toBe(123.4567);
	});

	it("requires reconciliation for an old transfer without a surviving credit record", async () => {
		fixture.blockTime = 1n;
		const response = await settle("original");
		expect(response.status).toBe(409);
		expect(await response.text()).toMatch(/reconciliation/i);
		expect(await balance("original")).toBe(0);
	});
});
