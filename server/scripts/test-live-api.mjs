/** Opt-in, real-provider API checks using a temporary local fixture key. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";
import { localTestContext } from "./local-test-context.mjs";

if (!process.argv.includes("--run")) {
	console.log("Opt-in: node --env-file=.env scripts/test-live-api.mjs --run [--models=id,id]. Calls real providers with at most 512 output tokens per model; revokes its temporary key and session.");
	process.exit(0);
}

const { databaseUrl, appOrigin } = localTestContext();
const formats = process.argv.find(a => a.startsWith("--formats="))?.slice(10).split(",") ?? ["chat"];
assert.ok(formats.length > 0 && formats.every(f => ["chat", "messages"].includes(f)), "Supported formats: chat,messages");
const pool = new pg.Pool({ connectionString: databaseUrl.toString() });
const verificationId = crypto.randomBytes(16).toString("hex");
const report = { startedAt: new Date().toISOString(), results: [], checks: {}, cleanup: {} };
let cookie, sessionId, userId, keyId, key;
const headers = () => ({ Origin: appOrigin, Cookie: cookie, "Content-Type": "application/json" });
try {
	const user = (await pool.query('SELECT id FROM "user" WHERE email=$1', ["oma-test-user@local.test"])).rows[0];
	assert.ok(user, "Seed the current local test user first");
	userId = user.id;
	const token = crypto.randomBytes(24).toString("base64url");
	await pool.query("INSERT INTO verification (id,identifier,value,expires_at) VALUES ($1,$2,$3,$4)", [verificationId,
		`magic-link:${crypto.createHash("sha256").update(token).digest("base64url")}`,
		JSON.stringify({ type: "magic-link", email: "oma-test-user@local.test", name: "OMA Test User" }), new Date(Date.now() + 60_000)]);
	const login = await fetch(`${appOrigin}/api/auth/magic-link/verify?token=${token}&callbackURL=%2Fdashboard`, { redirect: "manual" });
	assert.equal(login.status, 302, "Local sign-in failed");
	cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
	assert.ok(cookie, "Magic-link verification did not set a session cookie");
	const signedIn = await fetch(`${appOrigin}/api/auth/get-session`, { headers: headers() }).then(r => r.json());
	assert.ok(signedIn?.session?.id, "Session lookup failed after verification");
	sessionId = signedIn.session.id;
	const catalog = await fetch(`${appOrigin}/api/v1/models`).then(r => r.json());
	const requestedIds = process.argv.find(a => a.startsWith("--models="))?.slice(9).split(",");
	const models = catalog.data.filter(m => m.available && (!requestedIds || requestedIds.includes(m.id)));
	assert.ok(models.length > 0 && models.length <= 30, "No available models selected, or too many");
	if (requestedIds) assert.equal(models.length, new Set(requestedIds).size, "Some requested models are unknown or unavailable");
	console.log(JSON.stringify({ selectedModels: models.map(model => model.id), formats }));
	const created = await fetch(`${appOrigin}/api/v1/keys`, { method: "POST", headers: headers(), body: JSON.stringify({ name: "Temporary live API audit", expiresInDays: 1, allowedModels: models.map(m => m.id) }) });
	assert.equal(created.status, 200, "Key creation failed");
	const credential = await created.json();
	keyId = credential.id;
	report.checks.keyId = keyId;
	key = credential.key;
	assert.match(key, /^oma_sk_/);
	report.checks.keyCreated = true;
	assert.deepEqual(credential.allowedModels, models.map(m => m.id));
	assert.ok(Math.abs(new Date(credential.expiresAt).getTime() - Date.now() - 86_400_000) < 10_000, "Requested key expiry was not applied");
	report.checks.keyScopeAndExpiry = true;
	const before = Number((await pool.query("SELECT balance_cents FROM credit_balances WHERE user_id=$1", [user.id])).rows[0]?.balance_cents);
	for (const model of models) for (const format of formats) {
		const clientCorrelationId = `qa-api-${crypto.randomUUID()}`;
		const started = Date.now();
		let result;
		try {
			const endpoint = format === "messages" ? "/api/v1/messages" : "/api/v1/chat/completions";
			const send = () => fetch(`${appOrigin}${endpoint}`, {
				method: "POST", headers: { ...(format === "messages" ? { "x-api-key": key, "anthropic-version": "2023-06-01" } : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json", "X-Correlation-ID": clientCorrelationId,
					// Copying website headers must not remove the paid API charge.
					Origin: appOrigin, "X-OMA-Source": "website" },
				body: JSON.stringify({ model: model.id, messages: [{ role: "user", content: "Reply with exactly OMA_API_OK and no explanation." }], max_tokens: 512, stream: false }),
				signal: AbortSignal.timeout(190_000),
			});
			let response = await send();
			// Respect the gateway's bounded degraded-mode budget instead of
			// disabling rate limits for provider tests. One retry, at most 60s.
			if ([429, 503].includes(response.status) && response.headers.has("retry-after")) {
				const seconds = Number(response.headers.get("retry-after"));
				if (Number.isFinite(seconds) && seconds > 0 && seconds <= 60) {
					await response.body?.cancel();
					console.log(JSON.stringify({ requestedModel: model.id, waitingForRateLimitSeconds: seconds }));
					await delay(seconds * 1000 + 100);
					response = await send();
				}
			}
			const data = await response.json();
			const content = format === "messages" ? (data.content ?? []).filter(block => block.type === "text").map(block => block.text).join("") : data.choices?.[0]?.message?.content ?? "";
			const inputTokens = format === "messages" ? data.usage?.input_tokens : data.usage?.prompt_tokens;
			const outputTokens = format === "messages" ? data.usage?.output_tokens : data.usage?.completion_tokens;
			const actualModel = response.headers.get("x-actual-model");
			const requestId = response.headers.get("x-oma-request-id");
			// Some reasoning models put a complete <think> block in content.
			// Preserve evidence and assess the final answer separately.
			const answer = typeof content === "string" ? content.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, "").trim() : "";
			result = { format, requestedModel: model.id, status: response.status, actualModel, requestId, correlationId: response.headers.get("x-request-id"), clientCorrelationId,
				finishReason: data.choices?.[0]?.finish_reason, usage: data.usage, content: content.slice(0, 160), answer: answer.slice(0, 160), inlineReasoning: answer !== content.trim(),
				passed: typeof requestId === "string" && requestId.length > 0 && response.ok && actualModel === model.id && answer === "OMA_API_OK" && Number.isInteger(inputTokens) && Number.isInteger(outputTokens),
				...(data.error ? { error: data.error.message } : {}), elapsedMs: Date.now() - started };
		} catch (error) {
			result = { format, requestedModel: model.id, clientCorrelationId, passed: false, error: error.name, elapsedMs: Date.now() - started };
		}
		report.results.push(result);
		console.log(JSON.stringify(result));
	}
	const rows = (await pool.query("SELECT request_id, model, status, api_key_id, input_tokens, output_tokens, total_cents FROM usage_records WHERE user_id=$1 AND api_key_id=$2", [user.id, keyId])).rows;
	const after = Number((await pool.query("SELECT balance_cents FROM credit_balances WHERE user_id=$1", [user.id])).rows[0]?.balance_cents);
	report.checks.usage = rows;
	report.checks.balanceDeductedCents = before - after;
	report.checks.recordedChargeCents = rows.reduce((total, row) => total + Number(row.total_cents), 0);
	report.checks.billingMatches = Math.abs(report.checks.balanceDeductedCents - report.checks.recordedChargeCents) < 0.000001;
	report.checks.usageBoundToKey = rows.length === report.results.filter(r => r.status === 200).length && rows.every(row => row.api_key_id === keyId);
	report.checks.requestIdsMatchUsage = report.results.filter(r => r.status === 200).every(result => rows.some(row => row.request_id === result.requestId));
	report.checks.apiAlwaysBilled = rows.filter(row => row.status === "completed").every(row => Number(row.total_cents) > 0);
	const revoked = await fetch(`${appOrigin}/api/v1/keys/${keyId}`, { method: "DELETE", headers: headers() });
	assert.equal(revoked.status, 200, "Key revocation failed");
	report.cleanup.keyRevoked = true;
	const denied = await fetch(`${appOrigin}/api/v1/usage`, { headers: { Authorization: `Bearer ${key}` } });
	report.checks.revokedKeyStatus = denied.status;
	assert.equal(denied.status, 401, "Revoked key still authenticates");
} finally {
	if (keyId && !report.cleanup.keyRevoked && cookie) {
		const revoked = await fetch(`${appOrigin}/api/v1/keys/${keyId}`, { method: "DELETE", headers: headers() }).catch(() => null);
		report.cleanup.keyRevoked = revoked?.ok ?? false;
	}
	// Local fixtures must not leave a live key behind when the HTTP service
	// disappears during a test. Preserve its ledger rows; revoke only this key.
	if (keyId && userId && !report.cleanup.keyRevoked) {
		const revoked = await pool.query("UPDATE api_keys SET active=false WHERE id=$1 AND user_id=$2 RETURNING id", [keyId, userId]);
		report.cleanup.keyRevoked = revoked.rowCount === 1;
		report.cleanup.keyRevokedDirectly = report.cleanup.keyRevoked;
	}
	if (sessionId) {
		await pool.query("DELETE FROM session WHERE id=$1", [sessionId]);
		report.cleanup.sessionRemoved = true;
	}
	await pool.query("DELETE FROM verification WHERE id=$1", [verificationId]);
	await pool.end();
	key = undefined;
	report.finishedAt = new Date().toISOString();
	await fs.mkdir("../.artifacts/provider-audit", { recursive: true });
	await fs.writeFile("../.artifacts/provider-audit/live-api-results.json", JSON.stringify(report, null, 2));
	console.log(JSON.stringify({ summary: { passed: report.results.filter(r => r.passed).length, total: report.results.length }, checks: { billingMatches: report.checks.billingMatches, requestIdsMatchUsage: report.checks.requestIdsMatchUsage, revokedKeyStatus: report.checks.revokedKeyStatus }, cleanup: report.cleanup }));
}
if (report.results.some(r => !r.passed) || !report.checks.billingMatches || !report.checks.usageBoundToKey || !report.checks.requestIdsMatchUsage || !report.checks.apiAlwaysBilled) process.exitCode = 1;
