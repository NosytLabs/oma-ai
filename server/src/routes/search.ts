import { Hono } from "hono";
import { bearerAuth } from "../auth/middleware.js";
import { searchWeb } from "../inference/tinyfish.js";
import type { OmaEnv } from "../types.js";

export const searchRoutes = new Hono<OmaEnv>();

searchRoutes.use("/v1/search", bearerAuth);

searchRoutes.get("/v1/search", async (c) => {
  const query = c.req.query("query");
  if (!query) {
    return c.json({ error: { message: "query parameter required", type: "invalid_request_error" } }, 400);
  }

  try {
    const results = await searchWeb(query);
    return c.json({
      results: results.results,
      query: results.query,
      total_results: results.total_results,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return c.json({ error: { message: (err as Error).message, type: "search_error" } }, status as Parameters<typeof c.json>[1]);
  }
});

searchRoutes.get("/v1/search/stream", async (c) => {
  const query = c.req.query("query");
  if (!query) {
    return c.json({ error: { message: "query parameter required", type: "invalid_request_error" } }, 400);
  }

  try {
    const results = await searchWeb(query);

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
    return c.json({ error: { message: (err as Error).message, type: "search_error" } }, status as Parameters<typeof c.json>[1]);
  }
});