// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/rate-limit-middleware", () => ({ withRateLimit: (handler: unknown) => handler }));
vi.mock("@/lib/rate-limiter", () => ({ generalLimiter: {} }));
import { POST } from "./route";

const fetchMock = vi.fn();
const call = (body: unknown = { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) => POST(
  new Request("http://localhost/api/rpc/base", { method: "POST", body: JSON.stringify(body) }),
  { params: Promise.resolve({ chain: "base" }) },
);
describe("Base RPC failover", () => {
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); vi.stubEnv("BASE_RPC_URL", "https://private-rpc.example/secret"); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("falls back from a suspended endpoint without exposing its URL", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Suspended", { status: 403 })).mockResolvedValueOnce(Response.json({ jsonrpc: "2.0", id: 1, result: "0x2105" }));
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ jsonrpc: "2.0", id: 1, result: "0x2105" });
    expect(fetchMock.mock.calls[1][0]).toBe("https://mainnet.base.org");
  });
  it("returns an application revert without replaying the request", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ jsonrpc: "2.0", id: 1, error: { code: 3, message: "execution reverted" } }));
    expect((await (await call()).json()).error.code).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("fails safely when every endpoint is unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("https://private-rpc.example/secret"));
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("rejects empty batches before reaching an upstream", async () => {
    expect((await call([])).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
