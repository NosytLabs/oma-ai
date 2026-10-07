import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../config.js", () => ({ config: { VENICE_API_KEY: "audit-provider-key", VENICE_API_URL: "https://provider.invalid", OMMA_ALLOW_NON_PRIVATE_VENICE: false } }));
vi.mock("../billing.js", () => ({ assertSufficientBalance: vi.fn(), recordUsage: vi.fn() }));
vi.mock("../streaming.js", () => ({ createStreamingProxy: vi.fn(), parseNonStreamingResponse: vi.fn() }));
import { routeRequestWithFallback } from "../proxy.js";

afterEach(() => vi.unstubAllGlobals());
it("sends tool-call history and JSON schema settings to the upstream HTTP endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const messages = [
        { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "weather", arguments: "{}" } }] },
        { role: "tool", content: "Sunny", tool_call_id: "call_1" },
    ];
    const response_format = { type: "json_schema" as const, json_schema: { name: "weather", schema: { type: "object", properties: { forecast: { type: "string" } } }, strict: true } };
    await routeRequestWithFallback({ modelId: "llama-3.3-70b", messages, response_format, stream: false, userId: "audit", requestId: "audit" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ messages, response_format });
});
