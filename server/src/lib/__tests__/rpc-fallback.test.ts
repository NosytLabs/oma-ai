import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicClient } from "viem";
import { base } from "viem/chains";

const { rpcConfig } = vi.hoisted(() => ({ rpcConfig: { CHAIN_RPC_URL: "https://primary.example.test", CHAIN_RPC_URL_FALLBACK: "https://backup.example.test" } }));
vi.mock("../../config.js", () => ({ config: rpcConfig }));
vi.mock("../logger.js", () => ({ logger: { info: vi.fn() } }));
import { createBaseTransport } from "../rpc-client.js";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => { rpcConfig.CHAIN_RPC_URL = "https://primary.example.test"; rpcConfig.CHAIN_RPC_URL_FALLBACK = "https://backup.example.test"; });

describe("Base transport fallback", () => {
	it("completes an RPC call through a backup when the primary is unavailable", async () => {
		const urls: string[] = [];
		vi.stubGlobal("fetch", vi.fn(async (input: string | Request, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input.url;
			urls.push(url);
			if (url.startsWith("https://primary.example.test")) return new Response("Unavailable", { status: 503 });
			const request = (typeof input === "string" ? JSON.parse(init!.body as string) : await input.json()) as { id: number };
			return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: "0x123" }), { headers: { "Content-Type": "application/json" } });
		}));
		const client = createPublicClient({ chain: base, transport: createBaseTransport() });
		expect(await client.getBlockNumber()).toBe(291n);
		expect(urls.some(url => url.startsWith("https://backup.example.test"))).toBe(true);
	});
	it("uses public Base endpoints when configured URLs are placeholders", async () => {
		rpcConfig.CHAIN_RPC_URL = "https://placeholder.quiknode.pro";
		rpcConfig.CHAIN_RPC_URL_FALLBACK = "https://changeme.example";
		const fetchMock = vi.fn(async (_input: string, init: RequestInit) => new Response(JSON.stringify({ jsonrpc: "2.0", id: JSON.parse(init.body as string).id, result: "0x123" })));
		vi.stubGlobal("fetch", fetchMock);
		const client = createPublicClient({ chain: base, transport: createBaseTransport() });
		expect(await client.getBlockNumber()).toBe(291n);
		expect(fetchMock.mock.calls.every(([url]) => !/placeholder|changeme|llamarpc/.test(url))).toBe(true);
		expect(fetchMock.mock.calls.some(([url]) => url.startsWith("https://mainnet.base.org"))).toBe(true);
	});
});
