import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { logger } from "../lib/logger.js";

export function requestTimeout(timeoutMs: number = 120_000) {
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
    }
  };
}
