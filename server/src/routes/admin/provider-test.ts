/**
 * M10.2 — Admin / Providers / Test endpoint
 *
 * Operator-only "channel test" — analogous to new-api's controller/channel-test.go.
 * Admins can fire a 1-token chat completion against any configured provider and get
 * back a structured report: provider, model, status, latencyMs, sample response, and
 * (on failure) a sanitized error message. Useful for:
 *   - Confirming a new upstream API key works after rotation
 *   - Diagnosing a provider outage (DNS, auth, rate-limit, schema drift)
 *   - Verifying a new model is reachable before exposing it in /v1/models
 *
 * Endpoint:
 *   POST /v1/admin/providers/:provider/test
 *     Body: { model?: string, message?: string }   (both optional)
 *     Auth: sessionAuth + requireAdmin + 30/min/IP rate limit (inherited admin chain
 *           already adds 100/min; this route adds a tighter ceiling so a noisy
 *           operator cannot exhaust the broader admin budget).
 *
 * Response shape (success):
 *   { provider, model, status: "ok", latencyMs, sample, requestId? }
 *
 * Response shape (failure):
 *   503 — provider env key not configured (no upstream call made)
 *   504 — upstream call exceeded 10s timeout
 *   502 — upstream call returned non-2xx (status, latencyMs, error.message)
 *   400 — invalid body / unknown provider / message > 2000 chars
 *
 * Auditing: every call writes an audit log row (PROVIDER_TEST_SUCCESS or
 * PROVIDER_TEST_FAILED) carrying provider, model, status, latencyMs.
 */
import { Hono } from "hono";
import { z } from "zod";
import { config } from "../../config.js";
import { auditLog } from "../../middleware/audit.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { logger } from "../../lib/logger.js";
import type { OmaEnv } from "../../types.js";

/** Maximum upstream call latency before we return 504 to the operator. 10s is
 *  chosen to align with our 10s health-check budget — if a provider cannot
 *  answer a 1-token request in 10s, it is not useful for production. */
const TEST_TIMEOUT_MS = 10_000;

/** Per-IP rate limit on top of the parent admin chain's 100/min. */
const TEST_RATE_LIMIT = { windowMs: 60_000, maxRequests: 30, keyPrefix: "rl:provider-test" };

/** Default test message. Kept short so even the largest context window leaves
 *  room for the response; admins can override via the `message` field. */
const DEFAULT_TEST_MESSAGE = "ping";

/** Per-provider descriptor. Each entry tells the route which env var carries
 *  the API key, which env var carries the base URL, and what default model to
 *  use when the admin does not override. `apiKeyOptional` lets P2P providers
 *  (AntSeed) work even when the key env var is unset. */
interface ProviderDescriptor {
  name: string;
  apiKeyEnv: string;
  baseUrlEnv: string;
  defaultModel: string;
  apiKeyOptional?: boolean;
  /** Optional override for the model when the operator did not pass one.
   *  Some providers don't have gpt-4o-mini. */
  defaultModelOverride?: string;
  /** Chat-completion path appended to the base URL. */
  chatPath: string;
}

