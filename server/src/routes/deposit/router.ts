import { Hono } from "hono";
import { z } from "zod";
import { sessionAuth } from "../../auth/middleware.js";
import { routeDeposit } from "../../credits/deposit-router.js";
import type { OmaEnv } from "../../types.js";
import { validationError } from "../../lib/validation.js";

const depositRouteSchema = z.object({
  sourceChain: z.string().optional(),
  sourceToken: z.string().optional(),
  amount: z.coerce.number().positive().max(1_000_000),
});

export const depositRouter = new Hono<OmaEnv>();

depositRouter.post("/v1/deposit/route", sessionAuth, async (c) => {
  const parsed = depositRouteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { sourceChain, sourceToken, amount } = parsed.data;
  try {
    const route = routeDeposit(sourceChain ?? "ethereum", sourceToken ?? "USDC", String(amount));
    return c.json(route);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Routing failed: ${message}`, type: "routing_error" } }, 500);
  }
});