// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/[...path]/route";

afterEach(() => vi.unstubAllGlobals());

describe("auth callback proxy", () => {
	it("removes caller-supplied Neon runtime headers on auth requests", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json(null));
		vi.stubGlobal("fetch", fetchMock);
		await GET(new NextRequest("https://www.oma-ai.com/api/auth/get-session", { headers: { "x-neon-trigger-invocation-id": "forged", "x-neon-custom": "forged" } }), { params: Promise.resolve({ path: ["get-session"] }) });
		expect(Object.keys(fetchMock.mock.calls[0][1].headers).some(key => key.startsWith("x-neon-"))).toBe(false);
	});

	it("does not expose upstream connection diagnostics to the browser", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("postgres://private-credential@private-db")));
		const response = await GET(new NextRequest("https://www.oma-ai.com/api/auth/get-session"), { params: Promise.resolve({ path: ["get-session"] }) });
		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Auth backend unavailable" });
	});
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
