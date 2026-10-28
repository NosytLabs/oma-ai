/**
 * Real HTTP + Postgres auth regression check. No auth or database mocks.
 * Run: pnpm --filter oma-server test:auth:integration
 * Optional AUTH_TEST_POSTGRES_URL must point to a LOCAL Postgres database whose
 * user can create databases. A unique temporary database is migrated and dropped.
 * The server gets a clean environment: no .env, email sender, or provider keys.
 */
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { writeFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";
import { FIXED_WINDOW_SCRIPT } from "../src/middleware/rate-limit/lua-scripts.ts";

const serverDir = fileURLToPath(new URL("../", import.meta.url));
const adminUrl = new URL(process.env.AUTH_TEST_POSTGRES_URL ??
	`postgresql://${encodeURIComponent(userInfo().username)}@localhost:5432/postgres`);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(adminUrl.hostname),
	"Auth integration tests require local Postgres");
const databaseName = `oma_auth_test_${randomBytes(8).toString("hex")}`;
const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = `/${databaseName}`;
const admin = new pg.Pool({ connectionString: adminUrl.toString() });
let pool;
let backend;
let logs = "";
let databaseCreated = false;
let passed = 0;
let providerCalls = 0;
let providerRelease;
let providerEntered;
let providerAutoRelease = false;
let lastProviderRequest;
let publicSpec;
const publicObservations = [];
// Wallet attachment deliberately fails closed without distributed limiting.
// Keep Redis unavailable for the outage checks, then use a bounded local REST
// fixture for the final auth flow. Auth, signatures and PostgreSQL stay real.
let redisFixtureReady = false;
const redisCounters = new Map();
const redisFixture = createHttpServer(async (req, res) => {
	res.setHeader("Content-Type", "application/json");
	if (!redisFixtureReady) { res.writeHead(503); res.end(JSON.stringify({ error: "Local Redis fixture is unavailable" })); return; }
	try {
		assert.equal(req.headers.authorization, "Bearer isolated-local-redis-fixture");
		let text = ""; for await (const chunk of req) text += chunk;
		const input = JSON.parse(text);
		const execute = command => {
			if (String(command[0]).toLowerCase() === "ping") return { result: "PONG" };
			assert.equal(String(command[0]).toLowerCase(), "eval", "Unexpected Redis command in wallet auth fixture");
			assert.equal(command[1], FIXED_WINDOW_SCRIPT, "Only the real fixed-window limiter script is supported");
			assert.equal(Number(command[2]), 1);
			const [, , , key, rawWindow, rawLimit] = command;
			const now = Date.now(); const windowMs = Number(rawWindow); const limit = Number(rawLimit);
			assert.ok(windowMs > 0 && limit > 0);
			let counter = redisCounters.get(key);
			if (!counter || counter.expiresAt <= now) { counter = { count: 0, expiresAt: now + windowMs }; redisCounters.set(key, counter); }
			counter.count++;
			return { result: [counter.count <= limit ? 1 : 0, counter.count, counter.expiresAt - now] };
		};
		res.end(JSON.stringify(Array.isArray(input[0]) ? input.map(execute) : execute(input)));
	} catch (error) {
		res.writeHead(400); res.end(JSON.stringify({ error: error.message }));
	}
});
const provider = createHttpServer(async (req, res) => {
	let body = ""; for await (const chunk of req) body += chunk;
	const input = JSON.parse(body); lastProviderRequest = input; providerCalls++; providerEntered?.();
	if (input.stream) {
		res.writeHead(200, { "Content-Type": "text/event-stream" });
		res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "LOCAL_OK" } }] })}\n\n`);
		if (!providerAutoRelease) await new Promise(resolve => { providerRelease = resolve; });
		res.end(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 4 } })}\n\ndata: [DONE]\n\n`);
	} else {
		if (!providerAutoRelease) await new Promise(resolve => { providerRelease = resolve; });
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "LOCAL_OK" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 4 } }));
	}
});

const portProbe = createServer();
portProbe.listen(0, "127.0.0.1");
await once(portProbe, "listening");
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const origin = `http://localhost:${port}`;
const authRequestTimes = [];

function pass(message) {
	passed += 1;
	console.log(`PASS ${message}`);
}

/** Validate the published JSON-schema subset against real HTTP responses. */
function assertPublicSchema(value, schema, location = "response") {
	if (schema.$ref) return assertPublicSchema(value, schema.$ref.split("/").slice(1).reduce((node, key) => node[key], publicSpec), location);
	for (const candidate of schema.allOf ?? []) assertPublicSchema(value, candidate, location);
	if (schema.oneOf || schema.anyOf) {
		const matches = (schema.oneOf ?? schema.anyOf).filter(candidate => { try { assertPublicSchema(value, candidate, location); return true; } catch { return false; } });
		assert.ok(schema.oneOf ? matches.length === 1 : matches.length > 0, `${location} must match its documented schema variant`);
	}
	const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
	if (schema.type) assert.ok((Array.isArray(schema.type) ? schema.type : [schema.type]).some(expected => expected === type || expected === "integer" && Number.isInteger(value)), `${location} has the documented type`);
	if (schema.enum) assert.ok(schema.enum.includes(value), `${location} is a documented enum value`);
	if (typeof value === "number") {
		if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, `${location} minimum`);
		if (schema.maximum !== undefined) assert.ok(value <= schema.maximum, `${location} maximum`);
		if (schema.exclusiveMinimum !== undefined) assert.ok(value > schema.exclusiveMinimum, `${location} exclusive minimum`);
	}
	if (typeof value === "string") {
		if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength, `${location} minimum length`);
		if (schema.maxLength !== undefined) assert.ok(value.length <= schema.maxLength, `${location} maximum length`);
		if (schema.pattern) assert.match(value, new RegExp(schema.pattern), `${location} pattern`);
	}
	if (Array.isArray(value)) {
		if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, `${location} minimum item count`);
		if (schema.maxItems !== undefined) assert.ok(value.length <= schema.maxItems, `${location} maximum item count`);
		if (schema.items) value.forEach((entry, index) => assertPublicSchema(entry, schema.items, `${location}[${index}]`));
	} else if (value && typeof value === "object") {
		for (const key of schema.required ?? []) assert.ok(key in value, `${location}.${key} is required by the published contract`);
		for (const [key, child] of Object.entries(schema.properties ?? {})) if (key in value) assertPublicSchema(value[key], child, `${location}.${key}`);
	}
}

