// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/x402/[...path]/route";

vi.mock("@/lib/config", () => ({ DEFAULT_API_URL: "https://backend.example" }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("public payment proxy", () => {
	it("makes authoritative funding discovery available through the public site", async () => {
		const funding = { network: "eip155:8453", payTo: "0x123" };
		const fetchMock = vi.fn().mockResolvedValue(Response.json(funding));
		vi.stubGlobal("fetch", fetchMock);
		const response = await GET(new NextRequest("https://www.oma-ai.com/x402/info"));
		expect(String(fetchMock.mock.calls[0][0])).toBe("https://backend.example/x402/info");
		expect(fetchMock.mock.calls[0][1].method).toBe("GET");
		expect(await response.json()).toEqual(funding);
	});

	it("forwards the session and payment envelope using the server's trust secret", async () => {
		vi.stubEnv("INTERNAL_PROXY_SECRET", "server-secret");
		const fetchMock = vi.fn().mockResolvedValue(new Response('{"settled":true}', {
			headers: { "PAYMENT-RESPONSE": "encoded-receipt" },
		}));
		vi.stubGlobal("fetch", fetchMock);
		const response = await POST(new NextRequest("https://www.oma-ai.com/x402/settle", {
			method: "POST", body: '{"txHash":"0x123","networkId":"base"}',
			headers: { cookie: "oma.session_token=test", "PAYMENT-SIGNATURE": "encoded-payment", "x-oma-proxy-secret": "forged", "x-forwarded-for": "1.2.3.4" },
		}));
		const [url, options] = fetchMock.mock.calls[0];
		expect(String(url)).toBe("https://backend.example/x402/settle");
		expect(options.redirect).toBe("manual");
		expect(options.headers.get("cookie")).toBe("oma.session_token=test");
		expect(options.headers.get("PAYMENT-SIGNATURE")).toBe("encoded-payment");
		expect(options.headers.get("x-oma-proxy-secret")).toBe("server-secret");
		expect(options.headers.has("x-forwarded-for")).toBe(false);
		expect(response.headers.get("PAYMENT-RESPONSE")).toBe("encoded-receipt");
	});

	it("never forwards a client-supplied trust secret when the proxy is unconfigured", async () => {
		vi.stubEnv("INTERNAL_PROXY_SECRET", "");
		const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
		vi.stubGlobal("fetch", fetchMock);
		await POST(new NextRequest("https://www.oma-ai.com/x402/verify", {
			method: "POST", headers: { "x-oma-proxy-secret": "forged" },
		}));
		expect(fetchMock.mock.calls[0][1].headers.has("x-oma-proxy-secret")).toBe(false);
	});
});
