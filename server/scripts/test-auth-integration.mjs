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
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

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

const portProbe = createServer();
portProbe.listen(0, "127.0.0.1");
await once(portProbe, "listening");
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const origin = `http://localhost:${port}`;

function pass(message) {
	passed += 1;
	console.log(`PASS ${message}`);
}

async function request(path, { method = "GET", cookie, body, expected = 200, headers = {} } = {}) {
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
	assert.equal(response.status, expected, `${method} ${path.split("?")[0]} returned ${response.status}: ${text}`);
	return {
		response,
		data: text ? JSON.parse(text) : null,
		cookie: response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; "),
	};
}

async function deliverySince(offset, expression) {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		const match = logs.slice(offset).replace(/\u001b\[[0-9;]*m/g, "").match(expression);
		if (match) return match[1];
		await delay(100);
	}
	throw new Error("The local development auth delivery was not logged");
}

async function magicSignIn(email) {
	const offset = logs.length;
	await request("/api/auth/sign-in/magic-link", {
		method: "POST", body: { email, name: "Integration User", callbackURL: `${origin}/settings` },
	});
	const url = new URL(await deliverySince(offset, /magicLink:\s*"([^"]+)"/));
	const token = url.searchParams.get("token");
	const rows = await pool.query("SELECT identifier FROM verification WHERE identifier = $1", [
		createHash("sha256").update(token).digest("base64url"),
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
	await admin.query(`CREATE DATABASE "${databaseName}"`);
	databaseCreated = true;
	pool = new pg.Pool({ connectionString: databaseUrl.toString() });
	await migrate(drizzle(pool), { migrationsFolder: `${serverDir}src/db/migrations` });
	backend = spawn(process.execPath, ["--import", "tsx/esm", "src/index.ts"], {
		cwd: serverDir,
		env: {
			PATH: process.env.PATH,
			NODE_ENV: "development",
			DOTENV_CONFIG_PATH: "/dev/null",
			DATABASE_URL: databaseUrl.toString(),
			PORT: String(port),
			PUBLIC_APP_URL: origin,
			BETTER_AUTH_URL: origin,
			PRIMARY_DOMAIN: "localhost",
			PUBLIC_API_URL: origin,
			CORS_ORIGIN: origin,
			ETH_RPC_URL: "http://127.0.0.1:1",
			LOG_LEVEL: "info",
			OTEL_SDK_DISABLED: "true",
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	backend.stdout.on("data", (chunk) => { logs += chunk; });
	backend.stderr.on("data", (chunk) => { logs += chunk; });
	for (let attempt = 0; !logs.includes("API server running"); attempt += 1) {
		assert.ok(attempt < 150 && backend.exitCode === null, "Local backend failed to start");
		await delay(100);
	}

	await request("/user", { expected: 401 });
	await request("/sessions", { expected: 401 });
	await request("/v1/export/account", { expected: 401 });
	await request("/api/auth/sign-in/magic-link", {
		method: "POST", body: { email: "invalid" }, expected: 400,
	});
	await request("/api/auth/sign-in/magic-link", {
		method: "POST", body: { email: "blocked@local.test" },
		headers: { Origin: "https://untrusted.example" }, expected: 403,
	});
	pass("anonymous access, malformed email, and untrusted sign-in origins are rejected");

	const email = "account-flow@local.test";
	const first = await magicSignIn(email);
	const profile = (await request("/user", { cookie: first.cookie })).data;
	assert.equal(profile.email, email);
	assert.equal((await request("/api/auth/get-session", { cookie: first.cookie })).data.user.emailVerified, true);
	const balance = await pool.query("SELECT balance_cents FROM credit_balances WHERE user_id = $1", [profile.id]);
	assert.equal(Number(balance.rows[0].balance_cents), 100);
	const replay = await request(first.path, { expected: 302 });
	assert.match(replay.response.headers.get("location"), /error=INVALID_TOKEN/);
	assert.doesNotMatch(replay.cookie, /session_token=[^;]/);
	pass("magic-link signup creates a verified user and one trial grant; used links are rejected");

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

	const signedOut = await request("/api/auth/sign-out", { method: "POST", cookie: first.cookie, body: {} });
	assert.ok(signedOut.response.headers.getSetCookie().some((cookie) => /oma\.session_token=;.*Max-Age=0/i.test(cookie)));
	await assertSignedOut(first.cookie);
	const returning = await magicSignIn(email);
	assert.equal((await request("/user", { cookie: returning.cookie })).data.id, profile.id);
	pass("sign-out clears the cookie and rejects replay; returning magic-link login keeps the same account");

	await request("/account", { method: "DELETE", cookie: returning.cookie });
	await assertSignedOut(returning.cookie);
	const recreated = await otpSignIn(email);
	assert.notEqual(recreated.data.user.id, profile.id);
	const repeatedGrant = await pool.query("SELECT count(*)::int AS count FROM credit_grants WHERE email_normalized = $1", [email]);
	assert.equal(repeatedGrant.rows[0].count, 1);
	const recreatedBalance = await pool.query("SELECT balance_cents FROM credit_balances WHERE user_id = $1", [recreated.data.user.id]);
	assert.equal(Number(recreatedBalance.rows[0]?.balance_cents ?? 0), 0);
	pass("account deletion revokes sessions and re-signup cannot claim a second trial");

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
	console.log(`All ${passed} real auth integration checks passed.`);
} finally {
	if (backend && backend.exitCode === null) {
		const stopped = once(backend, "exit");
		backend.kill("SIGTERM");
		await stopped;
	}
	if (pool) await pool.end();
	if (databaseCreated) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
	await admin.end();
}
