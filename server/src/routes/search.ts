import { Hono, type Context, type Next } from "hono";
import crypto from "node:crypto";
import { bearerAuth } from "../auth/middleware.js";
import { searchWeb } from "../inference/tinyfish.js";
import { tokenBucket, modelRateLimit } from "../middleware/rate-limit.js";
import { spendLimit } from "../middleware/spend-limit.js";
import { getBalance, deductCredits } from "../credits/index.js";
import { createInsufficientCreditsPayReq } from "../credits/insufficient-credits.js";
import type { OmaEnv } from "../types.js";
import { trackApiKeySpend } from "../inference/handler-helpers.js";
import { FREE_GUEST_USER_ID } from "./chat/free-guest.js";

export const searchRoutes = new Hono<OmaEnv>();

const SEARCH_COST_CENTS = 1; // Basic cost for web search
/** Free guest searches: no credit deduction, still rate-limited. */
const GUEST_SEARCH_DAILY_SOFT_CAP = 30;

/**
 * Website chat needs web search without a key (pairs with free OMA-AI models).
 * Guests get a rate-limited free path; authenticated callers keep bearer auth.
 */
async function optionalSearchAuth(c: Context<OmaEnv>, next: Next) {
  const hasBearer = Boolean(c.req.header("Authorization"));
  const hasKeyCookie = /(?:^|;\s*)(?:__Host-)?oma_api_key=/.test(
    c.req.header("Cookie") || "",
  );
  if (!hasBearer && !hasKeyCookie) {
    c.set("userId", FREE_GUEST_USER_ID);
    return next();
  }
  return bearerAuth(c, next);
}

// Apply to both /v1/search and nested /v1/search/* (stream).
searchRoutes.use("/v1/search", optionalSearchAuth);
searchRoutes.use("/v1/search/*", optionalSearchAuth);
searchRoutes.use("/v1/search", tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }));
searchRoutes.use("/v1/search/*", tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }));
searchRoutes.use("/v1/search", modelRateLimit());
searchRoutes.use("/v1/search/*", modelRateLimit());
searchRoutes.use("/v1/search", spendLimit());
searchRoutes.use("/v1/search/*", spendLimit());

// ponytail: shared search handler — JSON and SSE differ only in response format.
async function executeSearch(c: Context<OmaEnv>, stream: boolean) {
  const query = c.req.query("query");
  if (!query) {
    return c.json({ error: { message: "query parameter required", type: "invalid_request_error" } }, 400);
  }

  const userId = c.get("userId") ?? FREE_GUEST_USER_ID;
  const apiKey = c.get("apiKey");
  const isGuest = userId === FREE_GUEST_USER_ID || !apiKey;

  if (!isGuest) {
    const bal = await getBalance(userId);
    if (Number(bal.balanceCents) <= 0) {
      return createInsufficientCreditsPayReq(c, SEARCH_COST_CENTS, 0);
    }
  }

  try {
    const results = await searchWeb(query);

    // SECURITY: Only deduct credits if search returned non-empty results.
    // Guests never pay — free website chat web search.
    const hasResults = Array.isArray(results.results) && results.results.length > 0;
    if (hasResults && !isGuest) {
      const requestId = crypto.randomUUID();
      await deductCredits(
        userId,
        SEARCH_COST_CENTS,
        0, // markup
        SEARCH_COST_CENTS, // total
        "tinyfish-search",
        "tinyfish" as const,
        apiKey?.id ?? "unknown",
        0,
        0,
        requestId
      );

      trackApiKeySpend(apiKey?.keyHash, SEARCH_COST_CENTS);
    }

    // Soft-cap hint for abuse review (header only; hard limit is tokenBucket).
    if (isGuest) {
      c.header("x-oma-guest-search", "1");
      c.header("x-oma-guest-search-soft-cap", String(GUEST_SEARCH_DAILY_SOFT_CAP));
    }

    if (stream) {
      const sseStream = new ReadableStream({
        async start(controller) {
          try {
            const encoder = new TextEncoder();
            for (let i = 0; i < results.results.length; i++) {
              const result = results.results[i];
              const data = JSON.stringify({
                type: "result",
                position: result.position,
                site_name: result.site_name,
                title: result.title,
                snippet: result.snippet,
                url: result.url,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch {
            try {
              const errData = JSON.stringify({ type: "error", message: "Stream error" });
              controller.enqueue(new TextEncoder().encode(`data: ${errData}\n\n`));
            } catch { /* enqueue may fail if controller already errored */ }
            try { controller.close(); } catch { /* already closed */ }
          }
        },
      });

      return new Response(sseStream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    return c.json({
      results: results.results,
      query: results.query,
      total_results: results.total_results,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      status === 503
        ? "Web search is not configured on this deployment"
        : "Search failed";
    return c.json(
      { error: { message, type: "search_error", code: status === 503 ? "search_unavailable" : "search_error" } },
      status as Parameters<typeof c.json>[1],
    );
  }
}

searchRoutes.get("/v1/search", (c) => executeSearch(c, false));
searchRoutes.get("/v1/search/stream", (c) => executeSearch(c, true));
