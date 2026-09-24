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

	it("advertises ONLY the public production URL, never localhost", () => {
		// A public OpenAPI document must not list a local endpoint: SDK
		// generators would point consumers at their own machine, and every
		// generated client would fail on its first request.
		expect(getOpenApiServers("https://www.oma-ai.com/api", 3001)).toEqual([
			{ url: "https://www.oma-ai.com/api", description: "Production" },
		]);
	});

	it("does not hand SDK generators the internal Neon function host", () => {
		// PUBLIC_API_URL is set to the Neon compute hostname in production.
		// That is infrastructure, not the public API: it is not what the docs
		// tell developers to use, and it changes if the branch is recreated.
		// The canonical public API is the same-origin proxied path.
		const servers = getOpenApiServers(
			"https://br-sweet-rain-b40o54xa-omaapi.compute.c-6.us-east-2.aws.neon.tech",
			3001,
			"https://www.oma-ai.com",
		);
		expect(servers[0].url).toBe("https://www.oma-ai.com/api");
		expect(JSON.stringify(servers)).not.toContain("neon.tech");
	});

	it("tolerates a trailing slash on the app origin", () => {
		const servers = getOpenApiServers(
			"https://x.neon.tech",
			3001,
			"https://www.oma-ai.com/",
		);
		expect(servers[0].url).toBe("https://www.oma-ai.com/api");
	});

	it("still honours an explicitly public non-internal PUBLIC_API_URL", () => {
		const servers = getOpenApiServers(
			"https://api.example.com/v1",
			3001,
			"https://www.oma-ai.com",
		);
		expect(servers[0].url).toBe("https://api.example.com/v1");
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
