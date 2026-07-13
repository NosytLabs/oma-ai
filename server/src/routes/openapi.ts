// OpenAPI 3.1.0 spec for the OMA AI public API.
// Served at GET /v1/openapi.json and rendered at GET /v1/docs via Swagger UI.

import { Hono } from "hono";
import { config } from "../config.js";
import type { OmaEnv } from "../types.js";
import { SWAGGER_HTML } from "./_lib/swagger-html.js";
import { openapiPaths } from "./_lib/openapi-paths.js";

const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "OMA AI API",
    version: "2.1.0",
    description:
      "Open Model Access AI inference gateway. Access 95+ models across multiple providers with automatic failover.\n\n" +
      "Pay with crypto (USDC on Base, or any chain via LiFi/CCTP) or fiat on-ramp.\n\n" +
      "Authentication: Bearer token (API key or session JWT) in the `Authorization` header.",
    contact: { name: "OMA AI", url: "https://oma-ai.com" },
    license: { name: "Proprietary" },
  },
  servers: [
    { url: config.PUBLIC_API_URL, description: "Production" },
    { url: "http://localhost:3001", description: "Local dev" },
  ],
  tags: [
    { name: "Chat", description: "OpenAI-compatible chat completions, embeddings, images, audio, and video" },
    { name: "Models", description: "Browse the model catalog" },
    { name: "Credits", description: "Balance, top-up, auto-reload, refunds, budget alerts, price estimates" },
    { name: "Usage", description: "Per-user usage analytics and recent records" },
    { name: "Auth", description: "SIWE / account-number auth, API key management, 2FA" },
    { name: "Deposits", description: "Crypto deposit flows (USDC, CCTP, LiFi)" },
    { name: "Onramp", description: "Fiat-to-crypto on-ramp via MoonPay" },
    { name: "Search", description: "Web search via Tinyfish" },
    { name: "X402", description: "x402 payment protocol endpoints (v1 + v2)" },
    { name: "Admin", description: "Admin-only endpoints (users, usage, revenue, config, refunds)" },
    { name: "Operational", description: "Health, version, OpenAPI spec" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key or session JWT. Obtain via /auth/verify, /auth/account/login, or /auth/wallet.",
      },
      SessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "oma_session",
        description: "HttpOnly session cookie set by auth endpoints.",
      },
    },
    schemas: {
      // ── Common ──────────────────────────────────────────────
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            required: ["message", "type"],
            properties: {
              message: { type: "string", description: "Human-readable error message" },
              type: {
                type: "string",
                description: "Machine-readable error type",
                enum: [
                  "invalid_request_error",
                  "authentication_error",
                  "authorization_error",
                  "not_found",
                  "rate_limit_error",
                  "server_error",
                  "inference_error",
                  "search_error",
                  "not_implemented",
                ],
              },
              code: { type: "string", description: "Optional error code for programmatic handling" },
            },
          },
        },
        example: {
          error: {
            message: "Model 'invalid-model' not found",
            type: "invalid_request_error",
            code: "model_not_found",
          },
        },
      },
      ValidationError: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              message: { type: "string", example: "Validation failed" },
              type: { type: "string", example: "invalid_request_error" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "array", items: { type: "string" } },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },

      // ── Models ──────────────────────────────────────────────
      Model: {
        type: "object",
        properties: {
          id: { type: "string", description: "Model identifier" },
          object: { type: "string", enum: ["model"] },
          created: { type: "integer", description: "Unix timestamp" },
          owned_by: { type: "string", example: "oma" },
          permission: { type: "array", items: { type: "object" } },
          root: { type: "string" },
          parent: { type: ["string", "null"] },
          pricing: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Price per token (input)" },
              completion: { type: "string", description: "Price per token (output)" },
            },
          },
          category: {
            type: "string",
            enum: ["budget", "standard", "premium", "reasoning", "embedding", "image", "video", "audio"],
          },
          context_length: { type: "integer" },
        },
      },
      ModelDetail: {
        allOf: [
          { $ref: "#/components/schemas/Model" },
          {
            type: "object",
            properties: {
              supports_streaming: { type: "boolean" },
              provider: { type: "string" },
            },
          },
        ],
      },
      ModelList: {
        type: "object",
        properties: {
          object: { type: "string", enum: ["list"] },
          data: { type: "array", items: { $ref: "#/components/schemas/Model" } },
        },
      },

      // ── Chat ────────────────────────────────────────────────
      ChatMessage: {
        type: "object",
        required: ["role", "content"],
        properties: {
          role: { type: "string", enum: ["system", "user", "assistant", "tool"] },
          content: {
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "object" }, description: "Multi-part content (text, image_url, etc.)" },
            ],
          },
        },
      },
      ChatCompletionRequest: {
        type: "object",
        required: ["model", "messages"],
        properties: {
          model: { type: "string", description: "Model ID (e.g. 'gpt-4o', 'claude-sonnet-4-20250514')" },
          messages: {
            type: "array",
            items: { $ref: "#/components/schemas/ChatMessage" },
            minItems: 1,
            maxItems: 100,
            description: "Conversation messages. Max 100 messages, max 1MB total content.",
          },
          temperature: { type: "number", minimum: 0, maximum: 2, description: "Sampling temperature" },
          max_tokens: { type: "integer", minimum: 1, description: "Maximum tokens to generate" },
          stream: { type: "boolean", description: "Enable SSE streaming" },
          tools: { type: "array", items: { type: "object" }, description: "Tool definitions for function calling" },
          response_format: { type: "object", description: "Response format (e.g. { type: 'json_object' })" },
        },
      },
      ChatCompletionResponse: {
        type: "object",
        properties: {
          id: { type: "string" },
          object: { type: "string", example: "chat.completion" },
          created: { type: "integer" },
          model: { type: "string" },
          choices: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "integer" },
                message: { $ref: "#/components/schemas/ChatMessage" },
                finish_reason: { type: "string", enum: ["stop", "length", "tool_calls"] },
              },
            },
          },
          usage: {
            type: "object",
            properties: {
              prompt_tokens: { type: "integer" },
              completion_tokens: { type: "integer" },
              total_tokens: { type: "integer" },
            },
          },
        },
      },

      // ── Credits ─────────────────────────────────────────────
      Balance: {
        type: "object",
        properties: {
          balanceCents: { type: "number" },
          totalDepositedCents: { type: "number" },
          totalUsedCents: { type: "number" },
          lastActivityAt: { type: "string", format: "date-time" },
          activeBatches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                amountCents: { type: "number" },
                remainingCents: { type: "number" },
                expiresAt: { type: "string", format: "date-time" },
                paymentMethod: { type: "string" },
              },
            },
          },
        },
      },
      UsageByModel: {
        type: "object",
        properties: {
          model: { type: "string" },
          inputTokens: { type: "integer" },
          outputTokens: { type: "integer" },
          totalCents: { type: "number" },
          requestCount: { type: "integer" },
        },
      },

      // ── Auth ────────────────────────────────────────────────
      ApiKey: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          keyPrefix: { type: "string", description: "Visible prefix of the API key" },
          active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      // ── Usage ───────────────────────────────────────────────
      UsageRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          model: { type: "string" },
          provider: { type: "string" },
          inputTokens: { type: "integer" },
          outputTokens: { type: "integer" },
          totalCents: { type: "number" },
          latencyMs: { type: "integer" },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      // ── Rate Limit Headers (common response) ────────────────
      RateLimitHeaders: {
        type: "object",
        properties: {
          "X-RateLimit-Limit": { type: "integer", description: "Max requests in window" },
          "X-RateLimit-Remaining": { type: "integer", description: "Remaining requests" },
          "X-RateLimit-Reset": { type: "integer", description: "Window reset (Unix seconds)" },
          "Retry-After": { type: "integer", description: "Seconds until retry (on 429)" },
        },
      },
    },
  },
  paths: openapiPaths,
} as const;

// ── Type narrowing ────────────────────────────────────────────
// Cast the const spec to a mutable type so Hono's c.json() accepts it.
type OpenApiSpec = Record<string, unknown>;
const openapiSpecMutable = openapiSpec as unknown as OpenApiSpec;

export const openapiRoutes = new Hono<OmaEnv>();

openapiRoutes.get("/v1/openapi.json", (c) =>
  c.json(openapiSpecMutable, 200, { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" }),
);
// YAML is not generated — we ship only the JSON spec.
openapiRoutes.get("/v1/openapi.yaml", (c) =>
  c.text("See /v1/openapi.json for the machine-readable spec.\n", 200, { "Content-Type": "text/plain" }),
);

// Swagger UI template lives in `./_lib/swagger-html.ts` to keep this file
// focused on the OpenAPI spec itself.

openapiRoutes.get("/v1/docs", (c) =>
  c.html(SWAGGER_HTML, 200, { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" }),
);
openapiRoutes.get("/docs", (c) =>
  c.html(SWAGGER_HTML, 200, { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" }),
);
