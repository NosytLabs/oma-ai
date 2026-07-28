/**
 * OpenAPI 3.1.0 path definitions for the OMA AI public API.
 *
 * Each path is grouped by OpenAPI tag (Operational, Models, Chat,
 * Credits, Usage, Auth, Search, Onramp, Deposits, Admin) using the
 * ASCII-art section banners that match the spec served at
 * `GET /v1/openapi.json`.
 *
 * Kept in its own file so `server/src/routes/openapi.ts` can focus
 * on the spec header, components, and route handlers. To split this
 * further into per-tag modules, run:
 *   1. Cut each tag group (everything between two banner comments).
 *   2. Save into `_lib/openapi-paths/<tag>.ts` as a named export.
 *   3. Re-export them from `./openapi-paths/<tag>` here and merge
 *      with `{ ...openapiPathsOperational, ...openapiPathsChat, ... }`.
 *
 * The content below is the verbatim body of the original `paths:`
 * block from openapi.ts, preserved as-is to avoid any spec drift.
 */

export const openapiPaths = {
    // ═══════════════════════════════════════════════════════════
    //  OPERATIONAL
    // ═══════════════════════════════════════════════════════════
    "/health": {
      get: {
        tags: ["Operational"],
        summary: "Health check (liveness + DB ping)",
        security: [],
        operationId: "getHealth",
        responses: {
          "200": { description: "Healthy" },
          "503": { description: "Degraded" },
        },
      },
    },
    "/live": {
      get: {
        tags: ["Operational"],
        summary: "Liveness probe (no DB)",
        security: [],
        operationId: "getLiveness",
        responses: { "200": { description: "Alive" } },
      },
    },
    "/ready": {
      get: {
        tags: ["Operational"],
        summary: "Readiness probe (DB + Redis)",
        security: [],
        operationId: "getReadiness",
        responses: {
          "200": { description: "Ready" },
          "503": { description: "Degraded" },
        },
      },
    },
    "/version": {
      get: {
        tags: ["Operational"],
        summary: "Build + runtime metadata",
        security: [],
        operationId: "getVersion",
        responses: { "200": { description: "Version info" } },
      },
    },
    "/v1/openapi.json": {
      get: {
        tags: ["Operational"],
        summary: "This OpenAPI 3.1.0 spec",
        security: [],
        operationId: "getOpenApiSpec",
        responses: { "200": { description: "JSON spec" } },
      },
    },
    "/v1/docs": {
      get: {
        tags: ["Operational"],
        summary: "Swagger UI documentation",
        security: [],
        operationId: "getDocs",
        responses: { "200": { description: "HTML Swagger UI" } },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  MODELS
    // ═══════════════════════════════════════════════════════════
    "/v1/models": {
      get: {
        tags: ["Models"],
        summary: "List available models",
        description: "Returns all available models across 9 modalities (chat, image, video, TTS, embedding, ASR, music, upscale, inpaint) with per-token, per-image, per-generation, or per-audio-second pricing depending on modality.",
        security: [],
        operationId: "listModels",
        parameters: [
          { name: "provider", in: "query", schema: { type: "string" }, description: "Filter by provider" },
          { name: "category", in: "query", schema: { type: "string" }, description: "Filter by category" },
        ],
        responses: {
          "200": {
            description: "Model list",
            headers: {
              "Cache-Control": { schema: { type: "string", example: "public, max-age=3600" } },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModelList" },
                example: {
                  object: "list",
                  data: [
                    {
                      id: "gpt-4o",
                      object: "model",
                      created: 1700000000,
                      owned_by: "oma",
                      pricing: { prompt: "0.00000250", completion: "0.00001000" },
                      category: "premium",
                      context_length: 128000,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/v1/models/{model}": {
      get: {
        tags: ["Models"],
        summary: "Retrieve a model",
        security: [],
        operationId: "getModel",
        parameters: [
          { name: "model", in: "path", required: true, schema: { type: "string" }, description: "Model ID" },
        ],
        responses: {
          "200": {
            description: "Model details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ModelDetail" },
                example: {
                  id: "gpt-4o",
                  object: "model",
                  created: 1700000000,
                  owned_by: "oma",
                  pricing: { prompt: "0.00000250", completion: "0.00001000" },
                  category: "premium",
                  context_length: 128000,
                  supports_streaming: true,
                  provider: "venice",
                },
              },
            },
          },
          "404": { description: "Model not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  CHAT COMPLETIONS
    // ═══════════════════════════════════════════════════════════
    "/v1/chat/completions": {
      post: {
        tags: ["Chat"],
        summary: "Chat completion (OpenAI-compatible)",
        description:
          "Create a chat completion. Supports streaming via `stream: true` (SSE), tool/function calling, " +
          "and multi-modal content. Rate-limited per API key. Costs deducted from credit balance.",
        security: [{ BearerAuth: [] }],
        operationId: "createChatCompletion",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" },
            description: "Optional idempotency key for safe retries",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatCompletionRequest" },
              example: {
                model: "gpt-4o",
                messages: [
                  { role: "system", content: "You are a helpful assistant." },
                  { role: "user", content: "What is the capital of France?" },
                ],
                temperature: 0.7,
                max_tokens: 1024,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Completion response (non-streaming)",
            headers: {
              "x-provider": { schema: { type: "string" }, description: "Upstream provider used" },
              "X-Correlation-ID": { schema: { type: "string" }, description: "Request correlation ID" },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChatCompletionResponse" },
              },
              "text/event-stream": {
                schema: { type: "string", description: "SSE stream of ChatCompletionChunk objects" },
              },
            },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Unauthorized" },
          "402": { description: "Insufficient credits" },
          "403": { description: "Model not allowed for this API key" },
          "413": { description: "Request body too large (>10MB)" },
          "429": { description: "Rate limited", headers: { "Retry-After": { schema: { type: "integer" } } } },
          "500": { description: "Inference error" },
        },
      },
    },
    "/v1/chat/completions/ws": {
      get: {
        tags: ["Chat"],
        summary: "WebSocket chat completion (streaming)",
        security: [{ BearerAuth: [] }],
        operationId: "chatCompletionWs",
        responses: {
          "101": { description: "Switching protocols to WebSocket" },
          "401": { description: "Unauthorized" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  EMBEDDINGS
    // ═══════════════════════════════════════════════════════════
    "/v1/embeddings": {
      post: {
        tags: ["Chat"],
        summary: "Create embeddings",
        security: [{ BearerAuth: [] }],
        operationId: "createEmbeddings",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["model", "input"],
                properties: {
                  model: { type: "string", description: "e.g. text-embedding-3-small (Venice passthrough)" },
                  input: {
                    oneOf: [
                      { type: "string", maxLength: 50000 },
                      { type: "array", items: { type: "string", maxLength: 50000 } },
                    ],
                    description: "Max 50,000 chars per input string",
                  },
                },
              },
              example: {
                model: "text-embedding-3-small (Venice passthrough)",
                input: "The quick brown fox jumped over the lazy dog.",
              },
            },
          },
        },
        responses: {
          "200": { description: "Embedding vectors" },
          "401": { description: "Unauthorized" },
          "402": { description: "Insufficient credits" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  IMAGES
    // ═══════════════════════════════════════════════════════════
    "/v1/images/generations": {
      post: {
        tags: ["Chat"],
        summary: "Text-to-image generation",
        security: [{ BearerAuth: [] }],
        operationId: "createImage",
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
                  n: { type: "integer", minimum: 1, maximum: 10, description: "Number of images" },
                  size: { type: "string", description: "e.g. 1024x1024" },
                },
              },
              example: { model: "venice-flux-schnell", prompt: "A sunset over mountains", n: 1, size: "1024x1024" },
            },
          },
        },
        responses: {
          "200": { description: "Generated image URLs" },
          "401": { description: "Unauthorized" },
          "402": { description: "Insufficient credits" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  AUDIO
    // ═══════════════════════════════════════════════════════════
    "/v1/audio/speech": {
      post: {
        tags: ["Chat"],
        summary: "Text-to-speech",
        security: [{ BearerAuth: [] }],
        operationId: "createSpeech",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["model", "input"],
                properties: {
                  model: { type: "string", description: "e.g. tts-1-hd (Venice passthrough)" },
                  input: { type: "string", maxLength: 10000 },
                  voice: { type: "string" },
                  response_format: { type: "string", enum: ["mp3", "opus", "aac", "flac", "wav", "pcm"] },
                  speed: { type: "number", minimum: 0.25, maximum: 4.0 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Binary audio data" },
          "401": { description: "Unauthorized" },
          "402": { description: "Insufficient credits" },
        },
      },
    },
    "/v1/audio/transcriptions": {
      post: {
        tags: ["Chat"],
        summary: "Speech-to-text transcription",
        security: [{ BearerAuth: [] }],
        operationId: "createTranscription",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["model", "file"],
                properties: {
                  model: { type: "string", description: "e.g. whisper-large-v3 (Venice passthrough)" },
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
        responses: {
          "200": { description: "Transcription result" },
          "401": { description: "Unauthorized" },
          "402": { description: "Insufficient credits" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  VIDEO
    // ═══════════════════════════════════════════════════════════
    "/v1/videos/generations": {
      post: {
        tags: ["Chat"],
        summary: "Text-to-video generation",
        description: "Returns a queue_id for polling via GET /v1/videos/retrieve.",
        security: [{ BearerAuth: [] }],
        operationId: "createVideo",
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
        responses: {
          "200": { description: "Queue ID for polling" },
          "401": { description: "Unauthorized" },
          "402": { description: "Insufficient credits" },
        },
      },
    },
    "/v1/videos/quote": {
      post: {
        tags: ["Chat"],
        summary: "Get video generation price quote",
        security: [{ BearerAuth: [] }],
        operationId: "getVideoQuote",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["model", "prompt"],
                properties: {
                  model: { type: "string" },
                  prompt: { type: "string", maxLength: 4000 },
                  duration: { type: "string" },
                  aspect_ratio: { type: "string" },
                  resolution: { type: "string" },
                  image_url: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Price quote" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/videos/retrieve": {
      get: {
        tags: ["Chat"],
        summary: "Poll video generation status",
        security: [{ BearerAuth: [] }],
        operationId: "getVideoStatus",
        parameters: [
          { name: "queue_id", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Video status and URL" },
          "401": { description: "Unauthorized" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  CREDITS
    // ═══════════════════════════════════════════════════════════
    "/v1/credits/balance": {
      get: {
        tags: ["Credits"],
        summary: "Get credit balance",
        security: [{ BearerAuth: [] }],
        operationId: "getBalance",
        responses: {
          "200": {
            description: "Balance details with active batches",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Balance" } } },
          },
          "500": { description: "Server error" },
        },
      },
    },
    "/v1/credits/purchase": {
      post: {
        tags: ["Credits"],
        summary: "Create a credit deposit",
        security: [{ BearerAuth: [] }],
        operationId: "purchaseCredits",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amountCents"],
                properties: {
                  amountCents: { type: "integer", minimum: 100, description: "Amount in cents (min $1)" },
                  paymentMethod: { type: "string", enum: ["usdc"], default: "usdc" },
                  autoReload: { type: "boolean", description: "Enable auto-reload for this deposit" },
                },
              },
              example: { amountCents: 5000, paymentMethod: "usdc", autoReload: true },
            },
          },
        },
        responses: {
          "200": {
            description: "Deposit created (pending payment confirmation)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    depositId: { type: "string" },
                    status: { type: "string", example: "pending" },
                    amountCents: { type: "integer" },
                    paymentMethod: { type: "string" },
                    autoReloadEnabled: { type: "boolean" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
        },
      },
    },
    "/v1/credits/transactions": {
      get: {
        tags: ["Credits"],
        summary: "List credit transactions (deposits + usage)",
        security: [{ BearerAuth: [] }],
        operationId: "listTransactions",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
        ],
        responses: {
          "200": {
            description: "Transactions list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    transactions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          type: { type: "string", enum: ["deposit", "usage"] },
                          amountCents: { type: "number" },
                          status: { type: "string" },
                          createdAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/credits/usage": {
      get: {
        tags: ["Credits"],
        summary: "Usage breakdown by model",
        security: [{ BearerAuth: [] }],
        operationId: "getUsageBreakdown",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
          { name: "days", in: "query", schema: { type: "integer", minimum: 1, maximum: 365, default: 90 } },
        ],
        responses: {
          "200": {
            description: "Usage by model",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    usageByModel: { type: "array", items: { $ref: "#/components/schemas/UsageByModel" } },
                    totalUsageCents: { type: "number" },
                    periodDays: { type: "integer" },
                    recordLimit: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/credits/auto-reload": {
      get: {
        tags: ["Credits"],
        summary: "Get auto-reload settings",
        security: [{ BearerAuth: [] }],
        operationId: "getAutoReload",
        responses: {
          "200": {
            description: "Auto-reload config",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    enabled: { type: "boolean" },
                    thresholdCents: { type: "number" },
                    reloadAmountCents: { type: "number" },
                    spendLimitCents: { type: "number" },
                    paymentMethod: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Credits"],
        summary: "Update auto-reload settings",
        security: [{ BearerAuth: [] }],
        operationId: "updateAutoReload",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["enabled"],
                properties: {
                  enabled: { type: "boolean" },
                  thresholdCents: { type: "number" },
                  reloadAmountCents: { type: "number" },
                  spendLimitCents: { type: "number" },
                  paymentMethod: { type: "string", enum: ["usdc"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated settings" },
          "400": { description: "Validation error" },
        },
      },
    },
    "/v1/credits/refund/{usageId}": {
      post: {
        tags: ["Credits"],
        summary: "Refund a usage record",
        security: [{ BearerAuth: [] }],
        operationId: "refundUsage",
        parameters: [
          { name: "usageId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Refund issued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    creditsRefunded: { type: "number" },
                  },
                },
              },
            },
          },
          "404": { description: "Usage record not found" },
          "409": { description: "Already refunded" },
        },
      },
    },
    "/v1/credits/price-estimate": {
      get: {
        tags: ["Credits"],
        summary: "Estimate cost for a model call",
        security: [{ BearerAuth: [] }],
        operationId: "getPriceEstimate",
        parameters: [
          { name: "model", in: "query", required: true, schema: { type: "string" } },
          { name: "inputTokens", in: "query", schema: { type: "integer", default: 0 } },
          { name: "outputTokens", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "Price estimate",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    model: { type: "string" },
                    inputTokens: { type: "integer" },
                    outputTokens: { type: "integer" },
                    estimatedCredits: { type: "number" },
                    pricePerMillionInput: { type: "number" },
                    pricePerMillionOutput: { type: "number" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid model" },
        },
      },
    },
    "/v1/credits/budget-alerts": {
      get: {
        tags: ["Credits"],
        summary: "Get budget alert configuration",
        security: [{ BearerAuth: [] }],
        operationId: "getBudgetAlerts",
        responses: {
          "200": {
            description: "Budget alert config",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    budgetLimitCents: { type: "number" },
                    alertThresholds: { type: "array", items: { type: "string", enum: ["50", "75", "90", "100"] } },
                    emailEnabled: { type: "boolean" },
                    webhookEnabled: { type: "boolean" },
                    webhookUrl: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Credits"],
        summary: "Create or update budget alert",
        security: [{ BearerAuth: [] }],
        operationId: "setBudgetAlerts",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["budgetLimitCents"],
                properties: {
                  budgetLimitCents: { type: "number", minimum: 100 },
                  alertThresholds: { type: "array", items: { type: "string", enum: ["50", "75", "90", "100"] }, default: ["50", "75", "90", "100"] },
                  emailEnabled: { type: "boolean", default: true },
                  webhookEnabled: { type: "boolean", default: false },
                  webhookUrl: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Budget alert configured" },
          "400": { description: "Validation error" },
        },
      },
      delete: {
        tags: ["Credits"],
        summary: "Delete budget alerts",
        security: [{ BearerAuth: [] }],
        operationId: "deleteBudgetAlerts",
        responses: {
          "200": { description: "Deleted" },
        },
      },
    },
    "/v1/credits/budget-alerts/history": {
      get: {
        tags: ["Credits"],
        summary: "Budget alert history",
        security: [{ BearerAuth: [] }],
        operationId: "getBudgetAlertHistory",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
        ],
        responses: {
          "200": {
            description: "Alert history",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    history: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          alertType: { type: "string" },
                          thresholdPercent: { type: "number" },
                          spentCents: { type: "number" },
                          budgetLimitCents: { type: "number" },
                          createdAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  USAGE (session-authenticated)
    // ═══════════════════════════════════════════════════════════
    "/v1/usage": {
      get: {
        tags: ["Usage"],
        summary: "Usage analytics (aggregated by model/provider)",
        description: "Requires session auth (not API key). Returns totals, by-model, and by-provider breakdowns.",
        security: [{ SessionCookie: [] }, { BearerAuth: [] }],
        operationId: "getUsage",
        parameters: [
          { name: "days", in: "query", schema: { type: "integer", minimum: 1, maximum: 365, default: 30 }, description: "Lookback window in days" },
        ],
        responses: {
          "200": {
            description: "Usage analytics",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    window: { type: "object", properties: { days: { type: "integer" }, since: { type: "string", format: "date-time" } } },
                    totals: {
                      type: "object",
                      properties: {
                        totalInputTokens: { type: "integer" },
                        totalOutputTokens: { type: "integer" },
                        totalCostCents: { type: "number" },
                        requestCount: { type: "integer" },
                      },
                    },
                    byModel: { type: "array", items: { $ref: "#/components/schemas/UsageByModel" } },
                    byProvider: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          provider: { type: "string" },
                          requests: { type: "integer" },
                          inputTokens: { type: "integer" },
                          outputTokens: { type: "integer" },
                          totalCents: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "500": { description: "Server error" },
        },
      },
    },
    "/v1/usage/recent": {
      get: {
        tags: ["Usage"],
        summary: "Recent usage records",
        security: [{ SessionCookie: [] }, { BearerAuth: [] }],
        operationId: "getRecentUsage",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          "200": {
            description: "Recent records",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    records: { type: "array", items: { $ref: "#/components/schemas/UsageRecord" } },
                    count: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  AUTH
    // ═══════════════════════════════════════════════════════════
    "/auth/nonce": {
      post: {
        tags: ["Auth"],
        summary: "Get SIWE nonce for EVM address",
        security: [],
        operationId: "getNonce",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["address"],
                properties: {
                  address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "EVM address" },
                },
              },
              example: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18" },
            },
          },
        },
        responses: {
          "200": {
            description: "Nonce",
            content: { "application/json": { schema: { type: "object", properties: { nonce: { type: "string" } } } } },
          },
          "400": { description: "Invalid address" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/auth/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify SIWE signature, issue session",
        security: [],
        operationId: "verifySiwe",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message", "signature", "type"],
                properties: {
                  message: { type: "string" },
                  signature: { type: "string" },
                  type: { type: "string", enum: ["siwe"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Session token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    address: { type: "string" },
                    accountNumber: { type: "string" },
                    authMethod: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { description: "Invalid signature" },
        },
      },
    },
    "/auth/wallet": {
      post: {
        tags: ["Auth"],
        summary: "Connect wallet (generates API key on first connect)",
        security: [],
        operationId: "connectWallet",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message", "signature"],
                properties: {
                  message: { type: "string" },
                  signature: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Wallet connected (API key returned on first connect only)",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      description: "First connection — API key returned",
                      properties: {
                        apiKey: { type: "string" },
                        prefix: { type: "string" },
                        id: { type: "string" },
                        name: { type: "string" },
                        createdAt: { type: "string", format: "date-time" },
                      },
                    },
                    {
                      type: "object",
                      description: "Subsequent connection — key already exists",
                      properties: {
                        apiKey: { type: ["string", "null"], nullable: true },
                        id: { type: "string" },
                        name: { type: "string" },
                        warning: { type: "string" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "401": { description: "Invalid signature" },
        },
      },
    },
    "/auth/wallet/{type}": {
      delete: {
        tags: ["Auth"],
        summary: "Unlink wallet",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "unlinkWallet",
        parameters: [
          { name: "type", in: "path", required: true, schema: { type: "string", enum: ["evm"] } },
        ],
        responses: {
          "200": { description: "Wallet unlinked" },
          "400": { description: "Invalid wallet type" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout (clear session cookie)",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "logout",
        responses: {
          "200": {
            description: "Logged out",
            content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" } } } } },
          },
        },
      },
    },
    "/auth/2fa/setup": {
      post: {
        tags: ["Auth"],
        summary: "Set up 2FA (TOTP)",
        description: "Returns secret, QR code, and one-time backup codes.",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "setup2fa",
        responses: {
          "200": {
            description: "2FA setup data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    secret: { type: "string" },
                    otpauthUri: { type: "string" },
                    qrCodeDataUrl: { type: "string", description: "Base64 data URL for QR image" },
                    backupCodes: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/2fa/verify": {
      post: {
        tags: ["Auth"],
        summary: "Enable 2FA with TOTP code",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "verify2fa",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["code"], properties: { code: { type: "string", minLength: 6, maxLength: 6 } } },
            },
          },
        },
        responses: {
          "200": { description: "2FA enabled" },
          "400": { description: "Invalid code" },
        },
      },
    },
    "/auth/2fa/disable": {
      post: {
        tags: ["Auth"],
        summary: "Disable 2FA",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "disable2fa",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["code"],
                properties: {
                  code: { type: "string" },
                  isBackupCode: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "2FA disabled" },
          "400": { description: "Invalid code" },
        },
      },
    },
    "/auth/2fa/backup-codes": {
      get: {
        tags: ["Auth"],
        summary: "Get remaining 2FA backup code count",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "getBackupCodeCount",
        responses: {
          "200": {
            description: "Count",
            content: { "application/json": { schema: { type: "object", properties: { remaining: { type: "integer" } } } } },
          },
        },
      },
      post: {
        tags: ["Auth"],
        summary: "Regenerate 2FA backup codes (requires current TOTP)",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "regenerateBackupCodes",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["code"], properties: { code: { type: "string", minLength: 6, maxLength: 6 } } },
            },
          },
        },
        responses: {
          "200": {
            description: "New backup codes (shown once)",
            content: { "application/json": { schema: { type: "object", properties: { backupCodes: { type: "array", items: { type: "string" } } } } } },
          },
        },
      },
    },
    "/auth/2fa/status": {
      get: {
        tags: ["Auth"],
        summary: "Get 2FA status",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "get2faStatus",
        responses: { "200": { description: "2FA status" } },
      },
    },
    "/auth/csrf-token": {
      get: {
        tags: ["Auth"],
        summary: "Get CSRF token (sets cookie)",
        security: [],
        operationId: "getCsrfToken",
        responses: {
          "200": {
            description: "CSRF token",
            content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } },
          },
        },
      },
      post: {
        tags: ["Auth"],
        summary: "Get CSRF token (POST variant)",
        security: [],
        operationId: "postCsrfToken",
        responses: {
          "200": {
            description: "CSRF token",
            content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } },
          },
        },
      },
    },
    "/auth/account/create": {
      post: {
        tags: ["Auth"],
        summary: "Create account with 16-digit account number",
        security: [],
        operationId: "createAccount",
        responses: {
          "201": {
            description: "Account created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    accountNumber: { type: "string" },
                    authMethod: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Account number already exists" },
          "403": { description: "CSRF validation failed" },
        },
      },
    },
    "/auth/account/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with 16-digit account number",
        security: [],
        operationId: "loginAccount",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["accountNumber"], properties: { accountNumber: { type: "string" } } },
            },
          },
        },
        responses: {
          "200": {
            description: "Session token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    address: { type: "string" },
                    accountNumber: { type: "string" },
                    authMethod: { type: "string" },
                    hasApiKey: { type: "boolean" },
                  },
                },
              },
            },
          },
          "401": { description: "Invalid account number" },
          "403": { description: "CSRF validation failed" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/user": {
      get: {
        tags: ["Auth"],
        summary: "Get current user profile",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "getUser",
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    address: { type: "string" },
                    evmAddress: { type: "string" },
                    accountNumber: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                    authMethod: { type: "string" },
                  },
                },
              },
            },
          },
          "404": { description: "User not found" },
        },
      },
    },
    "/account": {
      delete: {
        tags: ["Auth"],
        summary: "Delete account (revokes keys, cancels subscriptions)",
        security: [{ BearerAuth: [] }, { SessionCookie: [] }],
        operationId: "deleteAccount",
        responses: {
          "200": { description: "Account deleted" },
        },
      },
    },
    "/keys": {
      get: {
        tags: ["Auth"],
        summary: "List API keys",
        security: [{ SessionCookie: [] }],
        operationId: "listApiKeys",
        responses: {
          "200": {
            description: "API key list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    keys: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Auth"],
        summary: "Create API key (returned once)",
        security: [{ SessionCookie: [] }],
        operationId: "createApiKey",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1, maxLength: 100 } } },
              example: { name: "My App Key" },
            },
          },
        },
        responses: {
          "201": {
            description: "API key (plaintext shown only here)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    key: { type: "string", description: "Full API key — save now, shown only once" },
                    prefix: { type: "string" },
                    id: { type: "string" },
                    name: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/keys/{id}": {
      delete: {
        tags: ["Auth"],
        summary: "Revoke API key",
        security: [{ SessionCookie: [] }],
        operationId: "revokeApiKey",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Revoked" },
          "404": { description: "Key not found" },
        },
      },
      patch: {
        tags: ["Auth"],
        summary: "Update API key rate limit overrides",
        security: [{ SessionCookie: [] }],
        operationId: "updateApiKeyRateLimit",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  rpm: { type: "integer", minimum: 1 },
                  tpm: { type: "integer", minimum: 100 },
                  expiresAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated" },
          "404": { description: "Key not found" },
        },
      },
    },
    "/keys/{id}/allowlist": {
      get: {
        tags: ["Auth"],
        summary: "Get API key model allowlist",
        security: [{ SessionCookie: [] }],
        operationId: "getApiKeyAllowlist",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Allowed models",
            content: { "application/json": { schema: { type: "object", properties: { models: { type: "array", items: { type: "string" } } } } } },
          },
          "404": { description: "Key not found" },
        },
      },
      patch: {
        tags: ["Auth"],
        summary: "Update API key model allowlist",
        security: [{ SessionCookie: [] }],
        operationId: "updateApiKeyAllowlist",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { models: { type: "array", items: { type: "string" } } } },
            },
          },
        },
        responses: {
          "200": { description: "Updated" },
          "404": { description: "Key not found" },
        },
      },
    },
    "/auth/api-key/cookie": {
      post: {
        tags: ["Auth"],
        summary: "Set API key cookie (for browser-based usage)",
        security: [{ SessionCookie: [] }],
        operationId: "setApiKeyCookie",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["apiKey"], properties: { apiKey: { type: "string" } } },
            },
          },
        },
        responses: {
          "200": { description: "Cookie set" },
          "404": { description: "Key not found or not owned by user" },
        },
      },
      delete: {
        tags: ["Auth"],
        summary: "Clear API key cookie",
        security: [{ SessionCookie: [] }],
        operationId: "clearApiKeyCookie",
        responses: {
          "200": { description: "Cookie cleared" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  SEARCH
    // ═══════════════════════════════════════════════════════════
    "/v1/search": {
      get: {
        tags: ["Search"],
        summary: "Web search (JSON)",
        description: "Search the web via Tinyfish. Costs 1 credit.",
        security: [{ BearerAuth: [] }],
        operationId: "searchWeb",
        parameters: [
          { name: "query", in: "query", required: true, schema: { type: "string" }, description: "Search query" },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          position: { type: "integer" },
                          site_name: { type: "string" },
                          title: { type: "string" },
                          snippet: { type: "string" },
                          url: { type: "string", format: "uri" },
                        },
                      },
                    },
                    query: { type: "string" },
                    total_results: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": { description: "Missing query parameter" },
          "401": { description: "Unauthorized" },
          "402": { description: "Insufficient credits" },
        },
      },
    },
    "/v1/search/stream": {
      get: {
        tags: ["Search"],
        summary: "Web search (SSE streaming)",
        security: [{ BearerAuth: [] }],
        operationId: "searchWebStream",
        parameters: [
          { name: "query", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "SSE stream of search results",
            content: { "text/event-stream": { schema: { type: "string" } } },
          },
          "401": { description: "Unauthorized" },
          "402": { description: "Insufficient credits" },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  ONRAMP
    // ═══════════════════════════════════════════════════════════
    "/v1/onramp/quote": {
      post: {
        tags: ["Onramp"],
        summary: "Get fiat on-ramp price quote",
        description: "Returns net amount after processing fee and credit conversion.",
        security: [],
        operationId: "getOnrampQuote",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["amountUsd"], properties: { amountUsd: { type: "number" } } },
            },
          },
        },
        responses: {
          "200": {
            description: "Quote",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    amountUsd: { type: "number" },
                    processingFeeUsd: { type: "number" },
                    netUsd: { type: "number" },
                    credits: { type: "integer" },
                    rate: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid amount" },
        },
      },
    },
    "/v1/onramp/session": {
      post: {
        tags: ["Onramp"],
        summary: "Create on-ramp payment session (MoonPay redirect)",
        security: [{ BearerAuth: [] }],
        operationId: "createOnrampSession",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amountUsd"],
                properties: {
                  amountUsd: { type: "number" },
                  successUrl: { type: "string", format: "uri" },
                  cancelUrl: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Redirect URL for MoonPay checkout",
            content: { "application/json": { schema: { type: "object", properties: { url: { type: "string", format: "uri" } } } } },
          },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════
    //  DEPOSITS
    // ═══════════════════════════════════════════════════════════
    "/v1/deposit/usdc/nonce": {
      post: {
        tags: ["Deposits"],
        summary: "Request a deposit nonce",
        description: "Returns a single-use nonce (10 min expiry) required to submit a USDC deposit. Bind the amount and wallet address at nonce time.",
        security: [{ BearerAuth: [] }],
        operationId: "requestDepositNonce",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: {
                  amount: { type: "number", minimum: 1, maximum: 100000, description: "Deposit amount in USD" },
                  walletAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "Depositor wallet address (optional, bound to nonce)" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Nonce issued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nonce: { type: "string", description: "Single-use deposit nonce" },
                    expiresAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/v1/deposit/usdc": {
      post: {
        tags: ["Deposits"],
        summary: "Submit USDC deposit for credit",
        description: "Verify an on-chain USDC transfer and credit the user account. Requires: (1) a valid nonce from /v1/deposit/usdc/nonce, (2) an EIP-191 signature proving wallet ownership, (3) a confirmed on-chain transfer to the treasury.",
        security: [{ BearerAuth: [] }],
        operationId: "submitUsdcDeposit",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount", "txHash", "signature", "nonce"],
                properties: {
                  amount: { type: "number", minimum: 1, maximum: 100000, description: "Deposit amount in USD (must match nonce)" },
                  txHash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$", description: "On-chain USDC transfer transaction hash" },
                  signature: { type: "string", minLength: 130, description: "EIP-191 personal_sign signature over the deposit confirmation message" },
                  nonce: { type: "string", description: "Nonce from /v1/deposit/usdc/nonce" },
                  walletAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$", description: "Depositor wallet (optional if bound at nonce time)" },
                  chainId: { type: "integer", description: "Chain ID (default: 8453 Base mainnet)" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Deposit credited",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    credits: { type: "number", description: "Credits added (in cents)" },
                    depositId: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation or on-chain verification failed" },
          "401": { description: "Invalid signature or nonce" },
          "409": { description: "Duplicate transaction" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/v1/deposit/balance": {
      get: {
        tags: ["Deposits"],
        summary: "On-chain USDC balance for address",
        security: [],
        operationId: "getDepositBalance",
        parameters: [
          { name: "address", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Balance" } },
      },
    },
    // ═══════════════════════════════════════════════════════════
    //  ADMIN
    // ═══════════════════════════════════════════════════════════
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "List users (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminListUsers",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Search by address or account number" },
        ],
        responses: {
          "200": {
            description: "User list with pagination",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    users: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          address: { type: "string" },
                          accountNumber: { type: "string" },
                          createdAt: { type: "string", format: "date-time" },
                          balanceDollars: { type: "number" },
                          totalDeposited: { type: "number" },
                          totalUsed: { type: "number" },
                          totalRequests: { type: "integer" },
                          totalInputTokens: { type: "integer" },
                          totalOutputTokens: { type: "integer" },
                        },
                      },
                    },
                    pagination: {
                      type: "object",
                      properties: {
                        page: { type: "integer" },
                        limit: { type: "integer" },
                        total: { type: "integer" },
                        pages: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/admin/usage": {
      get: {
        tags: ["Admin"],
        summary: "Platform usage analytics (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminUsage",
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["7d", "30d", "90d"], default: "30d" } },
        ],
        responses: { "200": { description: "Usage analytics with by-provider, by-model, daily breakdowns" } },
      },
    },
    "/admin/revenue": {
      get: {
        tags: ["Admin"],
        summary: "Revenue analytics (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminRevenue",
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["7d", "30d", "90d", "all"], default: "30d" } },
        ],
        responses: { "200": { description: "Revenue, deposits, markup, monthly breakdown" } },
      },
    },
    "/admin/config/fees": {
      get: {
        tags: ["Admin"],
        summary: "Get fee configuration (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminGetFees",
        responses: { "200": { description: "Fee config per provider" } },
      },
      put: {
        tags: ["Admin"],
        summary: "Update fee configuration (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminUpdateFees",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  config: {
                    type: "object",
                    properties: {
                      providers: { type: "object", additionalProperties: { type: "object", properties: { markupPercent: { type: "number" } } } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" } },
      },
    },
    "/admin/config/rate-limits": {
      get: {
        tags: ["Admin"],
        summary: "Get rate limit tiers (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminGetRateLimits",
        responses: { "200": { description: "Rate limit tier config" } },
      },
      put: {
        tags: ["Admin"],
        summary: "Update rate limit tiers (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminUpdateRateLimits",
        responses: { "200": { description: "Updated" } },
      },
    },
    "/admin/rate-limit-overrides": {
      get: {
        tags: ["Admin"],
        summary: "List rate limit overrides (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminListOverrides",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: { "200": { description: "Override list with pagination" } },
      },
      post: {
        tags: ["Admin"],
        summary: "Create rate limit override (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminCreateOverride",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["targetType", "targetId"],
                properties: {
                  targetType: { type: "string", enum: ["user", "api_key"] },
                  targetId: { type: "string", format: "uuid" },
                  rpm: { type: "integer" },
                  tpm: { type: "integer" },
                  expiresAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
    "/admin/rate-limit-overrides/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Delete rate limit override (admin)",
        security: [{ SessionCookie: [] }],
        operationId: "adminDeleteOverride",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Deleted" } },
      },
    },
} as const;
