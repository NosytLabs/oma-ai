import { Hono } from "hono";
import { sessionOrBearerAuth } from "../../auth/middleware.js";
import { getBalance } from "../../credits/index.js";
import { db } from "../../db/client.js";
import { usageRecords, deposits } from "../../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { checkCircuitBreaker } from "../../credits/price-guard.js";
import type { OmaEnv } from "../../types.js";
import { logger } from "../../lib/logger.js";

export const balanceRoutes = new Hono<OmaEnv>();

balanceRoutes.get("/v1/balance", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  const balance = await getBalance(userId);
  // Match dashboard BalanceResponse shape (frontend expects full object).
  return c.json({
    balanceCents: balance.balanceCents,
    totalDepositedCents: balance.totalDepositedCents,
    totalUsedCents: balance.totalUsedCents,
    lastActivityAt: balance.lastActivityAt,
  });
});

balanceRoutes.get("/v1/usage", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  const records = await db.select().from(usageRecords)
    .where(eq(usageRecords.userId, userId))
    .orderBy(desc(usageRecords.createdAt))
    .limit(100);
  return c.json({ usage: records });
});

balanceRoutes.get("/v1/circuit-breaker", sessionOrBearerAuth, async (c) => {
  try {
    const breaker = await checkCircuitBreaker();
    return c.json(breaker);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "oracle_error" } }, 502);
  }
});

balanceRoutes.get("/v1/deposit/status/:id", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  const depositId = c.req.param("id");
  if (!depositId) {
    return c.json({ error: { message: "Missing deposit id", type: "validation_error" } }, 400);
  }

  try {
    const rows = await db.select().from(deposits).where(
      and(eq(deposits.id, depositId), eq(deposits.userId, userId))
    ).limit(1);
    if (!rows.length) {
      return c.json({ error: { message: "Deposit not found", type: "not_found" } }, 404);
    }
    const deposit = rows[0];

    if (deposit.status === "completed" || deposit.status === "failed" || deposit.status === "refunded" || deposit.status === "expired") {
      return c.json({
        id: deposit.id,
        type: deposit.type,
        status: deposit.status,
        amountUsd: deposit.amountUsd,
        creditsIssued: deposit.creditsIssued,
        txHash: deposit.txHash,
      });
    }

    return c.json({
      id: deposit.id,
      type: deposit.type,
      status: deposit.status,
      amountUsd: deposit.amountUsd,
      creditsIssued: deposit.creditsIssued,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const errType = (err as { type?: string }).type ?? "server_error";
    logger.error({ err, depositId }, "[deposit] /v1/deposit/status error");
    return c.json({ error: { message: "An internal error occurred", type: errType } }, status as Parameters<typeof c.json>[1]);
  }
});

