import { Hono } from "hono";
import { bearerAuth } from "../../auth/middleware.js";
import { getBalance } from "../../credits/index.js";
import { db } from "../../db/client.js";
import { usageRecords, deposits } from "../../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { houdiniClient } from "../../credits/houdini-client.js";
import { checkCircuitBreaker } from "../../credits/price-guard.js";
import type { OmaEnv } from "../../types.js";
import { mapHoudiniStatus } from "./houdini.js";
import { completeHoudiniDeposit } from "../../credits/deposit.js";
import { logger } from "../../lib/logger.js";

export const balanceRoutes = new Hono<OmaEnv>();

balanceRoutes.get("/v1/balance", bearerAuth, async (c) => {
  const userId = c.get("userId");
  const balance = await getBalance(userId);
  return c.json({ balanceCents: balance.balanceCents });
});

balanceRoutes.get("/v1/usage", bearerAuth, async (c) => {
  const userId = c.get("userId");
  const records = await db.select().from(usageRecords)
    .where(eq(usageRecords.userId, userId))
    .orderBy(desc(usageRecords.createdAt))
    .limit(100);
  return c.json({ usage: records });
});

balanceRoutes.get("/v1/circuit-breaker", bearerAuth, async (c) => {
  try {
    const breaker = await checkCircuitBreaker();
    return c.json(breaker);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "oracle_error" } }, 502);
  }
});

balanceRoutes.get("/v1/deposit/status/:id", bearerAuth, async (c) => {
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

    if (deposit.type === "houdini_swap" && deposit.houdiniId) {
      try {
        const order = await houdiniClient.getDepositStatus(deposit.houdiniId);
        const mappedStatus = mapHoudiniStatus(order.status);
        if (mappedStatus !== deposit.status) {
          await db.update(deposits)
            .set({ status: mappedStatus })
            .where(eq(deposits.id, depositId!));
        }
        if (order.status === "FINISHED" && order.toAmount && !deposit.txHash) {
          await completeHoudiniDeposit(depositId!, Number(order.toAmount), order.transactionHash ?? "", deposit.userId);
        }
        return c.json({
          id: deposit.id,
          type: deposit.type,
          status: mappedStatus,
          houdiniStatus: order.status,
          amountUsd: deposit.amountUsd,
          creditsIssued: deposit.creditsIssued,
          fromAmount: order.fromAmount,
          toAmount: order.toAmount,
          txHash: deposit.txHash || order.transactionHash,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({
          id: deposit.id,
          type: deposit.type,
          status: deposit.status,
          amountUsd: deposit.amountUsd,
          creditsIssued: deposit.creditsIssued,
          pollError: message,
        });
      }
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

balanceRoutes.get("/v1/deposit/coins", async (c) => {
  try {
    const tokens = await houdiniClient.getTokens();
    return c.json({ tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "external_error" } }, 502);
  }
});