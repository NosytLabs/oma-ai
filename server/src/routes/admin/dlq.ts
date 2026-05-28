import { Hono } from "hono";
import { getSettlementDlqEntries, retrySettlementFromDlq, getSettlementDlqLength } from "../../lib/dlq.js";
import { processSettlementDLQ, retrySettlementById, getSettlementDlqStatus } from "../../lib/settlement-retry.js";
import type { OmaEnv } from "../../types.js";

export const dlqRoutes = new Hono<OmaEnv>();

dlqRoutes.get("/v1/admin/dlq/settlements", async (c) => {
  const page = Math.max(parseInt(c.req.query("page") || "1", 10), 1);
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = (page - 1) * limit;

  try {
    const entries = await getSettlementDlqEntries(offset, limit);
    const total = await getSettlementDlqLength();
    const status = await getSettlementDlqStatus();

    return c.json({
      entries: entries.map((e) => ({
        orderId: e.orderId,
        amount: e.amount,
        chain: e.chain,
        attempts: e.attempts,
        lastError: e.lastError,
        createdAt: e.createdAt,
        status: e.attempts >= 3 ? "permanently_failed" : "retryable",
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      summary: {
        total,
        retryable: status.retryable,
        permanentlyFailed: status.permanentlyFailed,
      },
    });
  } catch (err) {
    console.error("Admin settlement DLQ error:", err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

dlqRoutes.post("/v1/admin/dlq/settlements/:id/retry", async (c) => {
  const id = c.req.param("id");

  try {
    const result = await retrySettlementById(id);

    if (result.error && result.error === "Settlement not found in DLQ") {
      return c.json({ error: { message: "Settlement not found in DLQ", type: "not_found" } }, 404);
    }

    return c.json({
      orderId: result.orderId,
      success: result.success,
      attempts: result.attempts,
      error: result.error,
      permanentlyFailed: result.permanentlyFailed,
    });
  } catch (err) {
    console.error("Admin settlement retry error:", err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

dlqRoutes.post("/v1/admin/dlq/settlements/:id/discard", async (c) => {
  const id = c.req.param("id");

  try {
    const entries = await getSettlementDlqEntries(0, await getSettlementDlqLength());
    const entry = entries.find((e) => e.orderId === id);

    if (!entry) {
      return c.json({ error: { message: "Settlement not found in DLQ", type: "not_found" } }, 404);
    }

    await retrySettlementFromDlq();

    return c.json({
      orderId: id,
      discarded: true,
    });
  } catch (err) {
    console.error("Admin settlement discard error:", err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

dlqRoutes.post("/v1/admin/dlq/settlements/process", async (c) => {
  try {
    const results = await processSettlementDLQ();

    return c.json({
      processed: results.length,
      results: results.map((r) => ({
        orderId: r.orderId,
        success: r.success,
        attempts: r.attempts,
        error: r.error,
        permanentlyFailed: r.permanentlyFailed,
      })),
    });
  } catch (err) {
    console.error("Admin settlement DLQ process error:", err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});