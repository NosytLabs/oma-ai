/**
 * M10.5 — Admin / Per-Provider Billing
 *
 * Operator-only cost rollup for a single upstream provider. Inspired by
 * new-api's `controller/channel-billing.go` (14KB) which exposes per-channel
 * (provider) revenue + request volume + markup revenue for the operator
 * console. We expose the same data shape but on a closed `[since, until]`
 * time window the caller specifies (default: last 7 days).
 *
 * Endpoint:
 *   GET /v1/admin/providers/:provider/usage?since=&until=
 *
 * Auth: sessionAuth + requireAdmin are mounted in the parent admin/index.ts
 * router, so we don't re-apply them here. The 30/min rate limit is also
 * mounted at the parent level.
 */
import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";
import { getProviderCostRollup } from "../../inference/usage-service.js";
import { logger } from "../../lib/logger.js";
import { rateLimit } from "../../middleware/rate-limit.js";

const VALID_PROVIDERS = new Set([
  "venice",
  "antseed",
  "litellm",
  "openrouter",
  "together",
  "deepinfra",
  "morpheus",
  "surplus",
  "tinyfish",
]);

export const providerUsageRoutes = new Hono<OmaEnv>();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// M10.5 — Stricter per-route rate limit (30/min) on top of the parent
// admin router's 100/min cap. The more restrictive bucket wins.
providerUsageRoutes.use("/v1/admin/providers/*", rateLimit({ windowMs: 60_000, maxRequests: 30 }));

function parseDate(value: string | undefined, fallback: Date, _label: string): Date | null {
  if (!value) return fallback;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return null;
  }
  return d;
}

providerUsageRoutes.get("/v1/admin/providers/:provider/usage", async (c) => {
  const provider = c.req.param("provider");
  if (!VALID_PROVIDERS.has(provider)) {
    return c.json(
      { error: { message: `Unknown provider: ${provider}`, type: "invalid_request_error", code: "invalid_provider" } },
      400
    );
  }

  const now = new Date();
  const defaultSince = new Date(now.getTime() - SEVEN_DAYS_MS);

  const since = parseDate(c.req.query("since"), defaultSince, "since");
  if (!since) {
    return c.json(
      { error: { message: "Invalid 'since' query parameter (must be ISO 8601)", type: "invalid_request_error" } },
      400
    );
  }
  const until = parseDate(c.req.query("until"), now, "until");
  if (!until) {
    return c.json(
      { error: { message: "Invalid 'until' query parameter (must be ISO 8601)", type: "invalid_request_error" } },
      400
    );
  }

  if (since.getTime() > until.getTime()) {
    return c.json(
      { error: { message: "'since' must be <= 'until'", type: "invalid_request_error" } },
      400
    );
  }

  try {
    const rollup = await getProviderCostRollup(provider, since, until);
    return c.json({
      provider,
      window: {
        since: since.toISOString(),
        until: until.toISOString(),
        days: Math.max(1, Math.ceil((until.getTime() - since.getTime()) / (24 * 60 * 60 * 1000))),
      },
      ...rollup,
    });
  } catch (err) {
    logger.error({ err, provider }, "[admin/provider-usage] rollup error:");
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
});
