/**
 * OpenAPI source must advertise the public surface we ship in llms.txt /
 * agent docs. Parses openapi.ts paths so drift fails CI.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function openapiSourcePaths(): string[] {
	const basePath = process.cwd().endsWith("/server") ? "" : "server/";
	const src = readFileSync(resolve(process.cwd(), basePath + "src/routes/openapi.ts"), "utf8");
	return [...src.matchAll(/"(\/v1\/[^"]+|\/health)":\s*\{/g)].map((m) => m[1]);
}

describe("OpenAPI path inventory", () => {
	const required = [
		"/v1/models",
		"/v1/chat/completions",
		"/v1/messages",
		"/v1/images/generations",
		"/v1/videos/generations",
		"/v1/videos/retrieve",
		"/v1/search",
		"/v1/balance",
		"/v1/keys",
		"/health",
	];

	it("includes required public endpoints", () => {
		const paths = openapiSourcePaths();
		for (const p of required) {
			expect(paths, `missing ${p}`).toContain(p);
		}
	});

	it("registers OpenAPI at /openapi.json and /v1/openapi.json", () => {
		const basePath = process.cwd().endsWith("/server") ? "" : "server/";
		const src = readFileSync(resolve(process.cwd(), basePath + "src/routes/openapi.ts"), "utf8");
		expect(src).toMatch(/openapiRoutes\.get\("\/openapi\.json"/);
		expect(src).toMatch(/openapiRoutes\.get\("\/v1\/openapi\.json"/);
	});
});
