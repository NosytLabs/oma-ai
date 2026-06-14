import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    ANTHROPIC_API_KEY: "sk-ant-test-key",
    NODE_ENV: "test",
  },
}));

import * as claude from "../claude.js";

describe("Claude Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("isClaudeModel", () => {
    it("recognises canonical models", () => {
      expect(claude.isClaudeModel("claude-3-5-sonnet-latest")).toBe(true);
      expect(claude.isClaudeModel("claude-opus-4")).toBe(true);
      expect(claude.isClaudeModel("claude-sonnet-4")).toBe(true);
      expect(claude.isClaudeModel("claude-3-5-haiku-latest")).toBe(true);
    });
    it("recognises any claude- prefix", () => {
      expect(claude.isClaudeModel("claude-future-model")).toBe(true);
    });
    it("rejects non-claude", () => {
      expect(claude.isClaudeModel("gpt-4")).toBe(false);
      expect(claude.isClaudeModel("llama-3")).toBe(false);
    });
  });

  describe("translateRequest", () => {
    it("pulls system messages into top-level system field", () => {
      const out = claude.translateRequest({
        model: "claude-3-5-sonnet-latest",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hi" },
        ],
      });
      expect(out.system).toBe("You are helpful.");
      expect(out.messages).toEqual([{ role: "user", content: "Hi" }]);
      expect(out.max_tokens).toBe(4096);
    });

    it("joins multiple system messages with newline", () => {
      const out = claude.translateRequest({
        model: "claude-3-5-sonnet-latest",
        messages: [
          { role: "system", content: "Line 1" },
          { role: "system", content: "Line 2" },
          { role: "user", content: "Hi" },
        ],
      });
      expect(out.system).toBe("Line 1\nLine 2");
    });

    it("translates OpenAI tools to Anthropic tools schema", () => {
      const out = claude.translateRequest({
        model: "claude-3-5-sonnet-latest",
        messages: [{ role: "user", content: "search for x" }],
        tools: [{
          type: "function",
          function: {
            name: "search",
            description: "Search the web",
            parameters: { type: "object", properties: { q: { type: "string" } } },
          },
        }],
      });
      expect(out.tools).toEqual([{
        name: "search",
        description: "Search the web",
        input_schema: { type: "object", properties: { q: { type: "string" } } },
      }]);
    });

    it("translates assistant tool_calls into tool_use blocks", () => {
      const out = claude.translateRequest({
        model: "claude-3-5-sonnet-latest",
        messages: [
          { role: "user", content: "search for x" },
          {
            role: "assistant",
            content: "",
            // OpenAI tool_calls extension on assistant message
            tool_calls: [{
              id: "call_abc",
              type: "function",
              function: { name: "search", arguments: '{"q":"x"}' },
            }],
          } as unknown as { role: string; content: string },
        ],
      });
      const messages = out.messages as Array<{ role: string; content: unknown }>;
      const last = messages[messages.length - 1];
      expect(last.role).toBe("assistant");
      expect(last.content).toEqual([
        { type: "tool_use", id: "call_abc", name: "search", input: { q: "x" } },
      ]);
    });

    it("translates tool-role messages into tool_result blocks on the user turn", () => {
      const out = claude.translateRequest({
        model: "claude-3-5-sonnet-latest",
        messages: [
          { role: "user", content: "do it" },
          { role: "assistant", content: "calling tool" },
          { role: "tool", content: "result text", tool_call_id: "call_abc" } as unknown as { role: string; content: string },
        ],
      });
      const messages = out.messages as Array<{ role: string; content: unknown }>;
      const last = messages[messages.length - 1];
      expect(last.role).toBe("user");
      expect(last.content).toEqual([
        { type: "tool_result", tool_use_id: "call_abc", content: "result text" },
      ]);
    });
  });

  describe("translateResponse", () => {
    it("converts Anthropic response to OpenAI chat.completion shape", () => {
      const out = claude.translateResponse({
        id: "msg_123",
        model: "claude-3-5-sonnet-latest",
        content: [{ type: "text", text: "Hello!" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      expect(out.id).toBe("msg_123");
      expect(out.object).toBe("chat.completion");
      expect(out.model).toBe("claude-3-5-sonnet-latest");
      const choices = out.choices as Array<{ message: { content: string }; finish_reason: string }>;
      expect(choices[0].message.content).toBe("Hello!");
      expect(choices[0].finish_reason).toBe("stop");
      expect(out.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
    });

    it("maps tool_use blocks to tool_calls and finish_reason tool_calls", () => {
      const out = claude.translateResponse({
        id: "msg_tool",
        model: "claude-3-5-sonnet-latest",
        content: [
          { type: "text", text: "Let me search." },
          { type: "tool_use", id: "tool_1", name: "search", input: { q: "x" } },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 20, output_tokens: 8 },
      });
      const choices = out.choices as Array<{ message: { content: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }; finish_reason: string }>;
      expect(choices[0].finish_reason).toBe("tool_calls");
      expect(choices[0].message.content).toBe("Let me search.");
      expect(choices[0].message.tool_calls).toHaveLength(1);
      expect(choices[0].message.tool_calls?.[0]).toEqual({
        id: "tool_1",
        type: "function",
        function: { name: "search", arguments: '{"q":"x"}' },
      });
    });

    it("maps max_tokens stop_reason to length", () => {
      const out = claude.translateResponse({
        id: "msg_2",
        model: "claude-opus-4",
        content: [{ type: "text", text: "..." }],
        stop_reason: "max_tokens",
      });
      const choices = out.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe("length");
    });
  });

  describe("translateStreamEvent", () => {
    it("emits opening role chunk for message_start", () => {
      const chunk = claude.translateStreamEvent({ type: "message_start", message: { id: "msg_1", model: "claude-3-5-sonnet-latest" } });
      expect(chunk).not.toBeNull();
      const choices = chunk!.choices as Array<{ delta: { role: string; content: string } }>;
      expect(choices[0].delta.role).toBe("assistant");
    });

    it("emits content delta for text_delta", () => {
      const chunk = claude.translateStreamEvent({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Hello" },
      });
      const choices = chunk!.choices as Array<{ delta: { content: string } }>;
      expect(choices[0].delta.content).toBe("Hello");
    });

    it("emits tool_calls delta for input_json_delta", () => {
      const chunk = claude.translateStreamEvent({
        type: "content_block_delta",
        index: 1,
        delta: { type: "input_json_delta", partial_json: '{"q":' },
      });
      const choices = chunk!.choices as Array<{ delta: { tool_calls: Array<{ index: number; function: { arguments: string } }> } }>;
      expect(choices[0].delta.tool_calls[0].index).toBe(1);
      expect(choices[0].delta.tool_calls[0].function.arguments).toBe('{"q":');
    });

    it("emits finish_reason on message_delta stop", () => {
      const chunk = claude.translateStreamEvent({
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
      });
      const choices = chunk!.choices as Array<{ finish_reason: string }>;
      expect(choices[0].finish_reason).toBe("stop");
    });

    it("returns null for unknown event types", () => {
      expect(claude.translateStreamEvent({ type: "ping" })).toBeNull();
    });
  });

  describe("chatCompletion", () => {
    it("translates response to OpenAI shape on success", async () => {
      const anthropicResp = {
        id: "msg_xyz",
        model: "claude-3-5-sonnet-latest",
        content: [{ type: "text", text: "Hi back." }],
        stop_reason: "end_turn",
        usage: { input_tokens: 4, output_tokens: 3 },
      };
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(anthropicResp), { status: 200, headers: { "Content-Type": "application/json" } })
      );
      globalThis.fetch = fetchSpy;

      const res = await claude.chatCompletion({
        model: "claude-3-5-sonnet-latest",
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.object).toBe("chat.completion");
      expect(json.choices[0].message.content).toBe("Hi back.");

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "x-api-key": "sk-ant-test-key",
        "anthropic-version": "2023-06-01",
      });
    });

    it("maps 401 to invalid_key error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "invalid auth" } }), { status: 401 })
      );
      await expect(claude.chatCompletion({
        model: "claude-3-5-sonnet-latest",
        messages: [{ role: "user", content: "Hi" }],
      })).rejects.toMatchObject({ status: 401, type: "invalid_key" });
    });

    it("maps 429 to rate_limit error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429 })
      );
      await expect(claude.chatCompletion({
        model: "claude-3-5-sonnet-latest",
        messages: [{ role: "user", content: "Hi" }],
      })).rejects.toMatchObject({ status: 429, type: "rate_limit" });
    });

    it("maps 529 to overloaded error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 529 })
      );
      await expect(claude.chatCompletion({
        model: "claude-3-5-sonnet-latest",
        messages: [{ role: "user", content: "Hi" }],
      })).rejects.toMatchObject({ status: 529, type: "overloaded" });
    });

    it("maps 500 to server_error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 })
      );
      await expect(claude.chatCompletion({
        model: "claude-3-5-sonnet-latest",
        messages: [{ role: "user", content: "Hi" }],
      })).rejects.toMatchObject({ status: 500, type: "server_error" });
    });

    it("503s when API key missing", async () => {
      const { config } = await import("../../config.js");
      const original = config.ANTHROPIC_API_KEY;
      (config as Record<string, unknown>).ANTHROPIC_API_KEY = "";
      try {
        await expect(claude.chatCompletion({
          model: "claude-3-5-sonnet-latest",
          messages: [{ role: "user", content: "Hi" }],
        })).rejects.toMatchObject({ status: 503 });
      } finally {
        (config as Record<string, unknown>).ANTHROPIC_API_KEY = original;
      }
    });

    it("returns raw streaming response without translating body", async () => {
      const streamResp = new Response("event: message_start\ndata: {}\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
      globalThis.fetch = vi.fn().mockResolvedValue(streamResp);

      const res = await claude.streamChatCompletion({
        model: "claude-3-5-sonnet-latest",
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
    });
  });
});
