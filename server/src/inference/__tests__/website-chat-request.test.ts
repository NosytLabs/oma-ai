import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OmaEnv } from "../../types.js";

const settings = vi.hoisted(() => ({ NODE_ENV: "production", PUBLIC_APP_URL: "https://www.oma-ai.com", INTERNAL_PROXY_SECRET: "test-private-proxy-secret" }));
vi.mock("../../config.js", () => ({ config: settings }));
import { isWebsiteChatRequest } from "../website-chat-request.js";

async function request(path: string, headers: Record<string, string> = {}) {
	const app = new Hono<OmaEnv>();
	app.post("*", c => c.json({ sponsored: isWebsiteChatRequest(c) }));
	return (await app.request(`https://api.example${path}`, { method: "POST", headers: {
		Origin: "https://www.oma-ai.com", "X-OMA-Source": "website", ...headers,
	} })).json();
}

beforeEach(() => { settings.NODE_ENV = "production"; });
describe("website chat sponsorship", () => {
	it("requires the server proxy proof on a publicly reachable backend", async () => {
		expect(await request("/website/chat/completions")).toEqual({ sponsored: false });
		expect(await request("/website/chat/completions", { "x-oma-proxy-secret": "wrong" })).toEqual({ sponsored: false });
		expect(await request("/website/chat/completions", { "x-oma-proxy-secret": settings.INTERNAL_PROXY_SECRET })).toEqual({ sponsored: true });
	});
	it("does not sponsor public API paths even when the proxy and origin are trusted", async () => {
		expect(await request("/v1/chat/completions", { "x-oma-proxy-secret": settings.INTERNAL_PROXY_SECRET })).toEqual({ sponsored: false });
	});
	it.each(["http://localhost:3000", "https://www.oma-ai.com.evil.example", "https://evil.example"])("rejects production origin %s", async Origin => {
		expect(await request("/website/chat/completions", { Origin, "x-oma-proxy-secret": settings.INTERNAL_PROXY_SECRET })).toEqual({ sponsored: false });
	});
	it("does not trust secretless nonproduction requests to a remote host", async () => {
		settings.NODE_ENV = "test";
		expect(await request("/website/chat/completions")).toEqual({ sponsored: false });
	});
});