const PROVIDERS: Record<string, ProviderDescriptor> = {
  venice: {
    name: "venice",
    apiKeyEnv: "VENICE_API_KEY",
    baseUrlEnv: "VENICE_API_URL",
    defaultModel: "gpt-4o-mini",
    defaultModelOverride: "llama-3.3-70b",
    chatPath: "/api/v1/chat/completions",
  },
  openrouter: {
    name: "openrouter",
    apiKeyEnv: "OPENROUTER_API_KEY",
    baseUrlEnv: "OPENROUTER_API_URL",
    defaultModel: "gpt-4o-mini",
    chatPath: "/api/v1/chat/completions",
  },
  together: {
    name: "together",
    apiKeyEnv: "TOGETHER_API_KEY",
    baseUrlEnv: "TOGETHER_API_URL",
    defaultModel: "gpt-4o-mini",
    defaultModelOverride: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    chatPath: "/v1/chat/completions",
  },
  deepinfra: {
    name: "deepinfra",
    apiKeyEnv: "DEEPINFRA_API_KEY",
    baseUrlEnv: "DEEPINFRA_API_URL",
    defaultModel: "gpt-4o-mini",
    defaultModelOverride: "meta-llama/Llama-3.3-70B-Instruct",
    chatPath: "/v1/openai/chat/completions",
  },
  morpheus: {
    name: "morpheus",
    apiKeyEnv: "MORPHEUS_API_KEY",
    baseUrlEnv: "MORPHEUS_BASE_URL",
    defaultModel: "gpt-4o-mini",
    defaultModelOverride: "llama-3.3-70b",
    chatPath: "/v1/chat/completions",
  },
  antseed: {
    name: "antseed",
    apiKeyEnv: "ANTSEED_API_KEY",
    baseUrlEnv: "ANTSEED_PROXY_URL",
    defaultModel: "gpt-4o-mini",
    apiKeyOptional: true, // P2P proxy may not require an API key
    chatPath: "/v1/chat/completions",
  },
  litellm: {
    name: "litellm",
    apiKeyEnv: "LITELLM_API_KEY",
    baseUrlEnv: "LITELLM_PROXY_URL",
    defaultModel: "gpt-4o-mini",
    apiKeyOptional: true,
    chatPath: "/v1/chat/completions",
  },
};

const testRequestSchema = z.object({
  model: z.string().min(1).max(256).optional(),
  message: z.string().min(1).max(2000).optional(),
});

function resolveEnv(envName: string): string | undefined {
  const value = (config as unknown as Record<string, unknown>)[envName];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pickSample(parsed: unknown): string {
  if (parsed && typeof parsed === "object" && "choices" in parsed) {
    const choices = (parsed as { choices?: unknown }).choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as { message?: { content?: unknown } } | undefined;
      const content = first?.message?.content;
      if (typeof content === "string") {
        return content.slice(0, 500);
      }
    }
  }
  return "";
}

export const providerTestRoutes = new Hono<OmaEnv>();

