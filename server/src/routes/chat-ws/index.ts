import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { handleChatCompletion } from "../../inference/router.js";
import { getModel, calculateCost } from "../../inference/models.js";
import { getBalance } from "../../credits/index.js";
import { validationError } from "../../lib/validation.js";
import { validateApiKey } from "../../auth/api-keys.js";
import { trackSpend } from "../../middleware/spend-limit.js";
import { logger } from "../../lib/logger.js";
import type { IncomingMessage } from "http";
import type { Server as HTTPServer } from "http";

const MAX_MESSAGE_CONTENT_BYTES = 100_000;
const MAX_MESSAGES = 100;
const MAX_TOTAL_BYTES = 1_000_000;

function validateMessageContent(content: unknown): boolean {
  if (typeof content === "string") {
    return new TextEncoder().encode(content).length <= MAX_MESSAGE_CONTENT_BYTES;
  }
  if (Array.isArray(content)) {
    return content.every(part => {
      if (part && typeof part === "object" && "type" in part && "text" in (part as object)) {
        if (typeof (part as { text?: unknown }).text === "string") {
          return new TextEncoder().encode((part as { text: string }).text).length <= MAX_MESSAGE_CONTENT_BYTES;
        }
      }
      return true;
    });
  }
  return true;
}

function validateMessages(messages: unknown): boolean {
  if (!Array.isArray(messages)) return false;
  if (messages.length === 0 || messages.length > MAX_MESSAGES) return false;

  let totalBytes = 0;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") return false;
    const m = msg as { role?: unknown; content?: unknown };
    if (!m.role || !m.content) return false;

    if (typeof m.content === "string") {
      totalBytes += new TextEncoder().encode(m.content).length;
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part && typeof part === "object" && "text" in part) {
          if (typeof (part as { text?: unknown }).text === "string") {
            totalBytes += new TextEncoder().encode((part as { text: string }).text).length;
          }
        }
      }
    }

    if (totalBytes > MAX_TOTAL_BYTES) return false;
  }

  return messages.every(m => validateMessageContent((m as { content?: unknown }).content));
}

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(z.any())]),
}).refine(validateMessageContent, {
  message: `Message content exceeds maximum size of ${MAX_MESSAGE_CONTENT_BYTES} bytes`
});

export const wsChatCompletionSchema = z.object({
  model: z.string().min(1).max(100),
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES)
    .refine(validateMessages, {
      message: `Total message content exceeds maximum size of ${MAX_TOTAL_BYTES} bytes or more than ${MAX_MESSAGES} messages`
    }),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.any()).optional(),
  response_format: z.any().optional(),
});

