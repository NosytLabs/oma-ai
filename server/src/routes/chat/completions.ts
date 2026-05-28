import { Hono } from "hono";
import { chatCompletionsRouter } from "./chat-completions.js";
import type { OmaEnv } from "../../types.js";

/**
 * @deprecated Use /v1/chat/completions instead. This router exists only for
 * backward compatibility and delegates all requests to chat-completions.ts.
 * Idempotency middleware is applied via the delegated chat-completions router.
 */
export const completionsRouter = new Hono<OmaEnv>();

completionsRouter.all("/v1/completions", async (c) => {
  console.warn(
    "[deprecation] /v1/completions is deprecated. Use /v1/chat/completions instead.",
  );
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace("/v1/completions", "/v1/chat/completions");
  const newReq = new Request(url.toString(), {
    method: c.req.method,
    headers: new Headers(c.req.header()),
    body: c.req.raw.body,
  });
  return chatCompletionsRouter.fetch(newReq, c.env, c.executionCtx);
});
