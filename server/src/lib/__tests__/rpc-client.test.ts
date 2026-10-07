import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../config.js", () => ({ config: { CHAIN_RPC_URL: "https://suspended.example", CHAIN_RPC_URL_FALLBACK: "" } }));
import { getPublicClient, resetPublicClient } from "../rpc-client.js";
afterEach(() => { vi.unstubAllGlobals(); resetPublicClient(); });
it("continues to a public Base endpoint after a suspended dedicated RPC", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("Suspended", { status: 403 }))
    .mockImplementationOnce(async (_url, init) => Response.json({ jsonrpc: "2.0", id: JSON.parse(init.body).id, result: "0x2105" }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await getPublicClient().getChainId()).toBe(8453);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
