/**
 * M6.4 — Admin / Refund Request routes.
 *
 * Operator-side refund flow. The user-side counterpart is
 * `server/src/routes/refunds.ts` (`POST /v1/refunds/request`) which
 * creates a row in the `refund_requests` table. The admin then
 * reviews the queue at /admin/refunds, and either:
 *
 *   - GRANT → `POST /v1/admin/refunds/:id/grant` — the row status
 *     flips to 'granted', a `decidedBy` + `decidedAt` audit pair is
 *     written, and the credits are debited back from the user's
 *     batch via the existing `refundCredits()` (credits/refunds.ts).
 *     The `deposits.status` is also flipped to 'refunded' so the
 *     original transaction is marked.
 *
 *   - DENY  → `POST /v1/admin/refunds/:id/deny` — the row status flips
 *     to 'denied', and the operator MUST pass a `notes` reason
 *     (>= 8 chars) which is stored in the audit log.
 *
 *   - LIST  → `GET /v1/admin/refunds?status=pending&limit=50` — paginated
 *     listing, default status='pending' (the operator's queue).
 *
 * Auth: inherited from `adminRoutes` (sessionAuth + requireAdmin + rate limit).
 * Double-grant prevention: grant/deny check that `row.status === 'pending'`
 * inside a SELECT ... FOR UPDATE transaction; second call returns 409.
 */
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db/client.js";
import { deposits, refundRequests } from "../../db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import { auditLog } from "../../middleware/audit.js";
import { logger } from "../../lib/logger.js";
import { refundCredits } from "../../credits/refunds.js";
import type { OmaEnv } from "../../types.js";

export const adminRefundRoutes = new Hono<OmaEnv>();

const grantSchema = z.object({
  notes: z.string().max(500).optional(),
});

const denySchema = z.object({
  notes: z.string().min(8, "denial notes must be at least 8 chars for audit").max(500),
});

/**
 * GET /v1/admin/refunds
 * List refund requests, paginated, filterable by status.
 * Default: status=pending (the operator's active queue).
 */
adminRefundRoutes.get("/admin/refunds", async (c) => {
  const status = c.req.query("status") || "pending";
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10), 0);

  if (!["pending", "granted", "denied"].includes(status)) {
    return c.json({
      error: { message: "status must be pending, granted, or denied", type: "invalid_request_error" },
    }, 400);
  }

  try {
    const rows = await db.select({
      id: refundRequests.id,
      userId: refundRequests.userId,
      depositId: refundRequests.depositId,
      amountCents: refundRequests.amountCents,
      reason: refundRequests.reason,
      status: refundRequests.status,
      notes: refundRequests.notes,
      decidedBy: refundRequests.decidedBy,
      decidedAt: refundRequests.decidedAt,
      createdAt: refundRequests.createdAt,
    })
    .from(refundRequests)
    .where(eq(refundRequests.status, status as "pending" | "granted" | "denied"))
    .orderBy(desc(refundRequests.createdAt))
    .limit(limit)
    .offset(offset);

    const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(refundRequests)
      .where(eq(refundRequests.status, status as "pending" | "granted" | "denied"));

    return c.json({
      status,
      refunds: rows,
      pagination: { limit, offset, total, hasMore: offset + rows.length < total },
    });
  } catch (err) {
    logger.error({ err }, "[admin/refunds] list failed");
    return c.json({ error: { message: "Internal server error", type: "internal_error" } }, 500);
  }
});

/**
 * POST /v1/admin/refunds/:id/grant
 * Grant a pending refund. Atomically:
 *   1. SELECT refund row FOR UPDATE; reject if not 'pending' (409)
 *   2. Flip refund row to 'granted' with decidedBy + decidedAt + notes
 *   3. Flip the linked deposit to 'refunded' (so it can't be refunded again)
 *   4. Call refundCredits() to debit the user's batch (best-effort: if
 *      user has no active batch, the deposit status is the source of
 *      truth and the row audit log captures the reason)
 *   5. Write an audit log row.
 */
