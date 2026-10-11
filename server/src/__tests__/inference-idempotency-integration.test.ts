import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";

const fixture = vi.hoisted(() => ({ url: process.env.CREDIT_TEST_DATABASE_URL, schema: `inference_idem_${process.pid}` }));
let schemaCreated = false;
vi.mock("../db/client.js", async () => {
	const { default: pg } = await import("pg"); const { drizzle } = await import("drizzle-orm/node-postgres");
	const schema = await import("../db/schema.js");
	const pool = new pg.Pool({ connectionString: fixture.url, options: `-c search_path=${fixture.schema}` });
	return { db: drizzle(pool, { schema }), testPool: pool };
});
import { db } from "../db/client.js";
import { inferenceIdempotency } from "../middleware/inference-idempotency.js";
import { createAnthropicStream } from "../routes/anthropic/stream.js";
import { getModelPricing } from "../inference/billing-service.js";

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
function testApp(handler: (c: import("hono").Context<OmaEnv>) => Response | Promise<Response>) {
	const app = new Hono<OmaEnv>();
	app.use("*", async (c, next) => { c.set("userId", c.req.header("X-Test-User") ?? "alice"); await next(); });
	app.post("*", inferenceIdempotency(), handler);
	return app;
}
const request = (app: Hono<OmaEnv>, key = "same-key", user = "alice", path = "/v1/chat/completions") => app.request(path, {
	method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key, "X-Test-User": user }, body: "{}",
});

