import { describe, expect, it } from "vitest";
import { getOpenApiServers, getPublicOpenApiSpec } from "../openapi.js";

describe("getOpenApiServers", () => {
	it("does not label a local endpoint as production or duplicate it", () => {
		expect(getOpenApiServers("http://localhost:3001", 3001)).toEqual([
			{ url: "http://localhost:3001", description: "Local development" },
		]);
	});

	it("uses the active local port instead of a stale public URL port", () => {
		expect(getOpenApiServers("http://localhost:3001", 3002)).toEqual([
			{ url: "http://localhost:3002", description: "Local development" },
		]);
	});

	it("includes production and local endpoints for a public API URL", () => {
		expect(getOpenApiServers("https://api.oma-ai.com", 3001)).toEqual([
			{ url: "https://api.oma-ai.com", description: "Production" },
			{ url: "http://localhost:3001", description: "Local development" },
		]);
	});
});

describe("getPublicOpenApiSpec", () => {
	it("excludes admin and operational endpoints", () => {
		const paths = getPublicOpenApiSpec().paths;
		for (const path of [
			"/v1/site-settings",
			"/v1/admin/site-settings",
			"/v1/admin/credit-adjust",
			"/v1/admin/user-suspend",
			"/v1/admin/rate-limit-override",
			"/v1/admin/users",
		]) {
			expect(paths).not.toHaveProperty(path);
		}
	});
});
