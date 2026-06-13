import { Hono } from "hono";
import { surplusListModels, surplusHealthCheck } from "../../inference/surplus.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";
import type { OmaEnv } from "../../types.js";

export const surplusRoutes = new Hono<OmaEnv>();

surplusRoutes.get("/admin/surplus/models", async (c) => {
  try {
    const response = await surplusListModels();
    return c.json(response);
  } catch (err) {
    logger.error({ error: (err as Error).message }, "[surplus] list models error");
    const status = (err as { status?: number }).status ?? 502;
    return c.json({ error: { message: (err as Error).message || "Failed to fetch Surplus models" } }, status as 400 | 401 | 403 | 404 | 500 | 502);
  }
});

surplusRoutes.get("/admin/surplus/health", async (c) => {
  try {
    const result = await surplusHealthCheck();
    return c.json(result);
  } catch (err) {
    logger.error({ error: (err as Error).message }, "[surplus] health check error");
    return c.json({ isUp: false, error: (err as Error).message }, 502);
  }
});

// Expose the operator-facing Surplus config (min-discount floor +
// contract addresses + default scheme) so dashboards can show what is
// currently in effect. The min-discount value is read from the
// SURPLUS_MIN_DISCOUNT_PCT env var on boot and re-read on every
// request, so updating the env var + rolling the server is the
// supported way to change the floor.
surplusRoutes.get("/admin/surplus/config", async (c) => {
  return c.json({
    minDiscountPct: config.SURPLUS_MIN_DISCOUNT_PCT,
    defaultScheme: config.SURPLUS_DEFAULT_SCHEME,
    settlementContract: config.SURPLUS_SETTLEMENT_CONTRACT,
    permit2Contract: config.SURPLUS_PERMIT2_CONTRACT,
    usdcContract: config.SURPLUS_USDC_CONTRACT,
    chainId: config.SURPLUS_CHAIN_ID,
    legacyVerifierContract: config.SURPLUS_VERIFIER_CONTRACT ?? null,
  });
});
