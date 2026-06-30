// OpenAPI 3.0 spec for the OMA AI public API.
// Served at GET /v1/openapi.json and rendered at GET /v1/docs via Swagger UI.

import { Hono } from "hono";
import { config } from "../config.js";
import type { OmaEnv } from "../types.js";

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "OMA AI API",
    version: "2.0.0",
    description:
      "Permissionless AI inference gateway. Access 91+ models across multiple providers with automatic failover. Pay with crypto (USDC on Base, SOL, or any chain via LiFi/Houdini/CCTP).",
    contact: { name: "OMA AI", url: "https://oma-ai.com" },
    license: { name: "Proprietary" },
  },
  servers: [
    { url: config.PUBLIC_API_URL, description: "Production" },
    { url: "http://localhost:3001", description: "Local dev" },
  ],
  tags: [
    { name: "Models", description: "Browse the model catalog" },
    { name: "Chat", description: "OpenAI-compatible chat completions (also streaming, audio, image, video, embeddings)" },
    { name: "Auth", description: "SIWE / account-number auth, API key management" },
    { name: "Credits", description: "Balance, top-up, refunds" },
    { name: "Deposits", description: "Crypto deposit flows (USDC, CCTP, Houdini, LiFi)" },
    { name: "Search", description: "Web search via Tinyfish" },
    { name: "X402", description: "x402 payment protocol endpoints" },
    { name: "Operational", description: "Health, version, OpenAPI" },
  ],
  components: {
    securitySchemes: {
      ApiKey: { type: "http", scheme: "bearer" },
      SessionCookie: { type: "apiKey", in: "cookie", name: "oma_session" },
    },
    schemas: {
      Model: {
        type: "object",
        properties: {
          id: { type: "string" },
          owned_by: { type: "string" },
          provider: { type: "string" },
          category: { type: "string", enum: ["budget", "standard", "premium", "reasoning", "embedding", "image", "video", "audio"] },
          context_length: { type: "integer" },
          capabilities: { type: "array", items: { type: "string" } },
          pricing: { type: "object", additionalProperties: true },
        },
      },
      ChatCompletionRequest: {
        type: "object",
        required: ["model", "messages"],
        properties: {
          model: { type: "string" },
          messages: { type: "array", items: { type: "object" } },
          temperature: { type: "number" },
          max_tokens: { type: "integer" },
          stream: { type: "boolean" },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "object", properties: { message: { type: "string" }, type: { type: "string" } } } },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Operational"],
        summary: "Liveness + DB ping",
        security: [],
        responses: { "200": { description: "Healthy" }, "503": { description: "Degraded" } },
      },
    },
    "/live": {
      get: { tags: ["Operational"], summary: "Liveness only (no DB ping)", security: [], responses: { "200": { description: "Alive" } } },
    },
    "/ready": {
      get: { tags: ["Operational"], summary: "Readiness with DB + Redis checks", security: [], responses: { "200": { description: "Ready" }, "503": { description: "Degraded" } } },
    },
    "/version": {
      get: { tags: ["Operational"], summary: "Build + runtime metadata", security: [], responses: { "200": { description: "OK" } } },
    },
    "/v1/openapi.json": {
      get: { tags: ["Operational"], summary: "This spec", security: [], responses: { "200": { description: "JSON" } } },
    },
    "/v1/models": {
      get: {
        tags: ["Models"],
        summary: "List available models",
        security: [],
        parameters: [
          { name: "provider", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Model list", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/v1/chat/completions": {
      post: {
        tags: ["Chat"],
        summary: "OpenAI-compatible chat completion (supports streaming, image, audio, video, embeddings via model)",
        security: [{ ApiKey: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ChatCompletionRequest" } } } },
        responses: { "200": { description: "Completion" }, "401": { description: "Unauthorized" }, "402": { description: "Insufficient credits" } },
      },
    },
    "/v1/embeddings": {
      post: {
        tags: ["Chat"],
        summary: "Vector embeddings (via Venice)",
        security: [{ ApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["model", "input"],
                properties: {
                  model: { type: "string", description: "e.g. text-embedding-3-small" },
                  input: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }], description: "Max 50,000 chars per input" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Embedding list" }, "401": { description: "Unauthorized" }, "402": { description: "Insufficient credits" } },
      },
    },
    "/v1/images/generations": {
      post: {
        tags: ["Chat"],
        summary: "Text-to-image generation (via Venice FLUX)",
        security: [{ ApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["model", "prompt"],
                properties: {
                  model: { type: "string", description: "e.g. venice-flux-schnell" },
                  prompt: { type: "string", maxLength: 4000 },
                  n: { type: "integer", maximum: 10, description: "Number of images (default 1)" },
                  size: { type: "string", description: "e.g. 1024x1024" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Image URLs" }, "401": { description: "Unauthorized" }, "402": { description: "Insufficient credits" } },
      },
    },
    "/v1/audio/speech": {
      post: {
        tags: ["Chat"],
        summary: "Text-to-speech (returns raw audio bytes)",
        security: [{ ApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["model", "input"],
                properties: {
                  model: { type: "string", description: "e.g. tts-1" },
                  input: { type: "string", maxLength: 10000 },
                  voice: { type: "string" },
                  response_format: { type: "string", enum: ["mp3", "opus", "aac", "flac", "wav", "pcm"] },
                  speed: { type: "number", minimum: 0.25, maximum: 4.0 },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Binary audio data" }, "401": { description: "Unauthorized" }, "402": { description: "Insufficient credits" } },
      },
    },
    "/v1/audio/transcriptions": {
      post: {
        tags: ["Chat"],
        summary: "Speech-to-text transcription (multipart form)",
        security: [{ ApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["model", "file"],
                properties: {
                  model: { type: "string", description: "e.g. whisper-1" },
                  file: { type: "string", format: "binary" },
                  language: { type: "string", description: "ISO-639-1 code" },
                  prompt: { type: "string" },
                  response_format: { type: "string", enum: ["json", "text", "srt", "verbose_json", "vtt"] },
                  temperature: { type: "number" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Transcription result" }, "401": { description: "Unauthorized" }, "402": { description: "Insufficient credits" } },
      },
    },
    "/v1/videos/generations": {
      post: {
        tags: ["Chat"],
        summary: "Text-to-video generation (returns queue_id for polling)",
        security: [{ ApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["model", "prompt"],
                properties: {
                  model: { type: "string", description: "e.g. venice-video-1" },
                  prompt: { type: "string", maxLength: 4000 },
                  duration: { type: "string", description: "e.g. 5s, 10s" },
                  aspect_ratio: { type: "string", description: "e.g. 16:9, 9:16" },
                  resolution: { type: "string", description: "e.g. 720p, 1080p" },
                  image_url: { type: "string", format: "uri", description: "Source image for image-to-video" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Queue id for polling" }, "401": { description: "Unauthorized" }, "402": { description: "Insufficient credits" } },
      },
    },
    "/v1/videos/quote": {
      post: {
        tags: ["Chat"],
        summary: "Get a price quote for video generation before submitting",
        security: [{ ApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["model", "prompt"],
                properties: {
                  model: { type: "string", description: "e.g. seedance-2-0-text-to-video" },
                  prompt: { type: "string", maxLength: 4000 },
                  duration: { type: "string", description: "e.g. 5s, 10s" },
                  aspect_ratio: { type: "string", description: "e.g. 16:9, 9:16" },
                  resolution: { type: "string", description: "e.g. 720p, 1080p" },
                  image_url: { type: "string", format: "uri", description: "Source image for image-to-video" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Price quote" }, "401": { description: "Unauthorized" } },
      },
    },
    "/v1/videos/retrieve": {
      get: {
        tags: ["Chat"],
        summary: "Poll video generation status by queue_id",
        security: [{ ApiKey: [] }],
        parameters: [{ name: "queue_id", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Video status and URL" }, "401": { description: "Unauthorized" } },
      },
    },
    "/v1/chat/completions/ws": {
      get: {
        tags: ["Chat"],
        summary: "WebSocket variant of /v1/chat/completions (streaming)",
        security: [{ ApiKey: [] }],
        responses: { "101": { description: "Switching protocols" }, "401": { description: "Unauthorized" } },
      },
    },
    "/v1/auth/nonce": {
      get: {
        tags: ["Auth"],
        summary: "Get a SIWE nonce for an EVM address",
        security: [],
        parameters: [{ name: "address", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Nonce issued" } },
      },
    },
    "/v1/auth/verify": {
      post: { tags: ["Auth"], summary: "Verify a SIWE signature, issue session cookie", security: [], responses: { "200": { description: "Authenticated" }, "401": { description: "Invalid signature" } } },
    },
    "/v1/auth/logout": { post: { tags: ["Auth"], summary: "Clear session", security: [{ SessionCookie: [] }], responses: { "200": { description: "OK" } } } },
    "/v1/api-keys": {
      get: { tags: ["Auth"], summary: "List your API keys", security: [{ ApiKey: [] }, { SessionCookie: [] }], responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } } },
      post: { tags: ["Auth"], summary: "Create a new API key (key value returned only once)", security: [{ SessionCookie: [] }], responses: { "201": { description: "Created" } } },
    },
    "/v1/credits/balance": {
      get: { tags: ["Credits"], summary: "Current credit balance", security: [{ ApiKey: [] }], responses: { "200": { description: "OK" } } },
    },
    "/v1/deposit/usdc/nonce": {
      get: { tags: ["Deposits"], summary: "Get a nonce for a USDC direct deposit", security: [], parameters: [{ name: "address", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
    },
    "/v1/deposit/usdc/signature": {
      post: { tags: ["Deposits"], summary: "Submit a USDC EIP-3009 transferWithAuthorization signature", security: [], responses: { "200": { description: "OK" } } },
    },
    "/v1/deposit/balance": {
      get: { tags: ["Deposits"], summary: "On-chain USDC balance for an address", security: [], parameters: [{ name: "address", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
    },
    "/v1/deposit/houdini/tokens": {
      get: { tags: ["Deposits"], summary: "List Houdini-supported swap tokens", security: [], responses: { "200": { description: "OK" } } },
    },
    "/v1/search": {
      get: { tags: ["Search"], summary: "Web search via Tinyfish MCP", security: [{ ApiKey: [] }], parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
    },
    "/v1/x402/quote": {
      get: { tags: ["X402"], summary: "Quote a cross-chain deposit", security: [], responses: { "200": { description: "OK" } } },
    },
    "/v1/x402/deposit": {
      post: { tags: ["X402"], summary: "Initiate a cross-chain deposit via x402", security: [], responses: { "200": { description: "OK" } } },
    },
    "/v1/x402/proxy": {
      post: { tags: ["X402"], summary: "Proxy an x402-protected resource (501 stub until paid)", security: [], responses: { "501": { description: "Not implemented" } } },
    },
    // ── X402 v2 (Coinbase spec, base64 wire format) ─────────────
    // V2 protocol endpoints. Mounted at /v2/x402/*. EIP-3009 settlement
    // is not yet implemented; the verify/settle routes return 501 with
    // the protocol-level "settlement pending" error code. See
    // server/src/x402/v2.ts and ARCHITECTURE.md §x402 & Cross-Chain
    // Payments (Implementation Phases — Phase 2).
    "/v2/x402/pay-req-test": {
      post: { tags: ["X402"], summary: "V2 Payment Required (base64 PAYMENT-REQUIRED header, exact scheme, eip155:8453)", security: [], responses: { "402": { description: "Payment required" } } },
    },
    "/v2/x402/verify": {
      post: { tags: ["X402"], summary: "V2 verify (protocol shape validation only; EIP-3009 settlement pending — returns 501)", security: [], responses: { "400": { description: "Malformed base64 PAYMENT-SIGNATURE or wrong x402Version/scheme" }, "501": { description: "V2 protocol shape validated; EIP-3009 settlement not yet implemented" } } },
    },
    "/v2/x402/settle": {
      post: { tags: ["X402"], summary: "V2 settle (EIP-3009 settlement pending — returns 501)", security: [], responses: { "501": { description: "V2 settlement not yet implemented" } } },
    },
  },
} as const;

export const openapiRoutes = new Hono<OmaEnv>();

openapiRoutes.get("/v1/openapi.json", (c) => c.json(openapiSpec));
// YAML is not generated — we ship only the JSON spec. The text/plain body
// points callers at the real artifact so HTTP clients and curl users get a
// useful answer instead of a 404.
openapiRoutes.get("/v1/openapi.yaml", (c) =>
  c.text("See /v1/openapi.json for the machine-readable spec.\n", 200, { "Content-Type": "text/plain" }),
);

// Swagger UI - a self-contained HTML page that loads the OpenAPI spec.
const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OMA AI API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #06b6d4; }
    .swagger-ui .scheme-container { background: #0a0a0a; }
    .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: "/v1/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
        defaultModelsExpandDepth: -1,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      });
    };
  </script>
</body>
</html>`;

openapiRoutes.get("/v1/docs", (c) => c.html(SWAGGER_HTML));
openapiRoutes.get("/docs", (c) => c.html(SWAGGER_HTML));
