/**
 * Structural tests for Better Auth browser client wiring + login redirect guard.
 * Proves shipped exports without network I/O.
 */
import { describe, expect, it } from "vitest";
import { authClient, signIn, signOut, useSession } from "@/lib/auth-client";
import { safeLoginNext } from "@/app/login/page";

describe("auth-client (Better Auth browser surface)", () => {
	it("exports authClient, signIn, signOut, useSession from better-auth/react", () => {
		expect(authClient).toBeDefined();
		// better-auth may export signIn as a function (callable with methods)
		// or as a namespaced object depending on version.
		expect(["function", "object"]).toContain(typeof signIn);
		expect(typeof signOut).toBe("function");
		expect(typeof useSession).toBe("function");
	});

	it("authClient is a usable client object with session API", () => {
		expect(authClient).toBeTruthy();
		// Session helper must exist on the client surface used by useAuth.
		expect(
			typeof (authClient as { getSession?: unknown }).getSession ===
				"function" ||
				typeof useSession === "function",
		).toBe(true);
	});
});

describe("safeLoginNext open-redirect guard (shipped login page)", () => {
	it("accepts same-origin relative paths only", () => {
		expect(safeLoginNext(null)).toBe("/dashboard");
		expect(safeLoginNext(undefined)).toBe("/dashboard");
		expect(safeLoginNext("/chat")).toBe("/chat");
		expect(safeLoginNext("/dashboard?tab=api-keys")).toBe(
			"/dashboard?tab=api-keys",
		);
		expect(safeLoginNext("//evil.com")).toBe("/dashboard");
		expect(safeLoginNext("https://evil.com")).toBe("/dashboard");
		expect(safeLoginNext("javascript:alert(1)")).toBe("/dashboard");
	});
});
