import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import { setupWebSocket } from "../routes/chat-ws.js";
import { wsChatCompletionSchema } from "../routes/chat-ws.js";

const TEST_SERVER_PORT = 9999;

vi.mock("../db/client.js", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

vi.mock("../auth/api-keys.js", () => ({
  validateApiKey: vi.fn().mockResolvedValue(null),
}));

describe("WebSocket /v1/chat/completions/ws", () => {
  let server: import("http").Server;
  let wss: WebSocketServer;

  beforeAll(async () => {
    server = await new Promise<import("http").Server>((resolve) => {
      const http = require("http");
      const srv = http.createServer();
      wss = setupWebSocket(srv);
      srv.listen(TEST_SERVER_PORT, () => {
        resolve(srv);
      });
    });
  });

  afterAll(() => {
    wss.close();
    server.close();
  });

  describe("Connection handling", () => {
    it("should handle connection and return error for invalid API key", async () => {
      const ws = new WebSocket(`ws://localhost:${TEST_SERVER_PORT}/v1/chat/completions/ws?Authorization=Bearer invalid`);

      const message = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
        ws.on("message", (data) => {
          clearTimeout(timeout);
          resolve(JSON.parse(data.toString()));
        });
        ws.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      expect(message).toHaveProperty("error");
      ws.close();
    });
  });
});

describe("WebSocket message schema validation", () => {
  it("should validate proper message structure", () => {
    const validMsg = {
      model: "test-model",
      messages: [{ role: "user", content: "Hello" }],
    };

    const result = wsChatCompletionSchema.safeParse(validMsg);
    expect(result.success).toBe(true);
  });

  it("should reject invalid role", () => {
    const invalidMsg = {
      model: "test-model",
      messages: [{ role: "invalid", content: "Hello" }],
    };

    const result = wsChatCompletionSchema.safeParse(invalidMsg);
    expect(result.success).toBe(false);
  });

  it("should accept optional fields", () => {
    const msgWithOptional = {
      model: "test-model",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 0.7,
      max_tokens: 100,
      stream: true,
    };

    const result = wsChatCompletionSchema.safeParse(msgWithOptional);
    expect(result.success).toBe(true);
  });

  it("should reject empty messages array", () => {
    const invalidMsg = {
      model: "test-model",
      messages: [],
    };

    const result = wsChatCompletionSchema.safeParse(invalidMsg);
    expect(result.success).toBe(false);
  });

  it("should reject missing model", () => {
    const invalidMsg = {
      messages: [{ role: "user", content: "Hello" }],
    };

    const result = wsChatCompletionSchema.safeParse(invalidMsg);
    expect(result.success).toBe(false);
  });

  it("should reject missing messages", () => {
    const invalidMsg = {
      model: "test-model",
    };

    const result = wsChatCompletionSchema.safeParse(invalidMsg);
    expect(result.success).toBe(false);
  });

  it("should reject messages with invalid content type", () => {
    const invalidMsg = {
      model: "test-model",
      messages: [{ role: "user", content: 123 }] as unknown[],
    };

    const result = wsChatCompletionSchema.safeParse(invalidMsg);
    expect(result.success).toBe(false);
  });

  it("should accept system role", () => {
    const validMsg = {
      model: "test-model",
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello" },
      ],
    };

    const result = wsChatCompletionSchema.safeParse(validMsg);
    expect(result.success).toBe(true);
  });

  it("should accept assistant role", () => {
    const validMsg = {
      model: "test-model",
      messages: [
        { role: "assistant", content: "I can help with that" },
        { role: "user", content: "Hello" },
      ],
    };

    const result = wsChatCompletionSchema.safeParse(validMsg);
    expect(result.success).toBe(true);
  });

  it("should accept tool role", () => {
    const validMsg = {
      model: "test-model",
      messages: [
        { role: "tool", content: "tool result content" },
        { role: "user", content: "Hello" },
      ],
    };

    const result = wsChatCompletionSchema.safeParse(validMsg);
    expect(result.success).toBe(true);
  });
});