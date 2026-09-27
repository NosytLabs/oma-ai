// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/[...path]/route";

afterEach(() => vi.unstubAllGlobals());

describe("auth callback proxy", () => {
	it("preserves separate session cookies and the callback redirect", async () => {
		const cookies = [
			"oma.session_token=token; Path=/; HttpOnly; SameSite=Lax",
			"oma.session_data=cache; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/; HttpOnly",
		];
		const headers = new Headers({ location: "/dashboard", "content-encoding": "gzip", "content-length": "100" });
		for (const cookie of cookies) headers.append("set-cookie", cookie);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 302, headers })));
		const response = await GET(new NextRequest("https://www.oma-ai.com/api/auth/magic-link/verify?token=test"), { params: Promise.resolve({ path: ["magic-link", "verify"] }) });
		expect(response.headers.getSetCookie()).toEqual(cookies);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("/dashboard");
		expect(response.headers.has("content-encoding")).toBe(false);
		expect(response.headers.has("content-length")).toBe(false);
	});
});