adminRefundRoutes.post("/admin/refunds/:id/grant", async (c) => {
  const refundId = c.req.param("id");
  if (!refundId) {
    return c.json({ error: { message: "id required", type: "invalid_request_error" } }, 400);
  }

  const parsed = grantSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({
      error: { message: "Invalid request", type: "invalid_request_error", issues: parsed.error.flatten() },
    }, 400);
  }

  const adminId = c.get("userId") || "admin";
  const notes = parsed.data.notes ?? null;

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select()
        .from(refundRequests)
        .where(eq(refundRequests.id, refundId))
        .for("update");
      if (!row) {
        return { error: "not_found" as const };
      }
      if (row.status !== "pending") {
        return { error: "already_decided" as const, currentStatus: row.status };
      }

      await tx.update(refundRequests)
        .set({
          status: "granted",
          notes,
          decidedBy: adminId,
          decidedAt: new Date(),
        })
        .where(eq(refundRequests.id, refundId));

      // Mark the linked deposit as refunded (so the deposit can't be refunded twice)
      if (row.depositId) {
        await tx.update(deposits)
          .set({ status: "refunded" })
          .where(eq(deposits.id, row.depositId));
      }

      return {
        ok: true as const,
        userId: row.userId,
        amountCents: row.amountCents,
        depositId: row.depositId,
      };
    });

    if ("error" in result) {
      if (result.error === "not_found") {
        return c.json({ error: { message: "Refund request not found", type: "not_found" } }, 404);
      }
      return c.json({
        error: { message: `Refund already ${result.currentStatus}`, type: "already_decided" },
      }, 409);
    }

    // Best-effort credit debit (outside the transaction so a balance race
    // doesn't poison the grant). Logged in audit even if it fails.
    let creditDebitStatus: "debited" | "no_active_batch" | "error" = "debited";
    try {
      // We need a requestId; the deposit ID is the natural choice since
      // the refund is downstream of a real inference/deposit tx. If no
      // deposit is linked, we synthesize a unique placeholder.
      const requestId = result.depositId
        ? `refund-${result.depositId}`
        : `refund-${refundId}`;
      // The credit-refund call is no-op if user has no active batch
      // (the original request id guard returns early). The deposit.status
      // is the durable source of truth.
      await refundCredits(result.userId, String(result.amountCents), requestId);
    } catch (err) {
      creditDebitStatus = "error";
      logger.error({ err, refundId }, "[admin/refunds] credit debit failed (grant still recorded)");
    }

    await auditLog({
      action: "REFUND_GRANTED",
      resource: `refund:${refundId}`,
      userId: adminId,
      metadata: {
        targetUserId: result.userId,
        amountCents: result.amountCents,
        depositId: result.depositId,
        creditDebitStatus,
        notes,
      },
    });

    return c.json({
      ok: true,
      refundId,
      status: "granted",
      decidedBy: adminId,
      decidedAt: new Date().toISOString(),
      creditDebitStatus,
    });
  } catch (err) {
    logger.error({ err, refundId }, "[admin/refunds] grant failed");
    return c.json({ error: { message: "Internal server error", type: "internal_error" } }, 500);
  }
});

/**
 * POST /v1/admin/refunds/:id/deny
 * Deny a pending refund. Notes (>= 8 chars) required for audit.
 * Rejects if already decided (409).
 */
adminRefundRoutes.post("/admin/refunds/:id/deny", async (c) => {
  const refundId = c.req.param("id");
  if (!refundId) {
    return c.json({ error: { message: "id required", type: "invalid_request_error" } }, 400);
  }

  const parsed = denySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({
      error: { message: "Invalid request", type: "invalid_request_error", issues: parsed.error.flatten() },
    }, 400);
  }

  const adminId = c.get("userId") || "admin";
  const { notes } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select()
        .from(refundRequests)
        .where(eq(refundRequests.id, refundId))
        .for("update");
      if (!row) {
        return { error: "not_found" as const };
      }
      if (row.status !== "pending") {
        return { error: "already_decided" as const, currentStatus: row.status };
      }

      await tx.update(refundRequests)
        .set({
          status: "denied",
          notes,
          decidedBy: adminId,
          decidedAt: new Date(),
        })
        .where(eq(refundRequests.id, refundId));

      return { ok: true as const, userId: row.userId, amountCents: row.amountCents };
    });

    if ("error" in result) {
      if (result.error === "not_found") {
        return c.json({ error: { message: "Refund request not found", type: "not_found" } }, 404);
      }
      return c.json({
        error: { message: `Refund already ${result.currentStatus}`, type: "already_decided" },
      }, 409);
    }

    await auditLog({
      action: "REFUND_DENIED",
      resource: `refund:${refundId}`,
      userId: adminId,
      metadata: {
        targetUserId: result.userId,
        amountCents: result.amountCents,
        notes,
      },
    });

    return c.json({
      ok: true,
      refundId,
      status: "denied",
      decidedBy: adminId,
      decidedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err, refundId }, "[admin/refunds] deny failed");
    return c.json({ error: { message: "Internal server error", type: "internal_error" } }, 500);
  }
});
