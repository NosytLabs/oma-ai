// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/auth/[...path]/route";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("auth callback proxy", () => {
	it.each(["../../admin", "..\\..\\internal", ".."])(
		"rejects a decoded auth path escape before forwarding credentials: %s",
		async (segment) => {
			const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
			vi.stubGlobal("fetch", fetchMock);
			const response = await GET(new NextRequest(`https://www.oma-ai.com/api/auth/${encodeURIComponent(segment)}`), {
				params: Promise.resolve({ path: [segment] }),
			});
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: "Invalid auth path" });
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);

	it("retains the platform IP behind the authenticated Vercel auth proxy", async () => {
		vi.stubEnv("VERCEL", "1");
		vi.stubEnv("INTERNAL_PROXY_SECRET", "server-owned-secret");
		const fetchMock = vi.fn().mockResolvedValue(Response.json(null));
		vi.stubGlobal("fetch", fetchMock);
		await GET(new NextRequest("https://www.oma-ai.com/api/auth/get-session", { headers: {
			"x-vercel-forwarded-for": "2001:db8::42", "x-real-ip": "198.51.100.99",
		} }), { params: Promise.resolve({ path: ["get-session"] }) });
		const headers = fetchMock.mock.calls[0][1].headers;
		expect(headers["x-vercel-forwarded-for"]).toBe("2001:db8::42");
		expect(headers["x-real-ip"]).toBeUndefined();
		expect(headers["x-oma-proxy-secret"]).toBe("server-owned-secret");
	});
	it("removes caller-supplied Neon runtime headers on auth requests", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json(null));
		vi.stubGlobal("fetch", fetchMock);
		await GET(new NextRequest("https://www.oma-ai.com/api/auth/get-session", { headers: { "x-neon-trigger-invocation-id": "forged", "x-neon-custom": "forged" } }), { params: Promise.resolve({ path: ["get-session"] }) });
		expect(Object.keys(fetchMock.mock.calls[0][1].headers).some(key => key.startsWith("x-neon-"))).toBe(false);
	});

	it("does not restore a cookie scoped to the incoming connection", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json(null));
		vi.stubGlobal("fetch", fetchMock);
		await GET(new NextRequest("https://www.oma-ai.com/api/auth/get-session", { headers: {
			connection: "Cookie, Transfer-Encoding", cookie: "oma.session_token=local-only", "transfer-encoding": "chunked",
		} }), { params: Promise.resolve({ path: ["get-session"] }) });
		const headers = fetchMock.mock.calls[0][1].headers;
		expect(headers.cookie).toBeUndefined();
		expect(headers.connection).toBeUndefined();
		expect(headers["transfer-encoding"]).toBeUndefined();
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

	it.each([true, false])("rejects oversized auth bodies before calling the backend (declared length: %s)", async (declared) => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: true }));
		vi.stubGlobal("fetch", fetchMock);
		const bytes = new Uint8Array(65_537).fill(97);
		const body = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
		const req = new NextRequest("https://www.oma-ai.com/api/auth/sign-in/magic-link", {
			method: "POST", body, duplex: "half",
			headers: declared ? { "content-length": "65537" } : {},
		});
		const response = await POST(req, { params: Promise.resolve({ path: ["sign-in", "magic-link"] }) });
		expect(response.status).toBe(413);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("forwards a normal sign-in body unchanged", async () => {
		const body = JSON.stringify({ email: "user@example.com", callbackURL: "/dashboard" });
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: true }));
		vi.stubGlobal("fetch", fetchMock);
		const response = await POST(new NextRequest("https://www.oma-ai.com/api/auth/sign-in/magic-link", {
			method: "POST", body, headers: { "Content-Type": "application/json" },
		}), { params: Promise.resolve({ path: ["sign-in", "magic-link"] }) });
		expect(response.status).toBe(200);
		expect(fetchMock.mock.calls[0][1].body).toBe(body);
	});

	it("ends a stalled auth request when its deadline expires", async () => {
		const deadline = new AbortController();
		vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
		const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
			options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
		}));
		vi.stubGlobal("fetch", fetchMock);
		const pending = GET(new NextRequest("https://www.oma-ai.com/api/auth/get-session"), { params: Promise.resolve({ path: ["get-session"] }) });
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		deadline.abort(new DOMException("The operation timed out", "TimeoutError"));
		expect((await pending).status).toBe(504);
	});

	it("bounds a stalled request upload before contacting the auth backend", async () => {
		const deadline = new AbortController();
		const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
		const canceled = vi.fn();
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: true }));
		vi.stubGlobal("fetch", fetchMock);
		const pending = POST(new NextRequest("https://www.oma-ai.com/api/auth/sign-in/magic-link", {
			method: "POST", body: new ReadableStream({ cancel: canceled }), duplex: "half",
		}), { params: Promise.resolve({ path: ["sign-in", "magic-link"] }) });
		await vi.waitFor(() => expect(timeout).toHaveBeenCalled());
		deadline.abort(new DOMException("The operation timed out", "TimeoutError"));
		expect((await pending).status).toBe(504);
		expect(canceled).toHaveBeenCalledOnce();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("cancels upstream auth work when the browser cancels", async () => {
		const caller = new AbortController();
		const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
			options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
		}));
		vi.stubGlobal("fetch", fetchMock);
		const pending = GET(new NextRequest("https://www.oma-ai.com/api/auth/get-session", { signal: caller.signal }), { params: Promise.resolve({ path: ["get-session"] }) });
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		caller.abort();
		expect((await pending).status).toBe(499);
	});
});