describe.skipIf(!fixture.url)("inference idempotency (real Postgres)", () => {
	beforeAll(async () => {
		if (!fixture.url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(fixture.url).hostname)) throw new Error("Use local Postgres only");
		await db.execute(sql.raw(`create schema "${fixture.schema}"`));
		schemaCreated = true;
		const journal = JSON.parse(await readFile(new URL("../db/migrations/meta/_journal.json", import.meta.url), "utf8"));
		for (const migration of journal.entries) {
			const source = await readFile(new URL(`../db/migrations/${migration.tag}.sql`, import.meta.url), "utf8");
			await db.execute(sql.raw(source.replaceAll('"public".', `"${fixture.schema}".`)));
		}
	});
	beforeEach(async () => {
		await db.execute(sql.raw('truncate "user" cascade'));
		await db.execute(sql.raw(`insert into "user" (id, name, email) values ('alice','Alice','alice@local.test'), ('bob','Bob','bob@local.test')`));
	});
	afterAll(async () => {
		if (schemaCreated) await db.execute(sql.raw(`drop schema "${fixture.schema}" cascade`));
		const { testPool } = await import("../db/client.js") as unknown as { testPool: { end(): Promise<void> } }; await testPool.end();
	});

	it("admits one provider call across independent app instances and endpoints", async () => {
		const entered = deferred(), finish = deferred(); let calls = 0;
		const firstApp = testApp(async c => { calls++; entered.resolve(); await finish.promise; return c.json({ ok: true }); });
		const secondApp = testApp(c => { calls++; return c.json({ ok: true }); });
		const first = request(firstApp); await entered.promise;
		const duplicate = await request(secondApp, "same-key", "alice", "/v1/messages");
		expect(duplicate.status).toBe(409); expect((await duplicate.json()).error.code).toBe("request_in_progress");
		expect(duplicate.headers.get("Retry-After")).toBe("5"); expect(calls).toBe(1);
		finish.resolve(); expect((await first).status).toBe(200);
		const completed = await request(secondApp); expect(completed.status).toBe(409);
		expect((await completed.json()).error.code).toBe("already_processed"); expect(calls).toBe(1);
	});

	it("holds the claim until a streamed response ends", async () => {
		let close!: () => void;
		const app = testApp(c => { c.header("Content-Type", "text/event-stream"); return c.body(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("data: start\n\n")); close = () => controller.close(); } })); });
		const response = await request(app), reader = response.body!.getReader(); await reader.read();
		expect((await request(app)).status).toBe(409);
		close(); await reader.read();
		expect((await (await request(app)).json()).error.code).toBe("already_processed");
	});

	it("allows a failed or cancelled attempt to retry with a new usage ID", async () => {
		const ids: string[] = []; let fail = true;
		const app = testApp(c => { ids.push(c.get("inferenceRequestId")!); return c.json({ ok: !fail }, fail ? 502 : 200); });
		expect((await request(app)).status).toBe(502); fail = false;
		expect((await request(app)).status).toBe(200); expect(ids[1]).not.toBe(ids[0]);
		const streaming = testApp(c => { ids.push(c.get("inferenceRequestId")!); c.header("Content-Type", "text/event-stream"); return c.body(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); } })); });
		const cancelled = await request(streaming, "cancel-key"); await cancelled.body!.cancel();
		expect((await request(app, "cancel-key")).status).toBe(200); expect(ids.at(-1)).not.toBe(ids.at(-2));
	});

	it("isolates keys by account and stores no raw key or prompt", async () => {
		const app = testApp(c => c.json({ ok: true }));
		expect((await request(app, "private-secret-key", "alice")).status).toBe(200);
		expect((await request(app, "private-secret-key", "bob")).status).toBe(200);
		const rows = await db.execute(sql.raw("select * from inference_request_claims"));
		expect(rows.rows).toHaveLength(2); expect(JSON.stringify(rows.rows)).not.toContain("private-secret-key");
		await db.execute(sql.raw(`delete from "user" where id = 'alice'`));
		expect((await db.execute(sql.raw("select * from inference_request_claims"))).rows).toHaveLength(1);
	});

	it("reclaims an expired worker claim but never one with completed billing", async () => {
		await db.execute(sql.raw(`insert into inference_request_claims (user_id,key_hash,request_id,state,expires_at) values ('alice',encode(sha256('same-key'::bytea),'hex'),'old-worker','pending',now()-interval '1 minute')`));
		const app = testApp(c => c.json({ ok: true })); expect((await request(app)).status).toBe(200);
		await db.execute(sql.raw(`update inference_request_claims set state='pending',expires_at=now()-interval '1 minute', request_id='persisted-completion'`));
		await db.execute(sql.raw(`insert into usage_records (user_id,request_id,model,provider,input_tokens,output_tokens,cost_cents,markup_cents,total_cents,status) values ('alice','persisted-completion','minimax-m2-7','oma-ai',1,1,0,0,0,'completed')`));
		expect((await (await request(app)).json()).error.code).toBe("already_processed");
	});

	it("rejects invalid keys before any provider call", async () => {
		const handler = vi.fn(c => c.json({ ok: true })), app = testApp(handler);
		expect((await request(app, "a".repeat(513))).status).toBe(400);
		const response = await app.request("/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotency_key: {} }) });
		expect(response.status).toBe(400); expect(handler).not.toHaveBeenCalled();
	});

	it("preserves completed keys written by the earlier gateway", async () => {
		await db.execute(sql.raw(`insert into usage_records (user_id,request_id,model,provider,input_tokens,output_tokens,cost_cents,markup_cents,total_cents,status)
			values ('alice','idem-alice-'||encode(sha256('same-key'::bytea),'hex'),'minimax-m2-7','oma-ai',1,1,0,0,0,'completed')`));
		let calls = 0; const app = testApp(c => { calls++; return c.json({ ok: true }); });
		const duplicate = await request(app); expect(duplicate.status).toBe(409);
		expect((await duplicate.json()).error.code).toBe("already_processed"); expect(calls).toBe(0);
	});

	it("does not repeat a charge when response delivery fails after billing commits", async () => {
		let calls = 0;
		const app = testApp(async c => {
			calls++;
			await db.execute(sql`insert into usage_records (user_id,request_id,model,provider,input_tokens,output_tokens,cost_cents,markup_cents,total_cents,status)
				values ('alice',${c.get("inferenceRequestId")!},'minimax-m2-7','oma-ai',1,1,0,0,1,'completed')`);
			return c.json({ error: "Delivery failed after commit" }, 503);
		});
		expect((await request(app)).status).toBe(503);
		const repeated = await request(app);
		expect(repeated.status).toBe(409); expect(calls).toBe(1);
		expect((await repeated.json()).error.code).toBe("already_processed");
	});

	it("releases a failed Anthropic stream after recording its uncharged error", async () => {
		let fail = true;
		const app = testApp(c => {
			if (!fail) return c.json({ ok: true });
			const upstream = new Response(new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error("Local provider stream broke")); } }));
			c.header("Content-Type", "text/event-stream");
			return c.body(createAnthropicStream(upstream, "google-gemma-4-31b-it", c.get("inferenceRequestId")!, {
				userId: "alice", model: "google-gemma-4-31b-it", provider: "venice", promptTokens: 10,
				pricing: getModelPricing("google-gemma-4-31b-it"), requestId: c.get("inferenceRequestId")!,
				onFinalized: (status: "completed" | "error" | "aborted") => c.set("inferenceOutcome", status),
			}));
		});
		const failed = await request(app); expect(await failed.text()).toContain("event: error");
		fail = false; expect((await request(app)).status).toBe(200);
		const usage = await db.execute(sql.raw("select status,total_cents from usage_records where user_id='alice'"));
		expect(usage.rows).toHaveLength(1); expect(usage.rows[0].status).toBe("error"); expect(Number(usage.rows[0].total_cents)).toBe(0);
	});
});