function sendWsJson(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function sendWsError(ws: WebSocket, message: string, type: string, code?: string) {
  sendWsJson(ws, { error: { message, type, code } });
}

function sendWsDone(ws: WebSocket, id: string, model: string, created: number) {
  sendWsJson(ws, {
    id,
    object: "chat.completion",
    created,
    model,
    choices: [{ index: 0, finish_reason: "stop", delta: {}, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }],
  });
}

interface WsSession {
  ws: WebSocket;
  userId: string;
  apiKeyId: string;
  apiKeyHash?: string;
}

export function setupWebSocket(server: HTTPServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    let session: WsSession | null = null;
    let connectionTimeout: NodeJS.Timeout | null = null;

    const sendErrorAndClose = (message: string, type: string, code?: string) => {
      sendWsError(ws, message, type, code);
      ws.close();
    };

    const clearConnectionTimeout = () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
    };

    connectionTimeout = setTimeout(() => {
      logger.error("[ws] Connection timeout - no auth received within 10 seconds");
      sendErrorAndClose("Connection timeout", "timeout_error");
      ws.close();
    }, 10_000);

    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const authHeader = url.searchParams.get("Authorization") || req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        clearConnectionTimeout();
        sendErrorAndClose("Missing or invalid Authorization header", "authentication_error");
        return;
      }

      const rawKey = authHeader.slice(7);
      const apiKey = await validateApiKey(rawKey);

      clearConnectionTimeout();

      if (!apiKey) {
        sendErrorAndClose("Invalid API key", "authentication_error");
        return;
      }

      if (apiKey.expired) {
        sendErrorAndClose("API key expired", "authentication_error", "expired_api_key");
        return;
      }

      session = {
        ws,
        userId: apiKey.userId,
        apiKeyId: apiKey.id,
        apiKeyHash: apiKey.keyHash,
      };

      sendWsJson(ws, { type: "connected", sessionId: apiKey.id });

    } catch (err) {
      clearConnectionTimeout();
      logger.error({ err }, "[ws] Connection setup error:");
      sendErrorAndClose("Authentication failed", "authentication_error");
      return;
    }

    ws.on("message", async (data: Buffer) => {
      if (!session) return;

      const { ws: wsClient, userId, apiKeyId, apiKeyHash } = session;

      try {
        const messageStr = data.toString();
        let message: unknown;

        try {
          message = JSON.parse(messageStr);
        } catch {
          sendWsError(wsClient, "Invalid JSON", "invalid_request_error");
          return;
        }

        const parsed = wsChatCompletionSchema.safeParse(message);
        if (!parsed.success) {
          sendWsError(wsClient, validationError(parsed.error).error.message, "invalid_request_error");
          return;
        }

        const { model, messages, stream: _stream, ...rest } = parsed.data;

        const modelInfo = await getModel(model);
        if (!modelInfo) {
          sendWsError(wsClient, `Model '${model}' not found`, "invalid_request_error", "model_not_found");
          return;
        }

        const bal = await getBalance(userId);
        if (Number(bal.balanceCents) <= 0) {
          sendWsJson(wsClient, {
            error: {
              message: `Insufficient credits. Required: 1, Balance: ${Number(bal.balanceCents)}`,
              type: "insufficient_credits",
              code: "insufficient_credits",
            }
          });
          wsClient.close();
          return;
        }

        const payload = { model, messages, stream: true, ...rest };
        const requestId = crypto.randomUUID();
        const streamCreated = Math.floor(Date.now() / 1000);

        sendWsJson(wsClient, { type: "processing", id: requestId });

        // ponytail: thread ws close → AbortSignal so client disconnect
        // cancels the upstream inference call.
        const ac = new AbortController();
        const onWsClose = () => ac.abort();
        ws.once("close", onWsClose);
        const { response, provider, inputTokens } = await handleChatCompletion(userId, apiKeyId, payload, ac.signal);
        ws.off("close", onWsClose);

        sendWsJson(wsClient, { type: "provider", provider });

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const finalInputTokens = inputTokens || 0;
        let finalOutputTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") {
                const costDetail = await calculateCost(model, finalInputTokens, finalOutputTokens);
                const totalCents = Number(costDetail.totalCents);

                if (totalCents > 0 && apiKeyHash) {
                  trackSpend(apiKeyHash, Math.ceil(totalCents)).catch((err) => {
                    logger.error({ err, keyPrefix: apiKeyHash.slice(0, 8) }, "[ws:spend-limit] Track failed:");
                  });
                }

                sendWsDone(wsClient, requestId, model, streamCreated);
              } else {
                try {
                  const parsed = JSON.parse(dataStr);
                  const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.text ?? "";
                  const finishReason = parsed.choices?.[0]?.finish_reason;

                  sendWsJson(wsClient, {
                    type: "chunk",
                    id: requestId,
                    delta,
                    index: 0,
                    finish_reason: finishReason || null,
                  });

                  if (parsed.usage?.completion_tokens) {
                    finalOutputTokens = parsed.usage.completion_tokens;
                  }
                } catch {
                  // Skip malformed JSON lines
                }
              }
            }
          }
        }

        sendWsJson(wsClient, { type: "done", id: requestId });

      } catch (err) {
        const errType = (err as { type?: string }).type ?? "inference_error";
        const errMsg = err instanceof Error ? err.message : "Inference failed";
        sendWsError(wsClient, errMsg, errType);
        wsClient.close();
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "[ws] Socket error:");
      session = null;
    });

    ws.on("close", () => {
      session = null;
    });
  });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);

    if (url.pathname === "/v1/chat/completions/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  return wss;
}