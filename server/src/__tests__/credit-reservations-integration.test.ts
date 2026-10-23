import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";

const fixture = vi.hoisted(() => ({ url: process.env.CREDIT_TEST_DATABASE_URL, schema: `credit_reservation_${process.pid}`, config: {
	VENICE_API_URL: "https://provider.invalid", VENICE_API_KEY: "local-provider-test-credential" as string | undefined,
	OPENBROKER_API_URL: "https://fallback.invalid", OPENBROKER_API_KEY: "local-fallback-test-credential",
} }));
vi.mock("../db/client.js", async () => {
	const { default: pg } = await import("pg"); const { drizzle } = await import("drizzle-orm/node-postgres");
	const schema = await import("../db/schema.js");
	const pool = new pg.Pool({ connectionString: fixture.url, options: `-c search_path=${fixture.schema}` });
	return { db: drizzle(pool, { schema }), testPool: pool };
});
vi.mock("../auth/middleware.js", () => {
	const auth = async (c: { set(name: string, value: unknown): void }, next: () => Promise<void>) => { c.set("userId", "buyer"); await next(); };
	return { optionalAuth: auth, sessionOrBearerAuth: auth, requireAdmin: () => async (c: import("hono").Context<OmaEnv>, next: () => Promise<void>) => c.req.header("X-Test-Admin") === "yes" ? next() : c.json({ error: "Forbidden" }, 403) };
});
vi.mock("../middleware/rate-limit.js", () => ({ rateLimit: () => (_c: unknown, next: () => Promise<void>) => next(), modelRateLimit: () => (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../middleware/daily-limit.js", () => ({ dailyUsageLimit: () => (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../config.js", () => ({ config: fixture.config }));
vi.mock("../inference/models.js", () => {
	const model = { id: "paid-model", provider: "venice", privacy: "private", inputPricePer1M: 1, outputPricePer1M: 1, markupPercent: 0, maxTokens: 32, maxOutputTokens: 32, contextWindow: 4096, capabilities: ["chat"] };
	return { getModelById: (id: string) => id === model.id ? model : id === "paid-fallback" ? { ...model, id, provider: "oma-ai", upstream: "openbroker" } : undefined, listAllModels: () => [model] };
});
import { db } from "../db/client.js";
import { chatRoutes } from "../routes/chat/index.js";
import { anthropicRoutes } from "../routes/anthropic/index.js";
import { failInferenceReservation, reservationQuote, reserveInferenceCredits, settleInferenceReservation } from "../inference/credit-reservations.js";
import { readCreditHoldTotals } from "../lib/credit-holds.js";
import { creditsRoutes } from "../routes/credits.js";
import { depositRoutes } from "../routes/deposit/index.js";
import { adminCreditHoldsRoutes } from "../routes/admin-credit-holds.js";
import { createUsageRefund, decideUsageRefund } from "../lib/usage-refunds.js";

let schemaCreated = false;
const query = (text: string) => db.execute(sql.raw(text));
const app = new Hono<OmaEnv>().route("/", chatRoutes).route("/", anthropicRoutes).route("/", creditsRoutes).route("/", depositRoutes).route("/", adminCreditHoldsRoutes);
const request = (path = "/v1/chat/completions", extra: Record<string, unknown> = {}, key: string = crypto.randomUUID()) => app.request(path, {
	method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key },
	body: JSON.stringify({ model: "paid-model", messages: [{ role: "user", content: "a".repeat(500) }], max_tokens: 32, ...extra }),
});
const completion = () => Response.json({ choices: [{ message: { content: "done" }, finish_reason: "stop" }], usage: { prompt_tokens: 125, completion_tokens: 1 } });

describe.skipIf(!fixture.url)("paid admission reservations (real Postgres)", () => {
	beforeAll(async () => {
		if (!fixture.url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(fixture.url).hostname)) throw new Error("Use local Postgres only");
		await query(`create schema "${fixture.schema}"`); schemaCreated = true;
		const journal = JSON.parse(await readFile(new URL("../db/migrations/meta/_journal.json", import.meta.url), "utf8"));
		for (const migration of journal.entries) await query((await readFile(new URL(`../db/migrations/${migration.tag}.sql`, import.meta.url), "utf8")).replaceAll('"public".', `"${fixture.schema}".`));
	});
	beforeEach(async () => {
		fixture.config.VENICE_API_KEY = "local-provider-test-credential";
		await query('truncate "user" cascade');
		await query('truncate inference_financial_receipts');
		await query("insert into \"user\" (id,name,email) values ('buyer','Buyer','buyer@local.test')");
		await query("insert into credit_balances(user_id,balance_cents,total_deposited_cents,total_used_cents) values ('buyer',0.6,0.6,0)");
	});
	afterAll(async () => {
		vi.unstubAllGlobals();
		if (schemaCreated) await query(`drop schema "${fixture.schema}" cascade`);
		const { testPool } = await import("../db/client.js") as unknown as { testPool: { end(): Promise<void> } }; await testPool.end();
	});

	it("admits one affordable call across OpenAI and Anthropic before either provider response finishes", async () => {
		let enter!: () => void, finish!: () => void; const entered = new Promise<void>(resolve => { enter = resolve; }); const gate = new Promise<void>(resolve => { finish = resolve; });
		let calls = 0;
		vi.stubGlobal("fetch", async () => { calls++; if (calls === 1) { enter(); await gate; } return completion(); });
		const first = request(); await entered;
		try {
			expect((await request("/v1/messages")).status).toBe(402); expect(calls).toBe(1);
			for (const path of ["/v1/balance", "/v1/credits/balance"]) {
				const balances = await (await app.request(path)).json();
				expect(Number(balances.reservedCents)).toBeCloseTo(0.4128, 8); expect(Number(balances.reconciliationCents)).toBe(0); expect(Number(balances.balanceCents)).toBeCloseTo(0.1872, 8);
			}
		}
		finally { finish(); await first; }
	});

	it("settles actual usage once, returns unused hold, and keeps cross-format retry protection", async () => {
		const fetchMock = vi.fn(async () => completion()); vi.stubGlobal("fetch", fetchMock);
		const first = await request("/v1/chat/completions", {}, "same-key"); expect(first.status).toBe(200);
		const balance = (await query("select balance_cents,total_used_cents from credit_balances")).rows[0];
		expect(Number(balance.balance_cents)).toBeCloseTo(0.5874, 8);
		expect(Number(balance.total_used_cents)).toBeCloseTo(0.0126, 8);
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "settled" }]);
		expect((await request("/v1/messages", {}, "same-key")).status).toBe(409); expect(fetchMock).toHaveBeenCalledTimes(1);
		await query("delete from usage_records");
		expect(Number((await query("select charged_cents from inference_financial_receipts where state='settled'")).rows[0]?.charged_cents)).toBeCloseTo(0.0126, 8);
		expect((await request("/v1/messages", {}, "same-key")).status).toBe(409);
		await query("delete from \"user\" where id='buyer'");
		expect((await query("select * from inference_credit_reservations")).rows).toHaveLength(0);
		expect((await query("select * from inference_financial_receipts")).rows).toHaveLength(1);
	});

	it("refunds a verified pre-inference rejection once", async () => {
		vi.stubGlobal("fetch", async () => new Response(null, { status: 400 }));
		expect((await request()).status).toBe(400);
		const hold = (await query("select request_id,state from inference_credit_reservations")).rows[0]; expect(hold.state).toBe("released");
		await failInferenceReservation(String(hold.request_id), true);
		expect(Number((await query("select balance_cents from credit_balances")).rows[0].balance_cents)).toBe(0.6);
	});

	it("retains an ambiguous provider failure for reconciliation", async () => {
		const fetchMock = vi.fn(async () => { throw new DOMException("Timed out", "AbortError"); }); vi.stubGlobal("fetch", fetchMock);
		expect((await request("/v1/chat/completions", {}, "ambiguous-key")).status).toBe(408);
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "reconciliation" }]);
		expect(Number((await query("select balance_cents from credit_balances")).rows[0].balance_cents)).toBeLessThan(0.6);
		expect((await request("/v1/messages", {}, "ambiguous-key")).status).toBe(409);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("settles completed streaming usage and retains cancelled streams without inventing a refund", async () => {
		const frame = 'data: {"choices":[{"delta":{"content":"done"}}]}\n\ndata: {"usage":{"prompt_tokens":125,"completion_tokens":1},"choices":[]}\n\ndata: [DONE]\n\n';
		vi.stubGlobal("fetch", async () => new Response(frame));
		const completed = await request("/v1/messages", { stream: true }); await completed.text();
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "settled" }]);
		await query("update credit_balances set balance_cents=1");
		vi.stubGlobal("fetch", async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n')); } })));
		const cancelled = await request("/v1/chat/completions", { stream: true }); const reader = cancelled.body!.getReader(); await reader.read(); await reader.cancel();
		expect((await query("select state from inference_credit_reservations order by created_at")).rows).toEqual([{ state: "settled" }, { state: "reconciliation" }]);
	});

	it("bounds text, tool schemas and remote media by the entire provider context window", () => {
		const plain = reservationQuote({ modelId: "paid-model", messages: [{ role: "user", content: "hi" }], max_tokens: 32 });
		const tools = reservationQuote({ modelId: "paid-model", messages: [{ role: "user", content: "hi" }], tools: [{ description: "a".repeat(5000) }], max_tokens: 32 });
		const media = reservationQuote({ modelId: "paid-model", messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://image.invalid/picture" } }] }], max_tokens: 32 });
		expect(tools.cents).toBe(plain.cents); expect(media.cents).toBeCloseTo(0.4128, 8);
	});

	it("keeps out-of-bound upstream usage visible while retaining its hold for reconciliation", async () => {
		vi.stubGlobal("fetch", async () => Response.json({ id: "upstream-reference", choices: [{ message: { content: "done" } }], usage: { prompt_tokens: 5000, completion_tokens: 1 } }));
		expect((await request()).status).toBe(503);
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "reconciliation" }]);
		const usage = (await query("select provider_response_id,cost_cents,total_cents,status from usage_records")).rows[0];
		expect(usage.provider_response_id).toBe("upstream-reference"); expect(Number(usage.cost_cents)).toBeCloseTo(0.5001, 8); expect(Number(usage.total_cents)).toBe(0); expect(usage.status).toBe("error");
		const totals = await readCreditHoldTotals("buyer"); expect(Number(totals.reservedCents)).toBe(0); expect(Number(totals.reconciliationCents)).toBeCloseTo(0.4128, 8);
	});

	it("restricts native hold diagnostics to operators and returns no prompt content", async () => {
		await query("insert into inference_credit_reservations(request_id,user_id,reserved_cents,state) values ('operator-test','buyer',0.000006,'reconciliation')");
		expect((await app.request("/v1/admin/credit-holds")).status).toBe(403);
		const headers = { "X-Test-Admin": "yes" };
		const list = await app.request("/v1/admin/credit-holds", { headers }); expect(list.headers.get("Cache-Control")).toBe("no-store");
		expect((await list.json()).holds).toEqual([expect.objectContaining({ requestId: "operator-test", reservedCents: "0.00000600", state: "reconciliation" })]);
		const detail = await app.request("/v1/admin/credit-holds/operator-test", { headers }); expect((await detail.json()).hold.requestId).toBe("operator-test");
		expect((await app.request("/v1/admin/credit-holds?limit=101", { headers })).status).toBe(400);
		expect((await app.request("/v1/admin/credit-holds/missing", { headers })).status).toBe(404);
	});

	it.each([undefined, { prompt_tokens: 125 }, { prompt_tokens: 125, completion_tokens: -1 }, { prompt_tokens: 125.1, completion_tokens: 1 }])("retains paid JSON without trustworthy complete usage: %j", async usage => {
		vi.stubGlobal("fetch", async () => Response.json({ id: "missing-usage-reference", choices: [{ message: { content: "done" } }], usage }));
		expect((await request()).status).toBe(503);
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "reconciliation" }]);
		const record = (await query("select provider_response_id,total_cents,status from usage_records")).rows[0];
		expect(record.provider_response_id).toBe("missing-usage-reference"); expect(Number(record.total_cents)).toBe(0); expect(record.status).toBe("error");
	});

	it.each(["data: [DONE]\n\n", ""])("retains a paid stream with missing usage at terminal EOF: %j", async ending => {
		vi.stubGlobal("fetch", async () => new Response('data: {"id":"stream-reference","choices":[{"delta":{"content":"partial"}}]}\n\n' + ending));
		const response = await request("/v1/chat/completions", { stream: true }); await expect(response.text()).rejects.toThrow();
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "reconciliation" }]);
		expect((await query("select provider_response_id,status from usage_records")).rows[0]).toMatchObject({ provider_response_id: "stream-reference", status: "error" });
	});

	it("retains anonymous admission and observed costs when the account is deleted during inference", async () => {
		let enter!: () => void, finish!: () => void; const entered = new Promise<void>(resolve => { enter = resolve; }); const gate = new Promise<void>(resolve => { finish = resolve; });
		vi.stubGlobal("fetch", async () => { enter(); await gate; return completion(); });
		const first = request(); await entered;
		try {
			expect((await query("select state,reserved_cents from inference_financial_receipts")).rows[0]).toMatchObject({ state: "held", reserved_cents: "0.41280000" });
			await query("delete from \"user\" where id='buyer'");
		} finally { finish(); await first; }
		const receipt = (await query("select state,input_tokens,cost_cents from inference_financial_receipts")).rows[0];
		expect(receipt.state).toBe("reconciliation"); expect(receipt.input_tokens).toBe(125); expect(Number(receipt.cost_cents)).toBeCloseTo(0.0126, 8);
	});

	it.each([401, 503])("distinguishes a verified auth rejection from uncertain upstream503: %i", async status => {
		const fetchMock = vi.fn(async () => new Response(null, { status })); vi.stubGlobal("fetch", fetchMock);
		expect((await request()).status).toBe(502); expect(fetchMock).toHaveBeenCalledTimes(1);
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: status === 401 ? "released" : "reconciliation" }]);
	});

	it("releases a fully rejected mixed-status fallback chain", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 400 })).mockImplementation(async () => new Response(null, { status: 429 })); vi.stubGlobal("fetch", fetchMock);
		expect((await request("/v1/chat/completions", { models: ["paid-fallback"] })).status).toBe(502);
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "released" }]);
	});

	it("retains a paid stream with valid counters but no completion marker", async () => {
		vi.stubGlobal("fetch", async () => new Response('data: {"id":"truncated-reference","choices":[{"delta":{"content":"partial"}}],"usage":{"prompt_tokens":125,"completion_tokens":1}}\n\n'));
		const response = await request("/v1/chat/completions", { stream: true }); await expect(response.text()).rejects.toThrow();
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "reconciliation" }]);
	});

	it("reserves the configured fallback and preserves safe failover when the primary key is missing", async () => {
		fixture.config.VENICE_API_KEY = undefined;
		const fetchMock = vi.fn(async (_url: string) => completion()); vi.stubGlobal("fetch", fetchMock);
		const response = await request("/v1/chat/completions", { models: ["paid-fallback"] });
		expect(response.status).toBe(200); expect(response.headers.get("x-actual-model")).toBe("paid-fallback");
		expect(fetchMock).toHaveBeenCalledTimes(1); expect(String(fetchMock.mock.calls[0]?.[0])).toContain("fallback.invalid");
	});

	it("preserves a refunded customer charge in detached accounting after account deletion", async () => {
		vi.stubGlobal("fetch", async () => completion()); expect((await request()).status).toBe(200);
		const usageId = String((await query("select id from usage_records")).rows[0].id);
		const refund = await createUsageRefund("buyer", { usageId, reason: "Provider returned an unusable completion" });
		await decideUsageRefund("buyer", { id: refund.id, decision: "granted" });
		await query("delete from \"user\" where id='buyer'");
		const receipt = (await query("select charged_cents,refunded_cents from inference_financial_receipts")).rows[0];
		expect(Number(receipt.charged_cents)).toBeCloseTo(0.0126, 8); expect(Number(receipt.refunded_cents)).toBeCloseTo(0.0126, 8);
	});

	it("does not reuse preliminary usage when final stream counters are malformed", async () => {
		vi.stubGlobal("fetch", async () => new Response('data: {"choices":[{"delta":{"content":"partial"}}],"usage":{"prompt_tokens":0,"completion_tokens":0}}\n\ndata: {"choices":[],"usage":{"prompt_tokens":125,"completion_tokens":-1}}\n\ndata: [DONE]\n\n'));
		const response = await request("/v1/chat/completions", { stream: true }); await expect(response.text()).rejects.toThrow();
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "reconciliation" }]);
	});

	it("does not settle a paid stream with malformed data after preliminary counters", async () => {
		vi.stubGlobal("fetch", async () => new Response('data: {"choices":[{"delta":{"content":"partial"}}],"usage":{"prompt_tokens":0,"completion_tokens":0}}\n\ndata: {invalid\n\ndata: [DONE]\n\n'));
		const response = await request("/v1/chat/completions", { stream: true }); await expect(response.text()).rejects.toThrow();
		expect((await query("select state from inference_credit_reservations")).rows).toEqual([{ state: "reconciliation" }]);
	});

	it("preserves primary output/scope validation before reserving any credits", () => {
		expect(() => reservationQuote({ modelId: "paid-model", messages: [], max_tokens: 33 })).toThrow(/max_tokens/);
		expect(() => reservationQuote({ modelId: "paid-model", messages: [], allowedModels: [] })).toThrow(/does not allow/);
	});

	it("retains any charge exceeding its hold by one ledger unit", async () => {
		await reserveInferenceCredits("buyer", "fractional-boundary", 0.00000001);
		expect(await db.transaction(tx => settleInferenceReservation(tx, "buyer", "fractional-boundary", 0.00000002, true))).toBe(false);
		expect(Number((await query("select balance_cents from credit_balances")).rows[0].balance_cents)).toBe(0.59999999);
	});
});
