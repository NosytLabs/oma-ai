import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";

export function requestTimeout(timeoutMs: number = 120_000) {
  return async (c: Context<OmaEnv>, next: Next) => {
    const timeoutId = setTimeout(() => {
      console.error(`[timeout] Request exceeded ${timeoutMs}ms: ${c.req.url}`);
      c.status(504);
      return c.json({ error: { message: "Request timeout", type: "timeout_error" } });
    }, timeoutMs);
    
    try {
      await next();
    } finally {
      clearTimeout(timeoutId);
    }
  };
}