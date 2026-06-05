import { Hono } from "hono";
import crypto from "node:crypto";
import { bearerAuth } from "../auth/middleware.js";
import { searchWeb } from "../inference/tinyfish.js";
import { tokenBucket, modelRateLimit } from "../middleware/rate-limit.js";
import { spendLimit, trackSpend } from "../middleware/spend-limit.js";
import { getBalance, deductCredits } from "../credits/index.js";
import { createInsufficientCreditsPayReq } from "../credits/insufficient-credits.js";
import { logger } from "../lib/logger.js";
import type { OmaEnv } from "../types.js";

export const searchRoutes = new Hono<OmaEnv>();

const SEARCH_COST_CENTS = 1; // Basic cost for web search

searchRoutes.use("/v1/search", bearerAuth);
searchRoutes.use("/v1/search", tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }));
searchRoutes.use("/v1/search", modelRateLimit());
searchRoutes.use("/v1/search", spendLimit());

searchRoutes.use("/v1/search/stream", bearerAuth);
searchRoutes.use("/v1/search/stream", tokenBucket({ refillRate: 20, bucketSize: 60, rpmLimit: 60 }));
searchRoutes.use("/v1/search/stream", modelRateLimit());
searchRoutes.use("/v1/search/stream", spendLimit());

searchRoutes.get("/v1/search", async (c) => {
  const query = c.req.query("query");
  if (!query) {
    return c.json({ error: { message: "query parameter required", type: "invalid_request_error" } }, 400);
  }

  const userId = c.get("userId");
  const apiKey = c.get("apiKey");
  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    return createInsufficientCreditsPayReq(c, SEARCH_COST_CENTS, 0);
  }

  try {
    const results = await searchWeb(query);
    
    // Deduct credits and track spend
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

    if (apiKey) {
      trackSpend(apiKey.keyHash, SEARCH_COST_CENTS).catch(() => {});
    }

    return c.json({
      results: results.results,
      query: results.query,
      total_results: results.total_results,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    logger.error({ err }, "[search] /v1/search error:");
    return c.json({ error: { message: "Search failed", type: "search_error" } }, status as Parameters<typeof c.json>[1]);
  }
});

searchRoutes.get("/v1/search/stream", async (c) => {
  const query = c.req.query("query");
  if (!query) {
    return c.json({ error: { message: "query parameter required", type: "invalid_request_error" } }, 400);
  }

  const userId = c.get("userId");
  const apiKey = c.get("apiKey");
  const bal = await getBalance(userId);
  if (Number(bal.balanceCents) <= 0) {
    return createInsufficientCreditsPayReq(c, SEARCH_COST_CENTS, 0);
  }

  try {
    const results = await searchWeb(query);
    
    // Deduct credits and track spend
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

    if (apiKey) {
      trackSpend(apiKey.keyHash, SEARCH_COST_CENTS).catch(() => {});
    }

    const stream = new ReadableStream({
      async start(controller) {
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
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    logger.error({ err }, "[search] /v1/search/stream error:");
    return c.json({ error: { message: "Search failed", type: "search_error" } }, status as Parameters<typeof c.json>[1]);
  }
});