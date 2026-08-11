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
