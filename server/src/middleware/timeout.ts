import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { logger } from "../lib/logger.js";

export function requestTimeout(timeoutMs: number = 130_000) {
  return async (c: Context<OmaEnv>, next: Next) => {
    let timedOut = false;
    let resolveTimeout: (() => void) | null = null;
    const timeoutPromise = new Promise<void>((resolve) => {
      resolveTimeout = resolve;
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      resolveTimeout?.();
    }, timeoutMs);

    try {
      await Promise.race([next(), timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }

    if (timedOut && !c.finalized) {
      logger.warn({ timeoutMs, url: c.req.url }, "Request exceeded timeout");
      // Send 408 to the client. We RETURN the Response (not just call
      // c.json and fall through) so Hono short-circuits the middleware
      // chain: the downstream handler's pending promise is no longer
      // awaited, and our 408 is what reaches the wire.
      return c.json({ error: "Request timeout" }, 408);
    }
  };
}
