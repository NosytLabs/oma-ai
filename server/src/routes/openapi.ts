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
      ApiKey: { type: "http", scheme: "bearer", bearerFormat: "OMA-xxx" },
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
        security: [{ ApiKey: [] }, { SessionCookie: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ChatCompletionRequest" } } } },
        responses: { "200": { description: "Completion" }, "401": { description: "Unauthorized" }, "402": { description: "Insufficient credits" } },
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
      get: { tags: ["Credits"], summary: "Current credit balance", security: [{ ApiKey: [] }, { SessionCookie: [] }], responses: { "200": { description: "OK" } } },
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
      get: { tags: ["Search"], summary: "Web search via Tinyfish MCP", security: [{ ApiKey: [] }, { SessionCookie: [] }], parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
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
  },
} as const;

export const openapiRoutes = new Hono<OmaEnv>();

openapiRoutes.get("/v1/openapi.json", (c) => c.json(openapiSpec));
openapiRoutes.get("/v1/openapi.yaml", (c) => c.text("# OpenAPI YAML available at /v1/openapi.json", 200, { "Content-Type": "text/plain" }));

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
