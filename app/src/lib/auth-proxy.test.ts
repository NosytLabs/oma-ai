import { describe, expect, it } from "vitest";
import { buildAuthEndpoint, resolveAuthBackend } from "./auth-proxy";

describe("auth-proxy endpoint builder", () => {
	it("keeps the /api/auth prefix on the upstream URL", () => {
		expect(buildAuthEndpoint("http://localhost:3001", ["get-session"])).toBe(
			"http://localhost:3001/api/auth/get-session",
		);
	});

	it("joins multi-segment paths", () => {
		expect(
			buildAuthEndpoint("http://localhost:3001", [
				"sign-in",
				"email",
			]),
		).toBe("http://localhost:3001/api/auth/sign-in/email");
	});

	it.each([".", "..", "../../admin", "..\\..\\internal", ""])(
		"rejects decoded path segments that can escape the auth namespace: %s",
		(segment) => {
			expect(() => buildAuthEndpoint("https://backend.example", [segment])).toThrow("Invalid auth path");
		},
	);

	it("encodes decoded route data instead of interpreting it as URL syntax", () => {
		const endpoint = new URL(buildAuthEndpoint("https://backend.example", ["callback", "name?next=admin#fragment"]));
		expect(endpoint.pathname).toBe("/api/auth/callback/name%3Fnext%3Dadmin%23fragment");
		expect(endpoint.search).toBe("");
		expect(endpoint.hash).toBe("");
	});

	it("keeps percent-encoded dot segments literal after Next.js has decoded once", () => {
		expect(new URL(buildAuthEndpoint("https://backend.example", ["%2e%2e", "%2e%2e", "admin"])).pathname)
			.toBe("/api/auth/%252e%252e/%252e%252e/admin");
	});

	it("resolves backend base, stripping trailing slash", () => {
		const oldAuth = process.env.NEXT_PUBLIC_AUTH_BASE_URL;
		const oldApi = process.env.NEXT_PUBLIC_API_URL;
		delete process.env.NEXT_PUBLIC_AUTH_BASE_URL;
		delete process.env.NEXT_PUBLIC_API_URL;
		try {
			expect(resolveAuthBackend()).toBe("http://localhost:3001");
		} finally {
			if (oldAuth) process.env.NEXT_PUBLIC_AUTH_BASE_URL = oldAuth;
			if (oldApi) process.env.NEXT_PUBLIC_API_URL = oldApi;
		}
	});
});