async function request(path, { method = "GET", cookie, body, expected = 200, headers = {} } = {}) {
	if (path.startsWith("/api/auth/") && !path.includes("get-session")) {
		// Honor the real 40/min IP budget while testing many independent flows.
		// Leave headroom for plugin calls; never weaken the application's limit.
		while (authRequestTimes.length && authRequestTimes[0] <= Date.now() - 60_000) authRequestTimes.shift();
		if (authRequestTimes.length >= 36) {
			await delay(Math.max(0, authRequestTimes[0] + 60_100 - Date.now()));
			while (authRequestTimes.length && authRequestTimes[0] <= Date.now() - 60_000) authRequestTimes.shift();
		}
		authRequestTimes.push(Date.now());
	}
	const response = await fetch(`${origin}${path}`, {
		method,
		redirect: "manual",
		signal: AbortSignal.timeout(20_000),
		headers: {
			Origin: origin,
			"User-Agent": "OMA auth integration test",
			...(cookie ? { Cookie: cookie } : {}),
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
			...headers,
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const text = await response.text();
	const data = response.headers.get("content-type")?.includes("json") ? text ? JSON.parse(text) : null : text;
	const pathname = path.split("?")[0];
	const template = Object.keys(publicSpec?.paths ?? {}).find((candidate) =>
		new RegExp(`^${candidate.replace(/\{[^}]+\}/g, "[^/]+")}$`).test(pathname));
	if (template && publicSpec.paths[template][method.toLowerCase()]) {
		const operation = publicSpec.paths[template][method.toLowerCase()];
		const contentType = response.headers.get("content-type")?.split(";")[0];
		const responseSchema = operation.responses?.[response.status]?.content?.[contentType]?.schema;
		if (responseSchema) assertPublicSchema(data, responseSchema, `${method} ${template} ${response.status}`);
		publicObservations.push({ operation: `${method} ${template}`, status: response.status,
			contentType: response.headers.get("content-type"), schemaValidated: Boolean(responseSchema), authenticated: Boolean(cookie || headers.Authorization || headers["x-api-key"]) });
	}
	assert.equal(response.status, expected, `${method} ${path.split("?")[0]} returned ${response.status}: ${text}`);
	return {
		response,
		data,
		cookie: response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; "),
	};
}

async function deliverySince(offset, expression) {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		const match = stripVTControlCharacters(logs.slice(offset)).match(expression);
		if (match) return match[1];
		await delay(100);
	}
	throw new Error("The local development auth delivery was not logged");
}

async function magicSignIn(email) {
	const offset = logs.length;
	await request("/api/auth/sign-in/magic-link", {
		method: "POST", body: { email, name: "Integration User", callbackURL: `${origin}/settings`,
			errorCallbackURL: `${origin}/login?${new URLSearchParams({ method: "magic", next: "/settings" })}` },
	});
	const url = new URL(await deliverySince(offset, /magicLink:\s*"([^"]+)"/));
	const token = url.searchParams.get("token");
	const rows = await pool.query("SELECT identifier FROM verification WHERE identifier = $1", [
		`magic-link:${createHash("sha256").update(token).digest("base64url")}`,
	]);
	assert.equal(rows.rowCount, 1, "Magic link must be stored hashed");
	const signedIn = await request(`${url.pathname}${url.search}`, { expected: 302 });
	assert.equal(signedIn.response.headers.get("location"), `${origin}/settings`);
	assert.match(signedIn.cookie, /oma\.session_token=/);
	return { ...signedIn, path: `${url.pathname}${url.search}` };
}

async function otpSignIn(email) {
	const offset = logs.length;
	await request("/api/auth/email-otp/send-verification-otp", {
		method: "POST", body: { email, type: "sign-in" },
	});
	const otp = await deliverySince(offset, /otp:\s*"(\d+)"/);
	return request("/api/auth/sign-in/email-otp", { method: "POST", body: { email, otp } });
}

async function assertSignedOut(cookie) {
	await request("/user", { cookie, expected: 401 });
	await request("/sessions", { cookie, expected: 401 });
	assert.equal((await request("/api/auth/get-session", { cookie })).data, null);
	await request("/api/auth/update-user", { method: "POST", cookie, body: { name: "Replay" }, expected: 401 });
}

try {
	provider.listen(0, "127.0.0.1"); await once(provider, "listening");
	const providerOrigin = `http://127.0.0.1:${provider.address().port}`;
	redisFixture.listen(0, "127.0.0.1"); await once(redisFixture, "listening");
	await admin.query(`CREATE DATABASE "${databaseName}"`);
	databaseCreated = true;
	pool = new pg.Pool({ connectionString: databaseUrl.toString() });
	await migrate(drizzle(pool), { migrationsFolder: `${serverDir}src/db/migrations` });
	const meteringColumns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_records'");
	for (const column of ["requested_model", "routed_via", "attempt_count"]) {
		assert.ok(meteringColumns.rows.some((row) => row.column_name === column), `Fresh migrations must include ${column}`);
	}
	pass("fresh database migrations include all usage metering columns");
	backend = spawn(process.execPath, ["--import", "tsx/esm", "src/index.ts"], {
		cwd: serverDir,
		env: {
			PATH: process.env.PATH,
			NODE_ENV: "development",
			DOTENV_CONFIG_PATH: "/dev/null",
			// Exercise an explicitly enabled local promotion and its one-time grant.
			// Production defaults to zero; disabled/default behavior has separate coverage.
			FREE_SIGNUP_CENTS: "100",
			DATABASE_URL: databaseUrl.toString(),
			PORT: String(port),
			PUBLIC_APP_URL: origin,
			BETTER_AUTH_URL: origin,
			PRIMARY_DOMAIN: "localhost",
			PUBLIC_API_URL: origin,
			CORS_ORIGIN: origin,
			ETH_RPC_URL: "http://127.0.0.1:1",
			UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${redisFixture.address().port}`,
			UPSTASH_REDIS_REST_TOKEN: "isolated-local-redis-fixture",
			LOG_LEVEL: "info",
			OTEL_SDK_DISABLED: "true",
			VENICE_API_URL: providerOrigin,
			VENICE_API_KEY: "isolated-local-provider-fixture",
			USDC_DEPOSIT_ADDRESS: `0x${"12".repeat(20)}`,
			TREASURY_BASE_ADDRESS: `0x${"12".repeat(20)}`,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	backend.stdout.on("data", (chunk) => { logs += chunk; });
	backend.stderr.on("data", (chunk) => { logs += chunk; });
	const startupDeadline = Date.now() + 60_000;
	while (!logs.includes("API server running")) {
		assert.ok(Date.now() < startupDeadline && backend.exitCode === null, "Local backend failed to start within 60 seconds");
		await delay(100);
	}
	publicSpec = (await request("/openapi.json")).data;
	for (const path of ["/openapi", "/v1/openapi.json", "/v1/openapi"]) {
		assert.deepEqual((await request(path)).data, publicSpec, "Every documented OpenAPI alias must publish the same contract");
	}
	const models = (await request("/v1/models")).data;
	assert.equal(models.object, "list"); assert.equal(models.data.length, 20);
	const modelDetail = (await request("/v1/models/google-gemma-4-31b-it")).data;
	assert.equal(modelDetail.id, "google-gemma-4-31b-it");
	assert.deepEqual(modelDetail, models.data.find(model => model.id === modelDetail.id), "List and detail must use the same model serialization");
	assert.equal(modelDetail.created, 0, "An unknown creation date cannot become the current request time");
	assert.equal(modelDetail.metadata_verification.status, "verified");
	assert.equal(modelDetail.privacy, "private");
	assert.deepEqual(modelDetail.architecture.input_modalities, ["text", "image", "video"]);
	assert.equal(models.data.find(model => model.id === "minimax-m2-7").metadata_verification.status, "unverified");
	assert.equal(modelDetail.max_output_tokens, 8192);
	assert.equal(typeof modelDetail.pricing.prompt, "number");
	await request("/v1/models/not-a-real-model", { expected: 404 });
	const quota = await request("/v1/usage/today");
	assert.equal(quota.data.limit, 20); assert.equal(quota.data.used, 0);
	assert.match(quota.response.headers.get("cache-control"), /no-store/);
	const funding = (await request("/x402/info")).data;
	assert.equal(funding.x402Version, 2); assert.equal(funding.payTo.toLowerCase(), `0x${"12".repeat(20)}`);
	for (const query of ["", "?query=", `?query=${"x".repeat(501)}`]) await request(`/v1/search${query}`, { expected: 400 });
	const searched = (await request("/v1/search?query=OMA%20AI")).data;
	assert.equal(searched.query, "OMA AI"); assert.ok(Array.isArray(searched.results));
	assert.equal(searched.provider, "duckduckgo");
	pass("all OpenAPI aliases, public model detail, guest quota, search validation and read-only funding discovery return their documented envelopes");

	await request("/user", { expected: 401 });
	await request("/sessions", { expected: 401 });
	await request("/v1/export/account", { expected: 401 });
	const deniedSettlement = await request("/x402/settle", { method: "POST", expected: 401 });
	assert.equal(deniedSettlement.response.headers.get("cache-control"), "no-store");
	await request("/api/auth/sign-in/magic-link", {
		method: "POST", body: { email: "invalid" }, expected: 400,
	});
	await request("/api/auth/sign-in/magic-link", {
		method: "POST", body: { email: "blocked@local.test" },
		headers: { Origin: "https://untrusted.example" }, expected: 403,
	});
	pass("anonymous access, malformed email, and untrusted sign-in origins are rejected");

	for (const cookie of ["oma_api_key=%", "__Host-oma_api_key=%E0%A4%A"]) {
		const rejected = await request("/v1/usage", { cookie, expected: 401 });
		assert.equal(rejected.data.error.type, "authentication_error");
	}
	pass("malformed API-key cookies return authentication errors without server failures");

	const email = "account-flow@local.test";
	const first = await magicSignIn(email);
	const profile = (await request("/user", { cookie: first.cookie })).data;
	assert.equal(profile.email, email);
	assert.ok(!("isAdmin" in profile), "Public profiles omit the unused operator UI flag");
	assert.equal((await request("/api/auth/get-session", { cookie: first.cookie })).data.user.emailVerified, true);
	const balance = await pool.query("SELECT balance_cents FROM credit_balances WHERE user_id = $1", [profile.id]);
	assert.equal(Number(balance.rows[0].balance_cents), 100);
	const replay = await request(first.path, { expected: 302 });
	const assertMagicErrorReturn = (result) => {
		const target = new URL(result.response.headers.get("location"));
		assert.equal(target.origin, origin);
		assert.equal(target.pathname, "/login");
		assert.equal(target.searchParams.get("method"), "magic");
		assert.equal(target.searchParams.get("next"), "/settings");
		assert.equal(target.searchParams.get("error"), "INVALID_TOKEN");
		assert.doesNotMatch(result.cookie, /session_token=[^;]/);
	};
	assertMagicErrorReturn(replay);
	const expiredMagicToken = randomBytes(24).toString("hex");
	await pool.query("INSERT INTO verification(id,identifier,value,expires_at) VALUES($1,$2,$3,now()-interval '1 second')", [
		"expired-magic-link-fixture",
		`magic-link:${createHash("sha256").update(expiredMagicToken).digest("base64url")}`,
		JSON.stringify({ type: "magic-link", email: "expired-link@local.test" }),
	]);
	for (const token of ["unknown-magic-link-fixture", expiredMagicToken]) {
		const failedLink = new URL(first.path, origin);
		failedLink.searchParams.set("token", token);
		assertMagicErrorReturn(await request(`${failedLink.pathname}${failedLink.search}`, { cookie: first.cookie, expected: 302 }));
	}
	assert.equal((await request("/api/auth/get-session", { cookie: first.cookie })).data.user.id, profile.id,
		"A failed magic link must preserve the previous session without claiming a new sign-in");
	pass("invalid, expired and consumed magic links return to sign-in with a safe next and preserve the previous session");
	pass("magic-link signup creates a verified user and one trial grant; used links are rejected");
	const accountBalance = await request("/v1/balance", { cookie: first.cookie });
	assert.equal(accountBalance.data.userId, profile.id); assert.equal(Number(accountBalance.data.balanceCents), 100);
	assert.equal(typeof accountBalance.data.balanceCents, "string");
	assert.match(accountBalance.response.headers.get("cache-control"), /no-store/);
	const creditBalance = (await request("/v1/credits/balance", { cookie: first.cookie })).data;
	assert.equal(Number(creditBalance.balanceCents), 100); assert.ok(Array.isArray(creditBalance.activeBatches));
	const instructions = (await request("/v1/deposit/usdc", { cookie: first.cookie })).data;
	assert.equal(instructions.network, "base"); assert.equal(instructions.chainId, 8453);
	const depositWallet = privateKeyToAccount(generatePrivateKey());
	const challenge = (await request("/v1/deposit/usdc/challenge", { method: "POST", cookie: first.cookie, body: { fromAddress: depositWallet.address } })).data;
	assert.deepEqual(Object.keys(challenge).sort(), ["expiresAt", "nonce", "token"]);
	assert.equal(typeof challenge.expiresAt, "number"); assert.ok(challenge.expiresAt > Date.now());
	const fakeTxHash = `0x${"34".repeat(32)}`;
	const signedDeposit = ["OMA-AI deposit authorization", "", `Sending wallet: ${depositWallet.address}`, `Deposit to: ${instructions.depositAddress}`, `Challenge: ${challenge.token}`, `Transaction: ${fakeTxHash}`, "Amount USD: 1"].join("\n");
	const pendingDeposit = (await request("/v1/deposit/usdc", { method: "POST", cookie: first.cookie, body: { amountUsd: 1, txHash: fakeTxHash, network: "base", fromAddress: depositWallet.address, challengeToken: challenge.token, signature: await depositWallet.signMessage({ message: signedDeposit }) } })).data;
	assert.equal(pendingDeposit.status, "pending"); assert.equal(pendingDeposit.amountCents, 100);
	assert.ok((await request("/v1/deposit/status", { cookie: first.cookie })).data.deposits.some(row => row.id === pendingDeposit.depositId));
	assert.equal(Number((await request("/v1/balance", { cookie: first.cookie })).data.balanceCents), 100, "Recording a local pending deposit cannot credit funds");
	await pool.query("DELETE FROM deposits WHERE id=$1", [pendingDeposit.depositId]);
	await request("/v1/deposit/usdc/challenge", { method: "POST", cookie: first.cookie, body: { fromAddress: "bad" }, expected: 400 });
	await request("/v1/deposit/usdc", { method: "POST", cookie: first.cookie, body: {}, expected: 400 });
	await request("/v1/checkout", { method: "POST", cookie: first.cookie, body: { productId: "stale-contract", successUrl: origin, cancelUrl: origin }, expected: 400 });
	await request("/v1/checkout", { method: "POST", cookie: first.cookie, body: { plan: "hobby" }, expected: 503 });
	await request("/x402/settle", { method: "POST", cookie: first.cookie, body: { txHash: "invalid", networkId: "base" }, expected: 400 });
	for (const fields of [{ max_tokens: 0 }, { max_tokens: 1.5 }, { temperature: -0.01 }, { temperature: 2.01 }, { top_p: -0.01 }, { top_p: 1.01 }, { messages: [] }, { models: Array(9).fill("x") }]) {
		await request("/v1/chat/completions", { method: "POST", cookie: first.cookie, expected: 400, body: { model: "", messages: [{ role: "user", content: "Bounds check" }], ...fields } });
	}
	for (const fields of [{ max_tokens: 0 }, { temperature: -0.01 }, { temperature: 1.01 }, { top_p: 1.01 }, { messages: [] }, { tool_choice: "auto" }, { messages: [{ role: "system", content: "invalid" }] }]) {
		await request("/v1/messages", { method: "POST", cookie: first.cookie, expected: 400, body: { model: "", messages: [{ role: "user", content: "Bounds check" }], max_tokens: 1, ...fields } });
	}
	for (const path of ["/v1/chat/completions", "/v1/messages"]) await request(path, { method: "POST", cookie: first.cookie, expected: 404, body: { model: "", messages: [{ role: "user", content: "Valid bounds" }], max_tokens: 1, temperature: 0, top_p: 1 } });
	providerAutoRelease = true;
	const anthropic = await request("/v1/messages", { method: "POST", cookie: first.cookie, body: { model: "google-gemma-4-31b-it", messages: [{ role: "user", content: "Return LOCAL_OK" }], max_tokens: 8, system: "Local contract fixture" } });
	assert.equal(anthropic.data.type, "message"); assert.equal(anthropic.data.content[0].text, "LOCAL_OK");
	assert.deepEqual(anthropic.data.usage, { input_tokens: 10, output_tokens: 4 });
	assert.ok(anthropic.response.headers.get("x-oma-request-id"));
	assert.deepEqual(lastProviderRequest.messages[0], { role: "system", content: "Local contract fixture" });
	providerAutoRelease = false; providerCalls = 0;
	await pool.query("DELETE FROM usage_records WHERE user_id=$1", [profile.id]);
	await pool.query("UPDATE credit_balances SET balance_cents=100, total_used_cents=0 WHERE user_id=$1", [profile.id]);
	for (const path of ["/v1/export/usage", "/v1/export/deposits", "/v1/export/summary"]) {
		const csv = await request(path, { cookie: first.cookie });
		assert.match(csv.response.headers.get("content-type"), /text\/csv/);
		const json = await request(`${path}?format=json`, { cookie: first.cookie });
		assert.match(json.response.headers.get("content-type"), /application\/json/);
		assert.equal(typeof json.data, "object");
	}
	for (const query of ["?format=xml", "?since=invalid", "?since=2026-02-02T00%3A00%3A00Z&until=2026-01-01T00%3A00%3A00Z"]) await request(`/v1/export/usage${query}`, { cookie: first.cookie, expected: 400 });
	for (const query of ["limit=0", "limit=501", "model=" + "x".repeat(151), "cursor=" + "x".repeat(513), "provider=other"]) await request(`/v1/usage?${query}`, { cookie: first.cookie, expected: 400 });
	for (const query of ["limit=0", "limit=201", "status=other"]) await request(`/v1/refunds?${query}`, { cookie: first.cookie, expected: 400 });
	pass("real HTTP contract checks cover signed pending deposits without crediting, exact checkout/challenge envelopes, completion bounds, Anthropic conversion, CSV/JSON exports and private filter bounds");

	await request("/v1/keys", { method: "POST", expected: 401, body: { name: "No session" } });
	await request("/v1/keys/not-a-uuid", { method: "DELETE", cookie: first.cookie, expected: 400 });
	const scopedKey = (await request("/v1/keys", { method: "POST", cookie: first.cookie, body: { name: "Integration scope", expiresInDays: 1, allowedModels: ["minimax-m2-7", "minimax-m2-7"] } })).data;
	assert.deepEqual(scopedKey.allowedModels, ["minimax-m2-7"]);
	assert.ok(Math.abs(new Date(scopedKey.expiresAt).getTime() - Date.now() - 86_400_000) < 10_000);
	const keyHeaders = { Authorization: `Bearer ${scopedKey.key}` };
	assert.equal((await request("/v1/keys", { cookie: first.cookie })).data.keys[0].expiresAt, scopedKey.expiresAt);
	await request("/v1/keys", { headers: keyHeaders, expected: 401 });
	await request("/v1/chat/completions", { method: "POST", headers: keyHeaders, expected: 403, body: { model: "google-gemma-4-31b-it", messages: [{ role: "user", content: "Scope check" }], max_tokens: 16 } });
	await request("/v1/messages", { method: "POST", headers: keyHeaders, expected: 403, body: { model: "google-gemma-4-31b-it", messages: [{ role: "user", content: "Scope check" }], max_tokens: 16 } });
	await pool.query("UPDATE api_keys SET expires_at=now()-interval '1 second' WHERE id=$1", [scopedKey.id]);
	await request("/v1/chat/completions", { method: "POST", headers: keyHeaders, expected: 401, body: { model: "minimax-m2-7", messages: [{ role: "user", content: "Expired key check" }], max_tokens: 16 } });
	await request(`/v1/keys/${scopedKey.id}`, { method: "DELETE", cookie: first.cookie });
	await request("/v1/usage", { headers: keyHeaders, expected: 401 });
	await request("/v1/usage", { cookie: first.cookie, headers: keyHeaders, expected: 401 });
	pass("API keys require a session to mint, persist expiry/scope, deny unauthorized models on both APIs and reject expired or revoked credentials");

	const localKey = (await request("/v1/keys", { method: "POST", cookie: first.cookie, body: { name: "Local IP restriction", ipAllowlist: [" 127.0.0.1/32 ", "::1/128", "127.0.0.1/32"] } })).data;
	assert.deepEqual(localKey.ipAllowlist, ["127.0.0.1/32", "::1/128"]);
	assert.deepEqual((await request("/v1/keys", { cookie: first.cookie })).data.keys.find(key => key.id === localKey.id).ipAllowlist, localKey.ipAllowlist);
	await request("/v1/usage", { headers: { Authorization: `Bearer ${localKey.key}` } });
	const remoteKey = (await request("/v1/keys", { method: "POST", cookie: first.cookie, body: { name: "Other IP restriction", ipAllowlist: ["192.0.2.0/24"] } })).data;
	for (const forged of [{}, { "x-forwarded-for": "192.0.2.1", "x-real-ip": "192.0.2.1", "x-vercel-forwarded-for": "192.0.2.1" }]) {
		await request("/v1/usage", { headers: { Authorization: `Bearer ${remoteKey.key}`, ...forged }, expected: 403 });
	}
	await request("/v1/keys", { method: "POST", cookie: first.cookie, body: { ipAllowlist: ["::/129"] }, expected: 400 });
	for (const key of [localKey, remoteKey]) await request(`/v1/keys/${key.id}`, { method: "DELETE", cookie: first.cookie });
	pass("IP-restricted keys allow real loopback callers, reject foreign addresses despite forged proxy headers and validate CIDR ranges");

	const other = await magicSignIn("other-auth@local.test");
	const otherProfile = (await request("/user", { cookie: other.cookie })).data;
	const otherSession = (await request("/api/auth/get-session", { cookie: other.cookie })).data.session;
	const otherKey = (await request("/v1/keys", { method: "POST", cookie: other.cookie, body: { name: "Other private key" } })).data;
	const otherHeaders = { Authorization: `Bearer ${otherKey.key}` };
	const privateDeposits = (await pool.query(`INSERT INTO deposits (user_id, type, amount_usd, credits_issued, status)
	 VALUES ($1, 'usdc_direct', 25, 2500, 'completed'), ($2, 'usdc_direct', 50, 5000, 'pending') RETURNING id, user_id`, [profile.id, otherProfile.id])).rows;
	const ownDepositId = privateDeposits.find(deposit => deposit.user_id === profile.id).id;
	const otherDepositId = privateDeposits.find(deposit => deposit.user_id === otherProfile.id).id;
	for (const headers of [otherHeaders, { "x-api-key": otherKey.key }]) {
		const mixed = (await request("/v1/deposit/status", { cookie: first.cookie, headers })).data.deposits;
		assert.ok(mixed.some(deposit => deposit.id === otherDepositId));
		assert.ok(!mixed.some(deposit => deposit.id === ownDepositId));
	}
	for (const headers of [{ Authorization: "Basic rejected" }, { "x-api-key": "" }]) {
		await request("/v1/usage", { cookie: first.cookie, headers, expected: 401 });
	}
	pass("mixed credentials honor the explicit API key's account and reject revoked, empty or unsupported credentials despite a valid session");
	for (const headers of [{}, otherHeaders]) {
		const explicitKey = Boolean(headers.Authorization);
		const ownDeposits = (await request(`/v1/deposit/status?userId=${explicitKey ? profile.id : otherProfile.id}`, { cookie: first.cookie, headers })).data.deposits;
		assert.deepEqual(ownDeposits.map(deposit => deposit.id), [explicitKey ? otherDepositId : ownDepositId]);
		assert.equal(Number(ownDeposits[0].amountUsd), explicitKey ? 50 : 25, "Payment history amounts are dollars, not cents");
	}
	assert.deepEqual((await request("/v1/deposit/status", { headers: otherHeaders })).data.deposits.map(deposit => deposit.id), [otherDepositId]);
	await request("/v1/deposit/status", { expected: 401 });
	await pool.query("DELETE FROM deposits WHERE id = ANY($1::uuid[])", [privateDeposits.map(deposit => deposit.id)]);
	pass("deposit history preserves dollar amounts and isolates owners despite forged user IDs or mixed account credentials");
	for (const [path, method, body] of [["/v1/keys", "POST", { name: "Cross-site attempt" }], [`/sessions/${otherSession.id}`, "DELETE", undefined], ["/account", "DELETE", undefined]]) {
		await request(path, { method, cookie: other.cookie, body, headers: { Origin: "https://untrusted.example" }, expected: 403 });
	}
	await pool.query(`INSERT INTO usage_records (request_id, user_id, api_key_id, model, provider, input_tokens, output_tokens, cost_cents, markup_cents, total_cents, status)
	 VALUES ('cross-account-private', $1, $2, 'minimax-m2-7', 'oma-ai', 2, 3, 0, 0, 0, 'completed')`, [otherProfile.id, otherKey.id]);
	assert.ok(!(await request(`/v1/keys?userId=${otherProfile.id}`, { cookie: first.cookie })).data.keys.some(key => key.id === otherKey.id));
	await request(`/v1/keys/${otherKey.id}`, { method: "DELETE", cookie: first.cookie, expected: 404 });
	const deniedInstall = await request("/v1/keys/install", { method: "POST", cookie: first.cookie, body: { key: otherKey.key }, expected: 403 });
	assert.equal(deniedInstall.response.headers.getSetCookie().length, 0);
	await request(`/sessions/${otherSession.id}`, { method: "DELETE", cookie: first.cookie, expected: 404 });
	assert.equal((await request("/user", { cookie: other.cookie })).data.id, otherProfile.id);
	for (const suffix of [`?userId=${otherProfile.id}`, `?api_key_id=${otherKey.id}`]) {
		assert.equal((await request(`/v1/usage${suffix}`, { cookie: first.cookie })).data.data.length, 0);
	}
	assert.equal((await request(`/v1/usage?model=${encodeURIComponent("' OR 1=1 --")}`, { cookie: first.cookie })).data.data.length, 0, "SQL-like filter text remains a literal model filter");
	await request(`/v1/usage?api_key_id=${encodeURIComponent("' OR 1=1 --")}`, { cookie: first.cookie, expected: 400 });
	assert.equal((await request("/v1/usage", { cookie: first.cookie, headers: otherHeaders })).data.data[0].requestId, "cross-account-private", "Mixed-auth usage must resolve to the explicit key owner");
	assert.equal((await request("/v1/usage", { headers: otherHeaders })).data.data[0].requestId, "cross-account-private");
	const isolatedExport = (await request(`/v1/export/account?userId=${otherProfile.id}`, { cookie: first.cookie })).data;
	assert.equal(isolatedExport.profile.id, profile.id);
	assert.ok(!JSON.stringify(isolatedExport).includes("cross-account-private"));
	assert.ok(!JSON.stringify(isolatedExport).includes(otherKey.id));
	assert.ok(!JSON.stringify(isolatedExport).includes(otherKey.key));
	await request("/api/auth/update-user", { method: "POST", cookie: first.cookie, expected: 400, body: { role: "admin" } });
	await request("/api/auth/update-user", { method: "POST", cookie: first.cookie, expected: 400, body: { evmAddress: "0x1111111111111111111111111111111111111111" } });
	const protectedIdentity = (await pool.query('SELECT role, evm_address FROM "user" WHERE id=$1', [profile.id])).rows[0];
	assert.equal(protectedIdentity.role, "user");
	assert.equal(protectedIdentity.evm_address, null);
	assert.equal((await request("/user", { cookie: other.cookie })).data.name, otherProfile.name);
	await request("/api/auth/admin/list-users", { cookie: first.cookie, expected: 403 });
	await request("/api/auth/admin/set-role", { method: "POST", cookie: first.cookie, body: { userId: profile.id, role: "admin" }, expected: 403 });
	await request("/api/auth/admin/revoke-user-sessions", { method: "POST", cookie: first.cookie, body: { userId: otherProfile.id }, expected: 403 });
	await request("/v1/admin/user-suspend", { method: "POST", cookie: first.cookie, body: { userId: otherProfile.id, suspended: true, reason: "Denied authorization check" }, expected: 403 });
	await request("/v1/admin/credit-adjust", { method: "POST", headers: otherHeaders, body: { userId: profile.id, deltaCents: 100, reason: "Denied authorization check" }, expected: 403 });
	pass("two real accounts cannot revoke or install each other's keys, revoke sessions, read usage/exports or self-promote to admin");
	await request("/account", { method: "DELETE", cookie: other.cookie, body: { userId: profile.id } });
	await request("/user", { cookie: first.cookie });
	await request("/user", { cookie: other.cookie, expected: 401 });
	await request("/v1/usage", { headers: otherHeaders, expected: 401 });
	assert.equal((await pool.query('SELECT 1 FROM "user" WHERE id=$1', [otherProfile.id])).rowCount, 0);
	pass("account deletion ignores caller-supplied owner IDs and immediately invalidates that account's active keys and cookies");
	for (const path of ["/internal/recover-deposits", "/internal/drain-settlement-dlq"]) {
		await request(path, { method: "POST", headers: { "x-neon-trigger-invocation-id": "forged-by-client" }, expected: 403 });
	}
	await request("/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer oma_sk_invalid_credential", "X-OMA-Source": "website" }, expected: 401, body: { model: "minimax-m2-7", messages: [{ role: "user", content: "No guest downgrade" }], max_tokens: 16 } });
	pass("forged scheduler headers cannot invoke privileged local jobs and invalid explicit keys never become anonymous chat requests");
	await request("/v1/chat/completions", { method: "POST", headers: { "X-OMA-Source": "website", Origin: "http://localhost:3000" }, expected: 401, body: { model: "minimax-m2-7", messages: [{ role: "user", content: "No public API sponsorship" }], max_tokens: 16 } });
	await request("/website/chat/completions", { method: "POST", cookie: first.cookie, headers: { "X-OMA-Source": "website", Origin: "https://evil.example" }, expected: 403, body: { model: "minimax-m2-7", messages: [{ role: "user", content: "No cross-origin sponsorship" }], max_tokens: 16 } });
	const legacyChat = await request("/v1/chat/completions", { method: "POST", cookie: first.cookie, body: { model: "minimax-m2-7", messages: [{ role: "user", content: "Do not charge an old free-chat tab" }], max_tokens: 16 }, expected: 409 });
	assert.equal(legacyChat.data.error.code, "website_chat_moved");
	pass("public SDK requests cannot select website sponsorship, cross-origin website chat is denied, and old free-chat sessions are not charged");

	const lockedEmail = "otp-attempt-budget@local.test";
	const otpOffset = logs.length;
	await request("/api/auth/email-otp/send-verification-otp", { method: "POST", body: { email: lockedEmail, type: "sign-in" } });
	const lockedOTP = await deliverySince(otpOffset, /otp:\s*"(\d+)"/);
	const wrongOTP = lockedOTP === "000000" ? "111111" : "000000";
	for (let attempt = 0; attempt < 3; attempt++) {
		const rejectedOTP = await request("/api/auth/sign-in/email-otp", { method: "POST", body: { email: lockedEmail, otp: wrongOTP }, expected: 400 });
		assert.equal(rejectedOTP.data.code, "INVALID_OTP");
		assert.doesNotMatch(rejectedOTP.cookie, /session_token=[^;]/);
	}
	const exhaustedOTP = await request("/api/auth/sign-in/email-otp", { method: "POST", body: { email: lockedEmail, otp: lockedOTP }, expected: 403 });
	assert.equal(exhaustedOTP.data.code, "TOO_MANY_ATTEMPTS");
	await request("/api/auth/sign-in/email-otp", { method: "POST", body: { email: lockedEmail, otp: lockedOTP }, expected: 400 });
	assert.equal((await pool.query('SELECT 1 FROM "user" WHERE email=$1', [lockedEmail])).rowCount, 0);
	pass("three incorrect OTPs exhaust the code budget; even the correct code cannot create a session or account afterward");

	await request("/api/auth/update-user", { method: "POST", cookie: first.cookie, body: { name: "Saved Display Name" } });
	assert.equal((await request("/api/auth/get-session", { cookie: first.cookie })).data.user.name, "Saved Display Name");
	const remote = await otpSignIn(email);
	assert.equal(remote.data.user.id, profile.id);
	const sessions = (await request("/sessions", { cookie: first.cookie })).data.sessions;
	assert.equal(sessions.length, 2);
	assert.equal(sessions.filter((session) => session.isCurrent).length, 1);
	await request(`/sessions/${sessions.find((session) => session.isCurrent).id}`, { method: "DELETE", cookie: first.cookie, expected: 400 });
	await request(`/sessions/${sessions.find((session) => !session.isCurrent).id}`, { method: "DELETE", cookie: first.cookie });
	await assertSignedOut(remote.cookie);
	pass("profile changes persist and remote session revocation immediately rejects copied cookies");

	const another = await otpSignIn(email);
	const revoked = await request("/sessions", { method: "DELETE", cookie: first.cookie });
	assert.equal(revoked.data.revokedCount, 1);
	await assertSignedOut(another.cookie);
	await request("/user", { cookie: first.cookie });
	const exported = await request("/v1/export/account", { cookie: first.cookie });
	assert.equal(exported.data.profile.name, "Saved Display Name");
	assert.ok(exported.data.sessions.every((session) => !("token" in session)));
	assert.equal(exported.response.headers.get("cache-control"), "no-store");
	const cleared = await request("/v1/history", { method: "DELETE", cookie: first.cookie });
	assert.equal(cleared.data.success, true);
	assert.equal((await request("/user", { cookie: first.cookie })).data.id, profile.id);
	const remainingBalance = await pool.query("SELECT balance_cents FROM credit_balances WHERE user_id = $1", [profile.id]);
	assert.equal(Number(remainingBalance.rows[0].balance_cents), 100);
	pass("revoke-other-sessions preserves the current session; export and history clearing preserve the account and balance");

	await request("/v1/admin/usage/timeline", { cookie: first.cookie, expected: 403 });
	await request("/v1/admin/treasury", { cookie: first.cookie, expected: 403 });
	await request("/v1/admin/treasury", { expected: 401 });
	await request("/v1/admin/usage/logs", { expected: 401 });
	await pool.query("UPDATE \"user\" SET role = 'admin' WHERE id = $1", [profile.id]);
	const treasury = await request("/v1/admin/treasury", { cookie: first.cookie });
	assert.equal(treasury.response.headers.get("cache-control"), "no-store");
	assert.equal(treasury.data.mode, "mock");
	assert.equal(treasury.data.wallets.length, 3);
	assert.ok(treasury.data.wallets.every(wallet => wallet.eth === null && wallet.usdc === null));
	assert.ok(!JSON.stringify(treasury.data).includes("privateKey"));
	await request("/v1/admin/site-settings", { method: "POST", cookie: first.cookie, body: { maintenanceMode: true, maintenanceMessage: "Local integration maintenance" } });
	const adminSettings = (await request("/v1/admin/site-settings", { cookie: first.cookie })).data;
	assert.equal(adminSettings.maintenanceMessage, "Local integration maintenance");
	await request("/v1/models", { expected: 503 });
	for (const path of ["/health", "/v1/health", "/live", "/version", "/health/db"]) {
		await request(path);
	}
	// This fixture intentionally has no Redis. Readiness must report the
	// dependency check, rather than being replaced by the maintenance response.
	const maintenanceReadiness = await request("/ready", { expected: 503 });
	assert.equal(maintenanceReadiness.data.checks.database.ok, true);
	assert.equal(maintenanceReadiness.data.checks.redis.ok, false);
	await request("/v1/admin/site-settings", { method: "POST", cookie: first.cookie, body: { maintenanceMode: false } });
	await request("/v1/admin/site-settings", { method: "POST", cookie: first.cookie, body: { cryptoPaymentsEnabled: false, cardPaymentsEnabled: false } });
	const pausedPayments = (await request("/v1/site-settings")).data;
	assert.equal(pausedPayments.paymentStatusAvailable, true);
	assert.equal(pausedPayments.cryptoPaymentsEnabled, false);
	assert.equal(pausedPayments.cardPaymentsEnabled, false);
	for (const [path, method, body] of [
		["/v1/deposit/usdc", "GET"],
		["/v1/deposit/usdc/challenge", "POST", { fromAddress: `0x${"12".repeat(20)}` }],
		["/v1/deposit/usdc", "POST", {}],
		["/v1/checkout", "POST", { plan: "hobby" }],
		["/x402/verify", "POST", {}],
	]) {
		const paused = await request(path, { method, body, cookie: first.cookie, expected: 503 });
		assert.equal(paused.data.error.code, "funding_paused");
	}
	await request("/v1/admin/site-settings", { method: "POST", cookie: first.cookie, body: { cryptoPaymentsEnabled: true, cardPaymentsEnabled: true } });
	await request("/x402/verify", { method: "POST", expected: 400 });
	pass("admin funding pauses protect direct deposits, wallet challenges, card checkout and x402 transfers and can be reversed");
	await pool.query(`INSERT INTO "user" (id, name, email, email_verified) VALUES ('admin-test-target', 'Operator test target', 'operator-target@local.test', true)`);
	await request("/v1/admin/credit-adjust", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", deltaCents: -10, reason: "Reject missing balance" }, expected: 400 });
	assert.equal((await pool.query("SELECT 1 FROM credit_balances WHERE user_id = 'admin-test-target'")).rowCount, 0, "A rejected deduction must not create a ledger row");
	await request("/v1/admin/credit-adjust", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", deltaCents: 10, reason: "Local adjustment test" } });
	const cappedAdjustment = await request("/v1/admin/credit-adjust", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", deltaCents: -20, reason: "Local deduction test" } });
	assert.equal(cappedAdjustment.data.deltaCents, -10);
	assert.equal(cappedAdjustment.data.requestedDeltaCents, -20);
	assert.equal(cappedAdjustment.data.capped, true);
	const adjustedBalance = (await pool.query("SELECT balance_cents, total_used_cents FROM credit_balances WHERE user_id = 'admin-test-target'")).rows[0];
	assert.equal(Number(adjustedBalance.balance_cents), 0);
	assert.equal(Number(adjustedBalance.total_used_cents), 10, "A clamped deduction must only book credits actually removed");
	await request("/v1/admin/credit-adjust", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", deltaCents: -10, reason: "Reject empty balance" }, expected: 400 });
	await request("/v1/admin/credit-adjust", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", deltaCents: 0, reason: "Reject empty operation" }, expected: 400 });
	await request("/v1/admin/credit-adjust", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", deltaCents: 30, reason: "Concurrency credit" } });
	const uncappedAdjustment = await request("/v1/admin/credit-adjust", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", deltaCents: -10, reason: "Uncapped deduction" } });
	assert.equal(uncappedAdjustment.data.capped, false);
	assert.equal(uncappedAdjustment.data.deltaCents, -10);
	const concurrentAdjustments = await Promise.all([1, 2].map(() => request("/v1/admin/credit-adjust", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", deltaCents: -15, reason: "Concurrent deduction" } })));
	assert.equal(concurrentAdjustments.reduce((sum, row) => sum + row.data.deltaCents, 0), -20);
	const deductionAudits = (await pool.query("SELECT metadata FROM audit_logs WHERE resource_id = 'admin-test-target' AND action = 'CREDIT_DEDUCTED'")).rows.map(row => row.metadata);
	assert.equal(deductionAudits.length, 4);
	assert.ok(deductionAudits.some(row => row.appliedDeltaCents === -5 && row.deductionCappedAtBalance === true));
	assert.ok(deductionAudits.some(row => row.appliedDeltaCents === -15 && row.deductionCappedAtBalance === false));
	const finalAdjustedBalance = (await pool.query("SELECT balance_cents, total_used_cents FROM credit_balances WHERE user_id = 'admin-test-target'")).rows[0];
	assert.equal(Number(finalAdjustedBalance.balance_cents), 0);
	assert.equal(Number(finalAdjustedBalance.total_used_cents), 40);
	pass("credit adjustments reject empty/no-op deductions and atomically report the actual amount and cap during concurrent writes");
	await request("/v1/admin/rate-limit-override", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", maxRequestsPerMinute: 12, reason: "Local override test" } });
	assert.equal((await pool.query("SELECT max_requests_per_minute FROM rate_limit_overrides WHERE user_id = 'admin-test-target'")).rows[0].max_requests_per_minute, 12);
	await request("/v1/admin/rate-limit-override", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", maxRequestsPerMinute: null, reason: "Clear local override" } });
	assert.equal((await pool.query("SELECT 1 FROM rate_limit_overrides WHERE user_id = 'admin-test-target'")).rowCount, 0);
	await request("/v1/admin/user-suspend", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", suspended: true, reason: "Local suspension test" } });
	assert.equal((await pool.query("SELECT suspended FROM \"user\" WHERE id = 'admin-test-target'")).rows[0].suspended, true);
	await request("/v1/admin/user-suspend", { method: "POST", cookie: first.cookie, body: { userId: "admin-test-target", suspended: false, reason: "Restore local target" } });
	await request("/v1/admin/user-suspend", { method: "POST", cookie: first.cookie, body: { userId: profile.id, suspended: true, reason: "Must reject self suspension" }, expected: 400 });
	pass("admin maintenance remains reversible, settings retain their message, and real ledger, override, suspension controls work safely");
	await pool.query(`INSERT INTO usage_records (request_id, user_id, model, requested_model, provider, input_tokens, output_tokens, cost_cents, markup_cents, total_cents, status, attempt_count, latency_ms, refunded_at)
	 VALUES ('admin-venice', $1, 'claude-opus-5', 'claude-opus-5', 'venice', 100, 50, 2, 1, 3, 'completed', 1, 1200, NULL),
	 ('admin-gonka', $1, 'minimax-m2-7', 'zai-org-glm-5-3', 'oma-ai', 80, 20, 0, 0, 1, 'completed', 2, 2200, NULL),
	 ('admin-refunded', $1, 'claude-opus-5', 'claude-opus-5', 'venice', 10, 5, 1, 1, 2, 'error', 1, 200, NOW())`, [profile.id]);
	const timeline = (await request("/v1/admin/usage/timeline?days=7", { cookie: first.cookie })).data;
	assert.equal(timeline.items.reduce((sum, row) => sum + row.requests, 0), 3);
	assert.equal(timeline.items.reduce((sum, row) => sum + row.billedCents, 0), 4);
	assert.equal(timeline.items.reduce((sum, row) => sum + row.errors, 0), 1);
	assert.equal(timeline.items.reduce((sum, row) => sum + row.failedOver, 0), 1);
	assert.equal(timeline.items.reduce((sum, row) => sum + row.unknownCostRequests, 0), 1);
	assert.ok(timeline.items.some((row) => row.requests === 0), "Empty chart buckets must be present");
	assert.equal((await request("/v1/admin/usage/summary", { cookie: first.cookie })).data.totals.totalCents, 4, "Spend breakdown and timeline must both exclude refunds");
	const logPage = (await request("/v1/admin/usage/logs?limit=1", { cookie: first.cookie })).data;
	assert.equal(logPage.items.length, 1);
	assert.ok(logPage.nextCursor);
	const nextLogPage = (await request(`/v1/admin/usage/logs?limit=1&cursor=${encodeURIComponent(logPage.nextCursor)}`, { cookie: first.cookie })).data;
	assert.notEqual(nextLogPage.items[0].id, logPage.items[0].id);
	const searchedLogs = (await request("/v1/admin/usage/logs?q=admin-gonka", { cookie: first.cookie })).data;
	assert.equal(searchedLogs.items.length, 1);
	assert.equal(searchedLogs.items[0].upstreamCents, null);
	assert.equal(searchedLogs.items[0].requestedModel, "zai-org-glm-5-3");
	assert.ok(!("prompt" in searchedLogs.items[0]));
	await request("/v1/admin/usage/logs?cursor=invalid", { cookie: first.cookie, expected: 400 });
	await request("/v1/admin/usage/timeline?days=999", { cookie: first.cookie, expected: 400 });
	await pool.query(`INSERT INTO "user" (id, email, name, email_verified, created_at, updated_at)
	 SELECT 'scale-user-' || lpad(n::text, 4, '0'), 'oma-scale-' || n || '@local.test', 'Scale User ' || n, true, now(), now()
	 FROM generate_series(1, 1001) n`);
	const scaleStart = performance.now();
	const scaleIds = new Set();
	let userCursor;
	let userPages = 0;
	do {
		const params = new URLSearchParams({ limit: "50", q: "oma-scale-" });
		if (userCursor) params.set("cursor", userCursor);
		const page = (await request(`/v1/admin/users?${params}`, { cookie: first.cookie })).data;
		assert.ok(page.items.length > 0 && page.items.length <= 50, "User pages must remain bounded");
		for (const user of page.items) {
			assert.ok(!scaleIds.has(user.id), "A cursor must not return a duplicate user");
			assert.ok(user.email.startsWith("oma-scale-"), "Search must filter before pagination");
			scaleIds.add(user.id);
		}
		userCursor = page.nextCursor;
		assert.ok(++userPages <= 21, "Cursor pagination must terminate");
	} while (userCursor);
	assert.equal(scaleIds.size, 1001);
	assert.equal(userPages, 21);
	const searchedUser = (await request("/v1/admin/users?q=oma-scale-1001%40local.test", { cookie: first.cookie })).data;
	assert.equal(searchedUser.items.length, 1);
	assert.equal(searchedUser.items[0].id, "scale-user-1001");
	assert.equal(searchedUser.nextCursor, null);
	console.log(`Admin paging: 1,001 isolated accounts, 21 pages, ${Math.round(performance.now() - scaleStart)}ms total HTTP time (local only).`);
	await pool.query(`DELETE FROM "user" WHERE id LIKE 'scale-user-%'`);
	pass("admin paging/search return all 1,001 isolated accounts in bounded, unique pages");
	await pool.query("UPDATE \"user\" SET role = 'user' WHERE id = $1", [profile.id]);
	pass("admin analytics enforce roles, fill empty buckets, exclude refunds, retain failover and unknown costs, and paginate searchable metadata logs");

	await request("/v1/usage/summary", { expected: 401 });
	await pool.query(`INSERT INTO usage_records (request_id, user_id, model, provider, input_tokens, output_tokens, cost_cents, markup_cents, total_cents, status, created_at)
	 SELECT 'user-bulk-' || n, $1, 'minimax-m2-7', 'oma-ai', CASE WHEN n<=2 THEN 2000000000 ELSE 2 END, CASE WHEN n<=2 THEN 2000000000 ELSE 1 END, 0, 0, 0, 'free_tier',
	 date_trunc('milliseconds', now()-interval '22 hours') + n * interval '1 microsecond' FROM generate_series(1,2001) n`, [profile.id]);
	await pool.query(`INSERT INTO usage_records (request_id, user_id, model, provider, input_tokens, output_tokens, cost_cents, markup_cents, total_cents, status, refunded_at, created_at)
	 VALUES ('user-tiny', $1, 'minimax-m2-7', 'oma-ai', 1, 2, 0, 0, 0.00000600, 'completed', NULL, now()-interval '22 hours'),
	 ('user-refund', $1, 'claude-opus-5', 'venice', 1, 1, 0, 0, 2, 'completed', now(), now()-interval '22 hours'),
	 ('user-cancel', $1, 'minimax-m2-7', 'oma-ai', 0, 0, 0, 0, 0, 'aborted', NULL, now()-interval '22 hours'),
	 ('user-error', $1, 'minimax-m2-7', 'oma-ai', 0, 0, 0, 0, 0, 'error', NULL, now()-interval '22 hours'),
	 ('user-old', $1, 'minimax-m2-7', 'oma-ai', 0, 0, 0, 0, 5, 'completed', NULL, now()-interval '45 days'),
	 ('other-user-private', 'admin-test-target', 'claude-opus-5', 'venice', 1, 1, 0, 0, 9999, 'completed', NULL, now())`, [profile.id]);
	const userSummaryResult = await request("/v1/usage/summary?range=7d&timezone=America%2FMoncton", { cookie: first.cookie });
	const userSummary = userSummaryResult.data;
	assert.equal(userSummaryResult.response.headers.get("cache-control"), "no-store");
	assert.equal(userSummary.totals.requests, 2008, "Summary must include more than the old 2000-record cap");
	assert.ok(userSummary.totals.input_tokens > 2147483647, "Token totals must not overflow PostgreSQL int32");
	assert.equal(userSummary.last24h.requests, 2008, "Rolling 24h includes yesterday's recent requests");
	assert.equal(userSummary.last24h.errors, 2);
	assert.equal(userSummary.last24h.aborted, 1);
	assert.equal(Number(userSummary.totals.billed_cents), 4.000006);
	assert.equal(userSummary.lifetimeRequests, 2009);
	assert.equal(userSummary.timeline.reduce((sum,r)=>sum+r.requests,0), 2008);
	assert.equal(userSummary.models.reduce((sum,r)=>sum+r.requests,0), 2008);
	assert.equal(userSummary.providers.reduce((sum,r)=>sum+r.requests,0), 2008);
	assert.equal((await request("/v1/usage/summary?range=all", { cookie: first.cookie })).data.totals.requests, 2009);
	const exportRange = new URLSearchParams({ format: "json", since: userSummary.from, until: userSummary.to, userId: "admin-test-target" });
	const rangedExport = await request(`/v1/export/usage?${exportRange}`, { cookie: first.cookie });
	assert.equal(rangedExport.data.length, userSummary.totals.requests, "Export must match the selected dashboard range");
	assert.ok(rangedExport.data.every(row => row.request_id !== "user-old" && row.request_id !== "other-user-private"));
	assert.equal(rangedExport.response.headers.get("X-Export-Row-Count"), String(userSummary.totals.requests));
	assert.equal(rangedExport.response.headers.get("X-Export-Truncated"), "false");
	assert.equal(rangedExport.response.headers.get("cache-control"), "private, no-store");
	assert.equal(rangedExport.data.find(row => row.request_id === "user-tiny").billed_cents, "0.00000600");
	assert.equal(Number(rangedExport.data.find(row => row.request_id === "user-refund").billed_cents), 0);
	await request("/v1/export/usage?since=invalid", { cookie: first.cookie, expected: 400 });
	await request("/v1/export/usage?format=json", { expected: 401 });
	pass("usage exports match the dashboard date range, retain precision/refunds, exclude other accounts and report their bounded row count");
	const summaryExport = (await request("/v1/export/summary?format=json", { cookie: first.cookie })).data;
	assert.equal(summaryExport.total_input_tokens, userSummary.totals.input_tokens);
	assert.equal(summaryExport.total_output_tokens, userSummary.totals.output_tokens);
	assert.equal(Number(summaryExport.total_cost_cents), 9.000006);
	await pool.query('UPDATE "user" SET role = \'admin\' WHERE id = $1', [profile.id]);
	const opsSnapshot = (await request("/v1/ops/snapshot", { cookie: first.cookie })).data;
	assert.equal(opsSnapshot.chat24h.available, true);
	assert.equal(opsSnapshot.chat24h.inputTokens, userSummary.totals.input_tokens + 1);
	assert.equal(opsSnapshot.chat24h.outputTokens, userSummary.totals.output_tokens + 1);
	assert.equal(opsSnapshot.chat24h.totalTokens, opsSnapshot.chat24h.inputTokens + opsSnapshot.chat24h.outputTokens);
	assert.ok(opsSnapshot.chat24h.topModels.some(m => m.tokens > 4_000_000_000));
	const largeTimeline = (await request("/v1/admin/usage/timeline?days=7", { cookie: first.cookie })).data;
	assert.equal(largeTimeline.items.reduce((sum, row) => sum + row.tokens, 0), opsSnapshot.chat24h.totalTokens);
	await pool.query('UPDATE "user" SET role = \'user\' WHERE id = $1', [profile.id]);
	pass("summary exports and admin snapshots/trends preserve large input/output totals without per-row or aggregate overflow");
	// Force an actual database failure only in this disposable database.
	await pool.query('ALTER TABLE usage_records RENAME TO usage_records_unavailable');
	try {
		const failedExport = await request("/v1/export/summary?format=json", { cookie: first.cookie, expected: 500 });
		assert.equal(failedExport.data.error.message, "Internal server error");
		assert.doesNotMatch(JSON.stringify(failedExport.data), /select|usage_records|params:|person@example/i);
	} finally {
		await pool.query('ALTER TABLE usage_records_unavailable RENAME TO usage_records');
	}
	pass("database failures return safe errors without exposing queries, parameters or account identifiers");
	await request("/v1/usage/summary?range=invalid", { cookie: first.cookie, expected: 400 });
	await request("/v1/usage/summary?timezone=invalid", { cookie: first.cookie, expected: 400 });
	await request("/v1/usage?cursor=invalid", { cookie: first.cookie, expected: 400 });
	await request("/v1/usage?since=2026-02-02T00:00:00Z&until=2026-01-01T00:00:00Z", { cookie: first.cookie, expected: 400 });
	const seen = new Set();
	let usageCursor;
	do {
		const qs = new URLSearchParams({ limit: '500' });
		if (usageCursor) qs.set('cursor', usageCursor);
		const usagePage = (await request(`/v1/usage?${qs}`, { cookie: first.cookie })).data;
		assert.equal(usagePage.totals.requests, 2009, "Totals cannot shrink with the cursor");
		assert.equal(Number(usagePage.totals.cost_cents), 9.000006);
		for (const row of usagePage.data) {
			assert.ok(!seen.has(row.id), "No repeated rows across cursor pages"); seen.add(row.id);
			assert.notEqual(row.requestId, 'other-user-private');
			if (row.refundedAt) assert.equal(Number(row.billedCents), 0);
		}
		usageCursor = usagePage.next_cursor;
	} while (usageCursor);
	assert.equal(seen.size, 2009, "Microsecond cursor pagination must not skip rows");
	const activity = (await request("/v1/credits/transactions?limit=200", { cookie: first.cookie })).data.transactions;
	assert.ok(activity.some(t=>t.type==='usage' && t.amountCents<0), "Usage is a debit");
	assert.ok(activity.some(t=>t.type==='refund' && t.amountCents>0), "Refunds are separate credits");
	await request("/v1/credits/transactions?limit=invalid", { cookie: first.cookie, expected: 400 });
	pass("customer statistics cover the full range, preserve tiny charges, separate cancellations/refunds, isolate accounts and paginate every microsecond row");

	const refundCustomer = await magicSignIn("refund-customer@example.com");
	const refundOwner = (await request("/user", { cookie: refundCustomer.cookie })).data.id;
	const refundUsage = (await pool.query(`INSERT INTO usage_records
	 (request_id, user_id, model, provider, cost_cents, markup_cents, total_cents)
	 VALUES ('refund-auth-charge', $1, 'minimax-m2-7', 'oma-ai', 0, 0, 0.25) RETURNING id`, [refundOwner])).rows[0].id;
	await request("/v1/refunds", { expected: 401 });
	await request("/v1/admin/refunds", { cookie: refundCustomer.cookie, expected: 403 });
	const refundBody = { usageId: refundUsage, reason: "Provider returned an unusable answer." };
	await request("/v1/refunds", { method: "POST", cookie: first.cookie, body: refundBody, expected: 404 });
	await request("/v1/refunds", { method: "POST", cookie: refundCustomer.cookie, body: refundBody, headers: { Origin: "https://untrusted.example" }, expected: 403 });
	await request("/v1/refunds", { method: "POST", cookie: refundCustomer.cookie, body: refundBody, headers: { Origin: "" }, expected: 403 });
	const refund = (await request("/v1/refunds", { method: "POST", cookie: refundCustomer.cookie, body: refundBody })).data;
	assert.equal(refund.amountCents, 0.25);
	const ownRefunds = await request("/v1/refunds", { cookie: refundCustomer.cookie });
	assert.match(ownRefunds.response.headers.get("cache-control"), /no-store/);
	assert.equal(ownRefunds.data.data[0].id, refund.id);
	assert.equal(ownRefunds.data.creditRefundsAvailable, true);
	assert.equal((await request("/v1/refunds", { cookie: first.cookie })).data.data.length, 0);
	await request("/v1/admin/refunds", { method: "POST", cookie: refundCustomer.cookie, body: { id: refund.id, decision: "granted" }, expected: 403 });
	await request("/v1/admin/refunds", { method: "POST", cookie: first.cookie, body: { id: refund.id, decision: "granted" }, expected: 403 });
	await pool.query('UPDATE "user" SET role = \'admin\' WHERE id = $1', [profile.id]);
	const beforeRefund = (await pool.query("SELECT balance_cents FROM credit_balances WHERE user_id=$1", [refundOwner])).rows[0];
	await request("/v1/admin/refunds", { method: "POST", cookie: first.cookie, body: { id: refund.id, decision: "granted", adminNote: "Confirmed provider error." } });
	const afterRefund = (await pool.query("SELECT balance_cents FROM credit_balances WHERE user_id=$1", [refundOwner])).rows[0];
	assert.equal(Number(afterRefund.balance_cents) - Number(beforeRefund.balance_cents), 0.25);
	assert.equal((await request("/v1/refunds", { cookie: refundCustomer.cookie })).data.data[0].adminNote, "Confirmed provider error.");
	await request("/v1/admin/refunds", { method: "POST", cookie: first.cookie, body: { id: refund.id, decision: "denied" }, expected: 409 });
	await pool.query('UPDATE "user" SET role = \'user\' WHERE id = $1', [profile.id]);
	const refundKey = (await request("/v1/keys", { method: "POST", cookie: refundCustomer.cookie, body: { name: "Refund integration key" } })).data;
	const bearerRefundUsage = (await pool.query(`INSERT INTO usage_records
	 (request_id, user_id, model, provider, cost_cents, markup_cents, total_cents)
	 VALUES ('refund-bearer-charge', $1, 'minimax-m2-7', 'oma-ai', 0, 0, 0.5) RETURNING id`, [refundOwner])).rows[0].id;
	const bearerRefundBody = { ...refundBody, usageId: bearerRefundUsage };
	const bearerRefundHeaders = { Authorization: `Bearer ${refundKey.key}` };
	await request("/v1/refunds", { method: "POST", cookie: refundCustomer.cookie, body: bearerRefundBody,
		headers: { ...bearerRefundHeaders, Origin: "https://untrusted.example" }, expected: 403 });
	await request("/v1/refunds", { method: "POST", body: bearerRefundBody, headers: { ...bearerRefundHeaders, Origin: "" } });
	pass("refunds enforce real session ownership, admin roles and origins, return fractional credits once, and expose the review to its owner");

	const signedOut = await request("/api/auth/sign-out", { method: "POST", cookie: first.cookie, body: {} });
	assert.ok(signedOut.response.headers.getSetCookie().some((cookie) => /oma\.session_token=;.*Max-Age=0/i.test(cookie)));
	await assertSignedOut(first.cookie);
	const returning = await magicSignIn(email);
	assert.equal((await request("/user", { cookie: returning.cookie })).data.id, profile.id);
	pass("sign-out clears the cookie and rejects replay; returning magic-link login keeps the same account");

	await pool.query("UPDATE session SET created_at = now() - interval '25 hours', updated_at = now() WHERE user_id = $1", [profile.id]);
	const staleDeletion = await request("/account", { method: "DELETE", cookie: returning.cookie, expected: 400 });
	assert.equal(staleDeletion.data.error.type, "session_not_fresh");
	assert.equal((await request("/user", { cookie: returning.cookie })).data.id, profile.id);
	pass("account deletion rejects an old session even after refresh and preserves the account");

	const freshDeletionSession = await magicSignIn(email);
	const deletedAccount = await request("/account", { method: "DELETE", cookie: freshDeletionSession.cookie });
	const deletionCookies = deletedAccount.response.headers.getSetCookie();
	assert.ok(deletionCookies.some((cookie) => /oma_api_key=;.*Max-Age=0/i.test(cookie)));
	assert.ok(deletionCookies.some((cookie) => /^oma\.session_token=;.*Max-Age=0/i.test(cookie)));
	assert.ok(deletionCookies.some((cookie) => /^__Secure-oma\.session_token=;.*Max-Age=0/i.test(cookie)));
	await assertSignedOut(freshDeletionSession.cookie);
	await assertSignedOut(returning.cookie);
	const recreated = await otpSignIn(email);
	assert.notEqual(recreated.data.user.id, profile.id);
	const repeatedGrant = await pool.query("SELECT count(*)::int AS count FROM credit_grants WHERE email_normalized = $1", [email]);
	assert.equal(repeatedGrant.rows[0].count, 1);
	const recreatedBalance = await pool.query("SELECT balance_cents FROM credit_balances WHERE user_id = $1", [recreated.data.user.id]);
	assert.equal(Number(recreatedBalance.rows[0]?.balance_cents ?? 0), 0);
	pass("account deletion revokes sessions and re-signup cannot claim a second trial");

	const apiTester = await magicSignIn("api-retry-test@example.com");
	const apiTesterId = (await request("/user", { cookie: apiTester.cookie })).data.id;
	const retryKey = (await request("/v1/keys", { method: "POST", cookie: apiTester.cookie, body: { name: "Local retry tests", expiresInDays: 1, allowedModels: ["google-gemma-4-31b-it"] } })).data;
	const retryHeaders = { Authorization: `Bearer ${retryKey.key}`, "Idempotency-Key": "concurrent-client-retry" };
	const completionBody = { model: "google-gemma-4-31b-it", messages: [{ role: "user", content: "Return LOCAL_OK" }], max_tokens: 8, stream: false };
	const providerStarted = new Promise(resolve => { providerEntered = resolve; });
	const firstCall = request("/v1/chat/completions", { method: "POST", headers: retryHeaders, body: completionBody });
	await providerStarted;
	const inFlight = await request("/v1/messages", { method: "POST", headers: retryHeaders, body: completionBody, expected: 409 });
	assert.equal(inFlight.data.error.code, "request_in_progress"); assert.equal(providerCalls, 1);
	providerRelease(); assert.equal((await firstCall).data.choices[0].message.content, "LOCAL_OK");
	const replayKey = (await request("/v1/keys", { method: "POST", cookie: apiTester.cookie, body: { name: "Local cross-key replay", expiresInDays: 1, allowedModels: ["google-gemma-4-31b-it"] } })).data;
	const replayed = await request("/v1/chat/completions", { method: "POST", headers: { ...retryHeaders, Authorization: `Bearer ${replayKey.key}` }, body: completionBody, expected: 409 });
	assert.equal(replayed.data.error.code, "already_processed"); assert.equal(providerCalls, 1);
	const billed = await pool.query("SELECT request_id,total_cents FROM usage_records WHERE user_id=$1 AND status='completed'", [apiTesterId]);
	assert.equal(billed.rowCount, 1); assert.ok(Number(billed.rows[0].total_cents) > 0);
	pass("real API key concurrent retries across both endpoints make one upstream call and one ledger charge");

	const streamHeaders = { ...retryHeaders, "Idempotency-Key": "stream-client-retry", "Content-Type": "application/json" };
	const streamed = await fetch(`${origin}/v1/chat/completions`, { method: "POST", headers: streamHeaders, body: JSON.stringify({ ...completionBody, stream: true }), signal: AbortSignal.timeout(20_000) });
	assert.equal(streamed.status, 200); const reader = streamed.body.getReader(); await reader.read();
	assert.equal((await request("/v1/chat/completions", { method: "POST", headers: streamHeaders, body: completionBody, expected: 409 })).data.error.code, "request_in_progress");
	providerRelease(); while (!(await reader.read()).done) { /* Consume the real SSE stream and its metering finalizer. */ }
	// A second key cannot reset the five-call account emergency budget.
	const cappedReplay = await request("/v1/messages", { method: "POST", headers: { ...streamHeaders, Authorization: `Bearer ${replayKey.key}` }, body: completionBody, expected: 503 });
	assert.equal(cappedReplay.data.error.code, "rate_limit_unavailable");
	assert.equal(providerCalls, 2);
	assert.equal((await pool.query("SELECT count(*)::int n FROM usage_records WHERE user_id=$1 AND status='completed'", [apiTesterId])).rows[0].n, 2);
	await request(`/v1/keys/${retryKey.id}`, { method: "DELETE", cookie: apiTester.cookie });
	await request(`/v1/keys/${replayKey.id}`, { method: "DELETE", cookie: apiTester.cookie });
	await request("/v1/chat/completions", { method: "POST", headers: retryHeaders, body: completionBody, expected: 401 });
	pass("streamed API responses hold retry protection through token metering, and revoked test keys fail immediately");

	const wallet = privateKeyToAccount(generatePrivateKey());
	const nonce = (await request("/api/auth/siwe/nonce", { method: "POST", body: {} })).data.nonce;
	const message = createSiweMessage({
		address: wallet.address, chainId: 8453, domain: new URL(origin).host,
		nonce, uri: origin, version: "1", statement: "Sign in to OMA AI.",
	});
	const signature = await wallet.signMessage({ message });
	const walletSession = await request("/api/auth/siwe/verify", { method: "POST", body: { message, signature } });
	assert.equal((await request("/user", { cookie: walletSession.cookie })).data.evmAddress, wallet.address);
	await request("/api/auth/siwe/verify", { method: "POST", body: { message, signature }, expected: 401 });
	pass("SIWE verifies a real local signature, binds the wallet, and rejects nonce replay");

	const attachOwner = await magicSignIn("attach-owner@local.test");
	const attachOther = await magicSignIn("attach-other@local.test");
	const attachOwnerId = (await request("/user", { cookie: attachOwner.cookie })).data.id;
	const attachWallet = privateKeyToAccount(generatePrivateKey());
	redisFixtureReady = true;
	const redisRecoveryDeadline = Date.now() + 35_000;
	while (true) {
		const readiness = await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(20_000) });
		await readiness.arrayBuffer();
		if (readiness.ok) break;
		assert.ok(Date.now() < redisRecoveryDeadline, "The local Redis REST fixture did not become ready");
		await delay(250);
	}
	async function attachmentBody(challenge) {
		const message = createSiweMessage({ address: attachWallet.address, chainId: challenge.chainId, domain: challenge.domain,
			nonce: challenge.nonce, uri: origin, version: "1" });
		return { address: attachWallet.address, message, signature: await attachWallet.signMessage({ message }) };
	}
	async function attachmentChallenge() {
		return (await request("/v1/user/attach-wallet/nonce", { method: "POST", cookie: attachOwner.cookie, body: {} })).data;
	}
	await request("/v1/user/attach-wallet/nonce", { method: "POST", body: {}, expected: 401 });
	const staleBody = await attachmentBody({ nonce: "oldsignature123", chainId: 8453, domain: new URL(origin).host });
	for (const path of ["/v1/user/attach-wallet/nonce", "/v1/user/attach-wallet"]) {
		for (const Origin of ["", "https://untrusted.example"]) {
			await request(path, { method: "POST", cookie: attachOwner.cookie,
				body: path.endsWith("/nonce") ? {} : staleBody, headers: { Origin }, expected: 403 });
		}
	}
	await request("/v1/user/attach-wallet", { method: "POST", cookie: attachOwner.cookie, body: staleBody, expected: 400 });
	const wrongPurposeNonce = (await request("/api/auth/siwe/nonce", { method: "POST", body: {} })).data.nonce;
	await request("/v1/user/attach-wallet", { method: "POST", cookie: attachOwner.cookie,
		body: await attachmentBody({ nonce: wrongPurposeNonce, chainId: 8453, domain: new URL(origin).host }), expected: 400 });
	const crossAccount = await attachmentChallenge();
	await request("/v1/user/attach-wallet", { method: "POST", cookie: attachOther.cookie, body: await attachmentBody(crossAccount), expected: 400 });
	const expiredAttach = await attachmentChallenge();
	await pool.query("UPDATE verification SET expires_at=now()-interval '1 second' WHERE identifier=$1", [`wallet-attach:${expiredAttach.nonce}`]);
	await request("/v1/user/attach-wallet", { method: "POST", cookie: attachOwner.cookie, body: await attachmentBody(expiredAttach), expected: 400 });
	assert.equal((await pool.query("SELECT 1 FROM wallet_address WHERE address=$1", [attachWallet.address])).rowCount, 0);
	const validAttach = await attachmentChallenge();
	assert.equal(validAttach.domain, new URL(origin).host);
	assert.equal(validAttach.chainId, 8453);
	const signedAttach = await attachmentBody(validAttach);
	// Bypass the helper's single-status assertion for this deliberate race.
	const concurrentAttach = await Promise.all([1, 2].map(() => fetch(`${origin}/v1/user/attach-wallet`, {
		method: "POST", headers: { Origin: origin, Cookie: attachOwner.cookie, "Content-Type": "application/json" }, body: JSON.stringify(signedAttach), signal: AbortSignal.timeout(20_000),
	})));
	assert.deepEqual(concurrentAttach.map(response => response.status).sort(), [200, 400]);
	for (const response of concurrentAttach) await response.arrayBuffer();
	await request("/v1/user/attach-wallet", { method: "POST", cookie: attachOwner.cookie, body: signedAttach, expected: 400 });
	const attached = await pool.query("SELECT user_id, chain_id FROM wallet_address WHERE address=$1", [attachWallet.address]);
	assert.equal(attached.rowCount, 1); assert.equal(attached.rows[0].user_id, attachOwnerId); assert.equal(attached.rows[0].chain_id, 8453);
	assert.equal((await request("/user", { cookie: attachOwner.cookie })).data.evmAddress, attachWallet.address);
	pass("wallet attachment binds a fresh single-use account/purpose challenge and rejects stale, expired, cross-account and concurrent replay signatures");
	const attachedLoginNonce = (await request("/api/auth/siwe/nonce", { method: "POST", body: {} })).data.nonce;
	const attachedLogin = await attachmentBody({ nonce: attachedLoginNonce, domain: validAttach.domain, chainId: validAttach.chainId });
	const attachedSession = await request("/api/auth/siwe/verify", { method: "POST", body: { message: attachedLogin.message, signature: attachedLogin.signature } });
	assert.equal(attachedSession.data.user.id, attachOwnerId);
	assert.equal((await request("/user", { cookie: attachedSession.cookie })).data.id, attachOwnerId);
	assert.equal((await pool.query('SELECT count(*)::int AS count FROM "user" WHERE evm_address=$1', [attachWallet.address])).rows[0].count, 1);
	pass("email signup followed by wallet attachment and SIWE sign-in keeps the same account and verified wallet");

	const seeder = spawn(process.execPath, ["scripts/seed-test-auth.mjs"], {
		cwd: serverDir,
		env: { NODE_ENV: "development", DATABASE_URL: databaseUrl.toString(), TEST_APP_ORIGIN: origin },
		stdio: ["ignore", "pipe", "pipe"],
	});
	let seedOutput = "";
	seeder.stdout.on("data", (chunk) => { seedOutput += chunk; });
	assert.equal((await once(seeder, "exit"))[0], 0, "Test auth seeder failed");
	const fixtureLinks = [...seedOutput.matchAll(/magic link: (\S+)/g)];
	assert.equal(fixtureLinks.length, 2);
	for (const [index, [, link]] of fixtureLinks.entries()) {
		const url = new URL(link);
		const fixture = await request(`${url.pathname}${url.search}`, { expected: 302 });
		assert.doesNotMatch(fixture.response.headers.get("location"), /error=/);
		assert.equal((await request("/user", { cookie: fixture.cookie })).data.role, index === 0 ? "user" : "admin");
	}
	pass("seeded user/admin magic links authenticate against the real hashed-token verifier");
	const operations = Object.entries(publicSpec.paths).flatMap(([path, item]) =>
		Object.keys(item).filter(method => ["get", "post", "put", "patch", "delete"].includes(method)).map(method => `${method.toUpperCase()} ${path}`));
	const missing = operations.filter(operation => !publicObservations.some(row => row.operation === operation));
	assert.deepEqual(missing, [], "Every currently published public OpenAPI operation must be exercised over real HTTP");
	if (process.env.AUTH_TEST_REPORT_PATH) await writeFile(process.env.AUTH_TEST_REPORT_PATH, JSON.stringify({ checkedAt: new Date().toISOString(), environment: "isolated-local-http-postgres", provider: "local-fixture-only", paidProviderCalls: 0, onChainBroadcasts: 0, operations: operations.map(operation => ({ operation, observedStatuses: [...new Set(publicObservations.filter(row => row.operation === operation).map(row => row.status))] })), observations: publicObservations }, null, 2) + "\n");
	pass(`all ${operations.length} published public OpenAPI operations exercised over real HTTP`);
	console.log(`All ${passed} real auth integration checks passed.`);
} finally {
	providerRelease?.(); provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve));
	if (backend && backend.exitCode === null) {
		const stopped = once(backend, "exit");
		backend.kill("SIGTERM");
		await stopped;
	}
	redisFixture.closeAllConnections(); await new Promise(resolve => redisFixture.close(resolve));
	if (pool) await pool.end();
	if (databaseCreated) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
	await admin.end();
}
