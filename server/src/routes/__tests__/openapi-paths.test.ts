/**
	* OpenAPI source must advertise the public surface we ship in llms.txt /
	* agent docs. Parses openapi.ts paths so drift fails CI.
	*/
import { describe, expect, it } from "vitest";
import { openapiRoutes } from "../openapi.js";

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
		// x402 agent billing
		"/x402/verify",
		"/x402/settle",
		// Liveness
		"/health",
	];

	it("includes required customer endpoints in the served document", async () => {
		const paths = Object.keys((await (await openapiRoutes.request("/openapi.json")).json()).paths);
		for (const p of required) {
			expect(paths, `missing ${p}`).toContain(p);
		}
	});

	it.each(["/openapi.json", "/v1/openapi.json", "/openapi", "/v1/openapi"])("serves the customer contract at %s", async path => {
		const response = await openapiRoutes.request(path);
		expect(response.status).toBe(200);
		const spec = await response.json();
		expect(spec.openapi).toBe("3.1.0");
		expect(Object.keys(spec.paths).some(p => /^\/(?:v1\/admin|internal|website)(?:\/|$)/.test(p))).toBe(false);
	});
});
