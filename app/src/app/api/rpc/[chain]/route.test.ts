import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/rate-limit-middleware", () => ({ withRateLimit: (handler: (req: Request) => Promise<Response>) => handler }));
const context = { params: Promise.resolve({ chain: "base" }) };
const rpc = { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] };
const upstream = vi.fn();
function request(body: unknown = rpc) {
	return new Request("http://localhost/api/rpc/base", { method: "POST", body: JSON.stringify(body) });
}
function response(result: unknown = "0x42") { return Response.json({ jsonrpc: "2.0", id: 1, result }); }

beforeEach(() => { vi.stubGlobal("fetch", upstream); vi.stubEnv("BASE_RPC_URL", "https://operator.example/private-key"); upstream.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("public RPC proxy", () => {
	it("falls back to a public Base read endpoint when the operator RPC is down", async () => {
		upstream.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce(response());
		const res = await POST(request(), context);
		expect(res.status).toBe(200);
		expect((await res.json()).result).toBe("0x42");
		expect(upstream.mock.calls.map(([url]) => url)).toEqual(["https://operator.example/private-key", "https://mainnet.base.org"]);
	});
	it("tries the second public endpoint after HTTP throttling", async () => {
		upstream.mockResolvedValueOnce(new Response("over quota", { status:429 })).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response());
		expect((await POST(request(), context)).status).toBe(200);
		expect(upstream.mock.calls.at(-1)?.[0]).toBe("https://base-rpc.publicnode.com");
	});
	it("does not repeat a signed transaction after an ambiguous network failure", async () => {
		upstream.mockRejectedValue(new Error("connection closed"));
		expect((await POST(request({ ...rpc, method:"eth_sendRawTransaction", params:["0x1234"] }), context)).status).toBe(502);
		expect(upstream).toHaveBeenCalledOnce();
	});
	it("leaves an execution-revert error intact without retrying", async () => {
		upstream.mockResolvedValueOnce(Response.json({ jsonrpc:"2.0", id:1, error:{ code:3, message:"execution reverted" } }));
		const res = await POST(request({ ...rpc, method:"eth_call" }), context);
		expect((await res.json()).error.code).toBe(3);
		expect(upstream).toHaveBeenCalledOnce();
	});
	it.each([[], { ...rpc, jsonrpc:"1.0" }, { ...rpc, method:"admin_peers" }, { ...rpc, method:"eth_subscribe" }])("rejects invalid HTTP RPC request %j", async body => {
		expect((await POST(request(body), context)).status).toBe(400);
		expect(upstream).not.toHaveBeenCalled();
	});
	it("enforces the request cap on UTF-8 bytes rather than JavaScript characters", async () => {
		const res = await POST(request({ ...rpc, params:["😀".repeat(5000)] }), context);
		expect(res.status).toBe(413);
		expect(upstream).not.toHaveBeenCalled();
	});
	it("stops reading and cancels an oversized chunked request", async () => {
		const cancel = vi.fn();
		const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(17*1024)); }, cancel });
		const req = new Request("http://localhost/api/rpc/base", { method:"POST", body, duplex:"half" } as RequestInit);
		expect((await POST(req, context)).status).toBe(413);
		expect(cancel).toHaveBeenCalledOnce();
		expect(upstream).not.toHaveBeenCalled();
	});
	it("does not expose private RPC configuration after all endpoints fail", async () => {
		upstream.mockRejectedValue(new Error("https://operator.example/private-key"));
		const res = await POST(request(), context);
		expect(res.status).toBe(502);
		expect(await res.text()).not.toContain("private-key");
	});
	it("fails over a transient JSON-RPC quota error, but does not replay a mixed write batch", async () => {
		upstream.mockResolvedValueOnce(Response.json({ jsonrpc:"2.0", id:1, error:{ code:-32005, message:"limit" } })).mockResolvedValueOnce(response());
		expect((await POST(request(), context)).status).toBe(200);
		expect(upstream).toHaveBeenCalledTimes(2);
		upstream.mockReset().mockRejectedValue(new Error("offline"));
		expect((await POST(request([rpc, { ...rpc, id:2, method:"eth_sendRawTransaction", params:["0x1234"] }]), context)).status).toBe(502);
		expect(upstream).toHaveBeenCalledOnce();
	});
	it("rejects a configured RPC that returns a different chain", async () => {
		upstream.mockResolvedValueOnce(response("0x1")).mockResolvedValueOnce(response("0x2105"));
		expect((await (await POST(request({ ...rpc, method:"eth_chainId" }), context)).json()).result).toBe("0x2105");
	});
	it("rejects an advertised oversized request without reading it", async () => {
		const req = request(); req.headers.set("Content-Length", "1000000");
		expect((await POST(req, context)).status).toBe(413);
		expect(upstream).not.toHaveBeenCalled();
	});
	it("caps upstream response bytes and cancels the oversized body before failover", async () => {
		const cancel = vi.fn();
		const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1024*1024+1)); }, cancel });
		upstream.mockResolvedValueOnce(new Response(body)).mockResolvedValueOnce(response());
		expect((await POST(request(), context)).status).toBe(200);
		expect(cancel).toHaveBeenCalledOnce();
	});
});
