/**
	* OpenAPI source must advertise the public surface we ship in llms.txt /
	* agent docs. Parses openapi.ts paths so drift fails CI.
	*/
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function openapiSourcePaths(): string[] {
	const basePath = basename(process.cwd()) === "server" ? "" : "server/";
	const src = readFileSync(resolve(process.cwd(), basePath + "src/routes/openapi.ts"), "utf8");
	// Match /v1/*, /x402/*, /health keys
	return [
		...src.matchAll(/"(\/v1\/[^"]+)":\s*\{/g),
		...src.matchAll(/"(\/x402\/[^"]+)":\s*\{/g),
		...src.matchAll(/"(\/health)":\s*\{/g),
	].map((m) => m[1]);
}

describe("OpenAPI path inventory", () => {
	it("documents session management, history clearing, and fresh-session account deletion", async () => {
		const { Hono } = await import("hono");
		const { openapiRoutes } = await import("../openapi.js");
		const app = new Hono();
		app.route("/", openapiRoutes);
		const spec = await (await app.request("/openapi.json")).json();
		expect(spec.paths["/user"].get).toBeDefined();
		expect(spec.paths["/sessions"].get).toBeDefined();
		expect(spec.paths["/sessions"].delete).toBeDefined();
		expect(spec.paths["/sessions/{id}"].delete).toBeDefined();
		expect(spec.paths["/v1/history"].delete).toBeDefined();
		expect(spec.paths["/account"].delete.security).toEqual([{ SessionCookie: [] }]);
		expect(spec.paths["/account"].delete.responses["400"].description).toMatch(/24 hours/);
	});
	const required = [
		// Public SDK surface
		"/v1/models",
		"/v1/chat/completions",
		"/v1/messages",
		"/v1/search",
		"/v1/balance",
		"/v1/keys",
		"/v1/usage",
		"/v1/deposit/usdc",
		"/v1/usage/today",
		// Public rail status (anon)
		"/v1/site-settings",
		// Admin operator surface
		"/v1/admin/site-settings",
		"/v1/admin/credit-adjust",
		"/v1/admin/user-suspend",
		"/v1/admin/rate-limit-override",
		"/v1/admin/users",
		// x402 agent billing
		"/x402/verify",
		"/x402/settle",
		// Liveness
		"/health",
	];

	it("includes required public endpoints", () => {
		const paths = openapiSourcePaths();
		for (const p of required) {
			expect(paths, `missing ${p}`).toContain(p);
		}
	});

	it("registers OpenAPI at /openapi.json and /v1/openapi.json", () => {
		const basePath = basename(process.cwd()) === "server" ? "" : "server/";
		const src = readFileSync(resolve(process.cwd(), basePath + "src/routes/openapi.ts"), "utf8");
		expect(src).toMatch(/openapiRoutes\.get\("\/openapi\.json"/);
		expect(src).toMatch(/openapiRoutes\.get\("\/v1\/openapi\.json"/);
	});
});
