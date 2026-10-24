import { describe, expect, it } from "vitest";
import { getOpenApiServers, getPublicOpenApiSpec, openapiRoutes } from "../openapi.js";

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
			"https://br-patient-sun-b5k0ln0f-omaapi.compute.c-7.us-east-2.aws.neon.tech",
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
	it("documents the canonical model capability list", () => {
		expect(getPublicOpenApiSpec().components.schemas.Model.properties.capabilities).toMatchObject({
			type: "array",
			items: { type: "string" },
		});
	});

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


describe("x402 OpenAPI funding contract", () => {
	it("publishes discovery and signed-transfer headers without bearer auth", async () => {
		const response = await openapiRoutes.request("/openapi.json");
		const document = await response.json();
		const info = document.paths["/x402/info"];
		expect(info).toBeDefined();
		expect(info.get.security).toEqual([]);
		expect(info.get.responses).toHaveProperty("503");
		const verify = document.paths["/x402/verify"];
		expect(verify.post.security).toEqual([]);
		expect(verify.post.parameters).toContainEqual(expect.objectContaining({
			in: "header", name: "PAYMENT-SIGNATURE", required: true,
		}));
		expect(verify.post.responses).toHaveProperty("422");
		for (const path of ["/x402/info", "/x402/verify", "/x402/settle"]) {
			const server = document.paths[path].servers[0].url;
			expect(new URL(server).pathname).toBe("/");
		}
	});

	it("requires the payer's session cookie and exposes permanent settlement conflicts", async () => {
		const response = await openapiRoutes.request("/openapi.json");
		const document = await response.json();
		const settle = document.paths["/x402/settle"].post;
		expect(settle.security).toEqual([{ SessionCookie: [] }]);
		expect(document.components.securitySchemes.SessionCookie).toMatchObject({ type: "apiKey", in: "cookie" });
		expect(settle.requestBody.content["application/json"].schema.required).toEqual(["txHash", "networkId"]);
		expect(settle.responses).toHaveProperty("409");
		expect(settle.responses).toHaveProperty("403");
		expect(settle.responses).not.toHaveProperty("402");
	});
});