providerTestRoutes.post(
  "/admin/providers/:provider/test",
  rateLimit(TEST_RATE_LIMIT),
  async (c) => {
    const userId = c.get("userId") as string | undefined;
    const providerName = c.req.param("provider") ?? "";
    const descriptor = PROVIDERS[providerName];
    if (!descriptor) {
      return c.json(
        {
          error: {
            message: `Unknown provider '${providerName}'. Supported: ${Object.keys(PROVIDERS).join(", ")}`,
            type: "invalid_request_error",
          },
        },
        400,
      );
    }

    // Parse + validate body. We allow an empty body — both fields are optional.
    let body: z.infer<typeof testRequestSchema> = {};
    const rawBody = await c.req.text();
    if (rawBody.length > 0) {
      try {
        const json = JSON.parse(rawBody);
        const parsed = testRequestSchema.safeParse(json);
        if (!parsed.success) {
          return c.json(
            {
              error: {
                message: parsed.error.errors.map((e) => e.message).join("; "),
                type: "invalid_request_error",
              },
            },
            400,
          );
        }
        body = parsed.data;
      } catch {
        return c.json({ error: { message: "Request body must be valid JSON", type: "invalid_request_error" } }, 400);
      }
    }

    const model = body.model ?? descriptor.defaultModelOverride ?? descriptor.defaultModel;
    const message = body.message ?? DEFAULT_TEST_MESSAGE;

    // 503 — provider env key missing. We check BEFORE doing any I/O.
    const apiKey = resolveEnv(descriptor.apiKeyEnv);
    if (!apiKey && !descriptor.apiKeyOptional) {
      await auditLog({
        userId,
        action: "PROVIDER_TEST_FAILED",
        resource: "admin_provider_test",
        resourceId: providerName,
        metadata: { reason: "env_key_missing", apiKeyEnv: descriptor.apiKeyEnv, model },
        ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
        userAgent: c.req.header("user-agent") ?? undefined,
      });
      return c.json(
        {
          error: {
            message: `Provider '${providerName}' is not configured: env var ${descriptor.apiKeyEnv} is unset on this server.`,
            type: "service_unavailable",
            provider: providerName,
          },
        },
        503,
      );
    }

    const baseUrlRaw = resolveEnv(descriptor.baseUrlEnv);
    if (!baseUrlRaw) {
      await auditLog({
        userId,
        action: "PROVIDER_TEST_FAILED",
        resource: "admin_provider_test",
        resourceId: providerName,
        metadata: { reason: "base_url_missing", baseUrlEnv: descriptor.baseUrlEnv, model },
        ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
        userAgent: c.req.header("user-agent") ?? undefined,
      });
      return c.json(
        {
          error: {
            message: `Provider '${providerName}' has no base URL: env var ${descriptor.baseUrlEnv} is unset.`,
            type: "service_unavailable",
            provider: providerName,
          },
        },
        503,
      );
    }
    const baseUrl = baseUrlRaw.replace(/\/+$/, "");
    const url = `${baseUrl}${descriptor.chatPath}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const start = Date.now();
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: message }],
          max_tokens: 1,
          stream: false,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      });
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errorObj = err as { name?: string; message?: string };
      const isTimeout = errorObj.name === "TimeoutError" || errorObj.name === "AbortError";
      const message_ = err instanceof Error ? err.message : String(err);
      logger.warn(
        { err, provider: providerName, model, latencyMs, isTimeout },
        "admin.provider.test: upstream fetch failed",
      );
      await auditLog({
        userId,
        action: "PROVIDER_TEST_FAILED",
        resource: "admin_provider_test",
        resourceId: providerName,
        metadata: { reason: isTimeout ? "timeout" : "connection_error", model, latencyMs, error: message_ },
        ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
        userAgent: c.req.header("user-agent") ?? undefined,
      });
      return c.json(
        {
          error: {
            message: isTimeout
              ? `Upstream call to ${providerName} exceeded ${TEST_TIMEOUT_MS}ms timeout`
              : `Upstream call to ${providerName} failed: ${message_}`,
            type: isTimeout ? "upstream_timeout" : "upstream_error",
            provider: providerName,
            latencyMs,
          },
        },
        isTimeout ? 504 : 502,
      );
    }

    const latencyMs = Date.now() - start;
    const text = await response.text().catch(() => "");
    let parsed: unknown = null;
    try {
      parsed = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      // Non-JSON response (e.g. an HTML error page from a CDN). Treat as a 502.
      await auditLog({
        userId,
        action: "PROVIDER_TEST_FAILED",
        resource: "admin_provider_test",
        resourceId: providerName,
        metadata: { reason: "non_json_response", model, latencyMs, status: response.status, snippet: text.slice(0, 200) },
        ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
        userAgent: c.req.header("user-agent") ?? undefined,
      });
      return c.json(
        {
          error: {
            message: `Upstream returned non-JSON body (status ${response.status})`,
            type: "upstream_error",
            provider: providerName,
            status: response.status,
            latencyMs,
            snippet: text.slice(0, 200),
          },
        },
        502,
      );
    }

    if (!response.ok) {
      const errMsg =
        parsed && typeof parsed === "object" && "error" in parsed
          ? String((parsed as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`)
          : `HTTP ${response.status}`;
      await auditLog({
        userId,
        action: "PROVIDER_TEST_FAILED",
        resource: "admin_provider_test",
        resourceId: providerName,
        metadata: { reason: "upstream_non_2xx", model, latencyMs, status: response.status, error: errMsg },
        ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
        userAgent: c.req.header("user-agent") ?? undefined,
      });
      return c.json(
        {
          error: {
            message: `Upstream returned ${response.status}: ${errMsg}`,
            type: "upstream_error",
            provider: providerName,
            status: response.status,
            latencyMs,
          },
        },
        502,
      );
    }

    const sample = pickSample(parsed);
    await auditLog({
      userId,
      action: "PROVIDER_TEST_SUCCESS",
      resource: "admin_provider_test",
      resourceId: providerName,
      metadata: { model, latencyMs, status: response.status, hasSample: sample.length > 0 },
      ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
    });
    return c.json({
      provider: providerName,
      model,
      status: "ok" as const,
      upstreamStatus: response.status,
      latencyMs,
      sample,
      requestId: (parsed && typeof parsed === "object" && "id" in parsed && typeof (parsed as { id?: unknown }).id === "string")
        ? (parsed as { id: string }).id
        : undefined,
    });
  },
);

export { PROVIDERS as _PROVIDERS };
