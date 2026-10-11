// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy-handler";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("gateway proxy cancellation", () => {
	it.each(["/api/v1/usage/today", "/api/chat/completions"])("retains Vercel's platform client IP for quota path %s", async path => {
		vi.stubEnv("VERCEL", "1");
		vi.stubEnv("INTERNAL_PROXY_SECRET", "server-owned-secret");
		const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
		vi.stubGlobal("fetch", fetchMock);
		await proxy(new NextRequest(`https://www.oma-ai.com${path}`, { headers: {
			Origin: "https://www.oma-ai.com", "x-vercel-forwarded-for": "203.0.113.42",
			"x-forwarded-for": "198.51.100.99", "x-real-ip": "198.51.100.99",
		} }), { websiteChat: path === "/api/chat/completions" });
		const headers = fetchMock.mock.calls[0][1].headers as Headers;
		expect(headers.get("x-vercel-forwarded-for")).toBe("203.0.113.42");
		expect(headers.has("x-forwarded-for")).toBe(false);
		expect(headers.has("x-real-ip")).toBe(false);
		expect(headers.get("x-oma-proxy-secret")).toBe("server-owned-secret");
	});
	it("never authenticates caller-provided IP headers outside Vercel", async () => {
		vi.stubEnv("VERCEL", "");
		vi.stubEnv("INTERNAL_PROXY_SECRET", "server-owned-secret");
		const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
		vi.stubGlobal("fetch", fetchMock);
		await proxy(new NextRequest("https://www.oma-ai.com/api/v1/usage/today", { headers: {
			"x-vercel-forwarded-for": "203.0.113.42", "x-forwarded-for": "203.0.113.42",
		} }));
		const headers = fetchMock.mock.calls[0][1].headers as Headers;
		expect(headers.has("x-vercel-forwarded-for")).toBe(false);
		expect(headers.has("x-forwarded-for")).toBe(false);
	});
	it.each(["invalid", "203.0.113.42, 198.51.100.99"])("does not forward malformed platform IP %s", async ip => {
		vi.stubEnv("VERCEL", "1");
		vi.stubEnv("INTERNAL_PROXY_SECRET", "server-owned-secret");
		const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
		vi.stubGlobal("fetch", fetchMock);
		await proxy(new NextRequest("https://www.oma-ai.com/api/v1/usage/today", { headers: { "x-vercel-forwarded-for": ip } }));
		expect((fetchMock.mock.calls[0][1].headers as Headers).has("x-vercel-forwarded-for")).toBe(false);
	});
	it("does not forward platform identity without proxy authentication", async () => {
		vi.stubEnv("VERCEL", "1");
		vi.stubEnv("INTERNAL_PROXY_SECRET", "");
		const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
		vi.stubGlobal("fetch", fetchMock);
		await proxy(new NextRequest("https://www.oma-ai.com/api/v1/usage/today", { headers: { "x-vercel-forwarded-for": "203.0.113.42" } }));
		const headers = fetchMock.mock.calls[0][1].headers as Headers;
		expect(headers.has("x-vercel-forwarded-for")).toBe(false);
		expect(headers.has("x-oma-proxy-secret")).toBe(false);
	});
	it("forwards same-origin website chat with server-owned sponsorship", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
		vi.stubGlobal("fetch", fetchMock);
		await proxy(new NextRequest("https://www.oma-ai.com/api/chat/completions", { method: "POST", headers: {
			Origin: "https://www.oma-ai.com", "Sec-Fetch-Site": "same-origin",
		} }), { websiteChat: true });
		expect((fetchMock.mock.calls[0][0] as URL).pathname).toBe("/website/chat/completions");
		expect((fetchMock.mock.calls[0][1].headers as Headers).get("X-OMA-Source")).toBe("website");
	});
	it.each([undefined, "https://evil.example", "https://www.oma-ai.com.evil.example"])("blocks website chat from origin %s", async origin => {
		const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
		const headers: Record<string, string> = origin ? { Origin: origin } : {};
		const response = await proxy(new NextRequest("https://www.oma-ai.com/api/chat/completions", { method: "POST", headers }), { websiteChat: true });
		expect(response.status).toBe(403); expect(fetchMock).not.toHaveBeenCalled();
	});
	it("rejects cross-site Fetch Metadata even with an allowed origin", async () => {
		const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
		const response = await proxy(new NextRequest("https://www.oma-ai.com/api/chat/completions", { method: "POST", headers: {
			Origin: "https://www.oma-ai.com", "Sec-Fetch-Site": "cross-site",
		} }), { websiteChat: true });
		expect(response.status).toBe(403); expect(fetchMock).not.toHaveBeenCalled();
	});
	it("strips website sponsorship from public SDK requests", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
		vi.stubGlobal("fetch", fetchMock);
		await proxy(new NextRequest("https://www.oma-ai.com/api/v1/chat/completions", { method: "POST", headers: {
			"X-OMA-Source": "website", Origin: "https://www.oma-ai.com",
		} }));
		expect((fetchMock.mock.calls[0][1].headers as Headers).has("X-OMA-Source")).toBe(false);
	});
	it.each(["/website/chat/completions", "/%77ebsite/chat/completions"])("does not forward private website path %s from the catch-all", async path => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const response = await proxy(new NextRequest(`https://www.oma-ai.com/api${path}`, { method: "POST" }));
		expect(response.status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it.each(["/internal/recover-deposits", "/internal/drain-settlement-dlq", "/%69nternal/recover-deposits"])("does not forward privileged job path %s", async path => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const response = await proxy(new NextRequest(`https://www.oma-ai.com/api${path}`, { method: "POST", headers: { "x-neon-trigger-invocation-id": "forged" } }));
		expect(response.status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("strips all caller runtime headers and overwrites the proxy secret", async () => {
		vi.stubEnv("INTERNAL_PROXY_SECRET", "server-owned-secret");
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [] }));
		vi.stubGlobal("fetch", fetchMock);
		await proxy(new NextRequest("https://www.oma-ai.com/api/v1/models", { headers: {
			"x-neon-trigger-invocation-id": "forged", "x-neon-custom": "forged", "x-oma-proxy-secret": "visitor-owned", "x-forwarded-for": "spoofed",
		} }));
		const headers = fetchMock.mock.calls[0][1].headers as Headers;
		expect([...headers.keys()].some(name => name.startsWith("x-neon-"))).toBe(false);
		expect(headers.has("x-forwarded-for")).toBe(false);
		expect(headers.get("x-oma-proxy-secret")).toBe("server-owned-secret");
	});
	it("propagates caller cancellation and keeps a timeout longer than the backend budget", async () => {
		const caller = new AbortController();
		const timeout = vi.spyOn(AbortSignal, "timeout");
		const fetchMock = vi.fn((_url: URL, request: RequestInit) => new Promise<Response>((_resolve, reject) => {
			request.signal!.addEventListener("abort", () => reject(request.signal!.reason), { once: true });
		}));
		vi.stubGlobal("fetch", fetchMock);
		const pending = proxy(new NextRequest("https://www.oma-ai.com/api/v1/chat/completions", { method: "POST", signal: caller.signal }));
		caller.abort();
		const response = await pending;
		expect(response.status).toBe(499);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(timeout).toHaveBeenCalledWith(270_000);
	});
});
