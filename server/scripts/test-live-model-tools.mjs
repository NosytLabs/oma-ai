/** Opt-in provider check through a real, loopback OMA website session. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import { localTestContext } from "./local-test-context.mjs";

if (!process.argv.includes("--run")) {
	console.log("Opt-in check: node --env-file=.env scripts/test-live-model-tools.mjs --run. Uses two sponsored MiniMax requests and the existing local test user.");
	process.exit(0);
}
const { databaseUrl, appOrigin } = localTestContext();
const pool = new pg.Pool({ connectionString: databaseUrl.toString() });
const verificationId = crypto.randomBytes(16).toString("hex");
let sessionId;
try {
	assert.equal((await pool.query('SELECT id FROM "user" WHERE email = $1', ["oma-test-user@local.test"])).rowCount, 1, "Seed local test accounts first");
	const raw = crypto.randomBytes(24).toString("base64url");
	await pool.query("INSERT INTO verification (id,identifier,value,expires_at) VALUES ($1,$2,$3,$4)", [verificationId,
		`magic-link:${crypto.createHash("sha256").update(raw).digest("base64url")}`,
		JSON.stringify({ type: "magic-link", email: "oma-test-user@local.test", name: "OMA Test User" }), new Date(Date.now() + 60_000)]);
	const login = await fetch(`${appOrigin}/api/auth/magic-link/verify?token=${raw}&callbackURL=%2Fdashboard`, { redirect: "manual" });
	assert.equal(login.status, 302, "Local sign-in failed");
	const cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
	sessionId = (await fetch(`${appOrigin}/api/auth/get-session`, { headers: { Cookie: cookie } }).then(response => response.json())).session.id;
	const headers = { Origin: appOrigin, Cookie: cookie, "Content-Type": "application/json", "X-OMA-Source": "website" };
	async function completion(body) {
		const start = Date.now();
		const response = await fetch(`${appOrigin}/api/chat/completions`, { method: "POST", headers,
			body: JSON.stringify({ model: "minimax-m2-7", max_tokens: 512, stream: true, ...body }), signal: AbortSignal.timeout(150_000) });
		assert.equal(response.status, 200, `Model returned HTTP ${response.status}`);
		const text = await response.text();
		const tools = new Map();
		let content = "", usage, finishReason;
		for (const line of text.split("\n")) {
			if (!line.startsWith("data:")) continue;
			const payload = line.slice(5).trim();
			if (!payload || payload === "[DONE]") continue;
			const frame = JSON.parse(payload), choice = frame.choices?.[0];
			content += choice?.delta?.content ?? "";
			usage = frame.usage ?? usage;
			finishReason = choice?.finish_reason ?? finishReason;
			for (const part of choice?.delta?.tool_calls ?? []) {
				const index = part.index ?? 0, tool = tools.get(index) ?? { id: "", name: "", arguments: "" };
				tool.id = part.id ?? tool.id;
				tool.name += part.function?.name ?? "";
				tool.arguments += part.function?.arguments ?? "";
				tools.set(index, tool);
			}
		}
		return { content, usage, finishReason, tools: [...tools.values()], elapsedMs: Date.now() - start };
	}
	const messages = [{ role: "user", content: "Call add with a=2 and b=2. Do not calculate yourself." }];
	const definitions = [{ type: "function", function: {
		name: "add", description: "Add two integers", parameters: { type: "object", properties: { a: { type: "integer" }, b: { type: "integer" } }, required: ["a", "b"] },
	} }];
	const first = await completion({ messages, tool_choice: "auto", tools: definitions });
	console.log(JSON.stringify({ check: "MiniMax tool call", ...first }));
	assert.equal(first.tools[0]?.name, "add");
	assert.deepEqual(JSON.parse(first.tools[0].arguments), { a: 2, b: 2 });
	assert.equal(first.finishReason, "tool_calls");
	assert.ok(Number.isInteger(first.usage?.prompt_tokens), "Stream must include upstream token totals");
	const tool = first.tools[0];
	// Diagnostic variant: determine whether upstream reasoning in assistant content
	// causes the malformed continuation. The final answer assertion stays strict.
	const omitAssistantContent = process.argv.includes("--omit-assistant-content");
	const second = await completion({ tools: definitions, tool_choice: "none", messages: [...messages,
		{ role: "assistant", content: omitAssistantContent ? null : first.content || null, tool_calls: [{ id: tool.id, type: "function", function: { name: tool.name, arguments: tool.arguments } }] },
		{ role: "tool", tool_call_id: tool.id, content: "4" }, { role: "user", content: "Return only the answer." },
	] });
	console.log(JSON.stringify({ check: "MiniMax tool result continuation", omitAssistantContent, ...second }));
	assert.equal(second.content.trim(), "4");
	assert.equal(second.finishReason, "stop");
} finally {
	if (sessionId) await pool.query("DELETE FROM session WHERE id=$1", [sessionId]);
	await pool.query("DELETE FROM verification WHERE id=$1", [verificationId]);
	await pool.end();
}
