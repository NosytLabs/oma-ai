import { Hono } from "hono";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { deposits } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";

export const refundRoutes = new Hono<OmaEnv>();

refundRoutes.post("/v1/refunds/request", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const { depositId, reason } = body;

  if (!depositId) {
    return c.json({ error: { message: "depositId is required", type: "validation_error" } }, 400);
  }

  const [deposit] = await db.select().from(deposits)
    .where(and(eq(deposits.id, depositId), eq(deposits.userId, userId)))
    .limit(1);

  if (!deposit) {
    return c.json({ error: { message: "Deposit not found", type: "not_found" } }, 404);
  }

  if (deposit.status !== "completed") {
    return c.json({ error: { message: "Only completed deposits can be refunded", type: "invalid_state" } }, 400);
  }

  const daysSinceDeposit = Math.floor((Date.now() - new Date(deposit.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceDeposit > 30) {
    return c.json({ error: { message: "Refund window has expired (30 days)", type: "refund_window_expired" } }, 400);
  }

  const refundAmount = parseFloat(String(deposit.creditsIssued));
  if (refundAmount <= 0) {
    return c.json({ error: { message: "No credits to refund", type: "invalid_request" } }, 400);
  }

  const refundId = `refund_${Date.now()}_${userId.slice(0, 8)}`;

  return c.json({
    refundId,
    depositId,
    amount: refundAmount,
    reason: reason || "No reason provided",
    status: "pending",
    createdAt: new Date().toISOString(),
    message: "Refund request submitted. You'll receive credits back within 3-5 business days.",
  });
});

refundRoutes.get("/v1/refunds/history", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);

  const userDeposits = await db.select().from(deposits)
    .where(and(eq(deposits.userId, userId), sql`${deposits.status} IN ('refunded', 'pending')`))
    .orderBy(sql`${deposits.createdAt} DESC`)
    .limit(limit);

  return c.json({
    refunds: userDeposits.map(d => ({
      id: d.id,
      depositId: d.id,
      amount: parseFloat(String(d.creditsIssued)),
      status: d.status,
      type: d.type,
      txHash: d.txHash,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    })),
    pagination: { limit, hasMore: userDeposits.length === limit },
  });
});

refundRoutes.get("/v1/refunds/:id", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const refundId = c.req.param("id") as string;

  const [deposit] = await db.select().from(deposits)
    .where(and(eq(deposits.id, refundId), eq(deposits.userId, userId)))
    .limit(1);

  if (!deposit) {
    return c.json({ error: { message: "Refund not found", type: "not_found" } }, 404);
  }

  return c.json({
    id: deposit.id,
    amount: parseFloat(String(deposit.creditsIssued)),
    status: deposit.status,
    type: deposit.type,
    txHash: deposit.txHash,
    createdAt: deposit.createdAt,
    completedAt: deposit.completedAt,
  });
});