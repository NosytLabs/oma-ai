/**
 * Admin Polar management — refunds, payments, customers, checkouts, products.
 */
import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { OmaEnv } from "../../types.js";
import { db } from "../../db/client.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";
import { polarApiBaseUrl } from "../../lib/polar-config.js";
import { auditLog } from "../../middleware/audit.js";
import { drainCreditsForRefund } from "./admin-controls.js";

function polarHeaders() {
	return {
		Authorization: `Bearer ${config.POLAR_ACCESS_TOKEN}`,
		"Content-Type": "application/json",
	};
}

export function registerPolarRoutes(app: Hono<OmaEnv>): void {
const refundSchema = z.object({
  paymentId: z.string().trim().min(1).max(200),
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
  // Optional: pin refund to a specific user. If omitted we look up by
  // Polar metadata.external_customer_id (the user's id / wallet).
  userId: z.string().trim().optional(),
});

app.post("/v1/admin/polar/refund", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured", type: "not_configured" } }, 400);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = refundSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: "Invalid refund payload",
          type: "invalid_request",
          issues: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const adminId = c.get("userId");
  if (!adminId) {
    return c.json({ error: { message: "auth required", type: "authentication_error" } }, 401);
  }

  const { paymentId, amountCents, reason, userId: pinnedUserId } = parsed.data;

  // 1. Issue the Polar refund via SDK if available; fall back to REST so
  //    this works even if the SDK types drift from the live Polar API.
  let polarRefundId: string | null = null;
  try {
    const { Polar } = await import("@polar-sh/sdk");
    const polar = new Polar({
      accessToken: config.POLAR_ACCESS_TOKEN!,
      server: config.POLAR_SERVER,
    });
    const refund = await polar.refunds.create({
      orderId: paymentId,
      amount: amountCents,
      reason: "customer_request",
      comment: reason,
      revokeBenefits: false,
    });
    polarRefundId = (refund as { id?: string }).id ?? null;
  } catch (sdkErr) {
    // SDK path failed — fall back to REST. Polar expects `order_id` for
    // refunds. The amount is in cents (matching the SDK call).
    try {
      const r = await fetch(`${polarApiBaseUrl(config.POLAR_SERVER)}/v1/refunds`, {
        method: "POST",
        headers: polarHeaders(),
        body: JSON.stringify({
          order_id: paymentId,
          amount: amountCents,
          reason: "customer_request",
          comment: reason,
          revoke_benefits: false,
        }),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        logger.error(
          { err: sdkErr, status: r.status, detail, paymentId },
          "[admin/polar/refund] Polar SDK + REST both failed",
        );
        return c.json(
          {
            error: {
              message: `Polar refund failed: ${r.status} ${detail}`,
              type: "service_unavailable",
            },
          },
          r.status as ContentfulStatusCode,
        );
      }
      const polarResp = (await r.json()) as { id?: string };
      polarRefundId = polarResp.id ?? null;
    } catch (restErr) {
      logger.error(
        { err: restErr, paymentId },
        "[admin/polar/refund] REST fallback also failed",
      );
      return c.json(
        { error: { message: "Polar refund request failed", type: "service_unavailable" } },
        502,
      );
    }
  }

  // 2. Drain credits from the user's balance. If pinnedUserId was
  //    supplied use that; otherwise resolve via Polar's payment metadata
  //    (REST GET /v1/payments/:id). If we cannot resolve a user we still
  //    succeed (refund went through) but log + return a warning.
  let resolvedUserId: string | null = pinnedUserId ?? null;
  if (!resolvedUserId) {
    try {
      const r = await fetch(
        `${polarApiBaseUrl(config.POLAR_SERVER)}/v1/payments/${encodeURIComponent(paymentId)}`,
        { headers: polarHeaders() },
      );
      if (r.ok) {
        const data = (await r.json()) as {
          metadata?: { user_id?: string; userId?: string };
          customer_id?: string;
        };
        const metaUserId = data.metadata?.user_id ?? data.metadata?.userId;
        if (metaUserId) resolvedUserId = metaUserId;
      }
    } catch (err) {
      logger.warn({ err, paymentId }, "[admin/polar/refund] could not resolve user from Polar metadata");
    }
  }

  let drainedUserId: string | null = null;
  let drainedBalanceCents: number | null = null;
  if (resolvedUserId) {
    // Delegate the SQL to the shared helper so the math is unit-testable.
    const drainResult = await drainCreditsForRefund(
      db,
      resolvedUserId,
      amountCents,
    );
    drainedUserId = drainResult.userId;
    drainedBalanceCents = drainResult.balanceCents;
  }

  // 3. Audit
  await auditLog({
    userId: adminId,
    action: "REFUND_ISSUED",
    resource: "polar_refund",
    resourceId: paymentId,
    metadata: {
      reason,
      amountCents,
      polarRefundId,
      drainedUserId,
      drainedBalanceCents,
      source: "admin/polar/refund",
    },
  });

  return c.json({
    success: true,
    polarRefundId,
    paymentId,
    amountCents,
    reason,
    drainedUserId,
    drainedBalanceCents,
    warning: drainedUserId
      ? null
      : "refund issued but could not resolve user — credits not drained",
  });
});

// GET /v1/admin/polar/payments — list recent payments
app.get("/v1/admin/polar/payments", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured", type: "not_configured" } }, 400);
  }
  const searchParams = new URLSearchParams();
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  searchParams.set("limit", String(Math.min(limit, 100)));
  searchParams.set("offset", String(offset));
  const sort = c.req.query("sort");
  if (sort) searchParams.set("sort", sort);
  try {
    const r = await fetch(`${polarApiBaseUrl(config.POLAR_SERVER)}/v1/payments?${searchParams.toString()}`, {
      headers: polarHeaders(),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}`, type: "service_unavailable" } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err), type: "server_error" } }, 500);
  }
});

// GET /v1/admin/polar/customers — list customers
app.get("/v1/admin/polar/customers", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured", type: "not_configured" } }, 400);
  }
  const searchParams = new URLSearchParams();
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  searchParams.set("limit", String(Math.min(limit, 100)));
  searchParams.set("offset", String(offset));
  try {
    const r = await fetch(`${polarApiBaseUrl(config.POLAR_SERVER)}/v1/customers?${searchParams.toString()}`, {
      headers: polarHeaders(),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}`, type: "service_unavailable" } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err), type: "server_error" } }, 500);
  }
});

// POST /v1/admin/polar/checkouts — create a checkout link
app.post("/v1/admin/polar/checkouts", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured", type: "not_configured" } }, 400);
  }
  const body = await c.req.json();
  const { productId, customerEmail, customerName, successUrl, cancelUrl } = body as {
    productId: string;
    customerEmail?: string;
    customerName?: string;
    successUrl?: string;
    cancelUrl?: string;
  };
  if (!productId) {
    return c.json({ error: { message: "productId is required", type: "invalid_request" } }, 400);
  }
  const payload: Record<string, unknown> = { productId };
  if (customerEmail) payload.customerEmail = customerEmail;
  if (customerName) payload.customerName = customerName;
  if (successUrl) payload.successUrl = successUrl;
  if (cancelUrl) payload.cancelUrl = cancelUrl;
  try {
    const r = await fetch(`${polarApiBaseUrl(config.POLAR_SERVER)}/v1/checkouts`, {
      method: "POST",
      headers: polarHeaders(),
      body: JSON.stringify(payload),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}`, type: "service_unavailable" } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err), type: "server_error" } }, 500);
  }
});

// GET /v1/admin/polar/products — list products
app.get("/v1/admin/polar/products", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured", type: "not_configured" } }, 400);
  }
  const searchParams = new URLSearchParams();
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  searchParams.set("limit", String(Math.min(limit, 100)));
  searchParams.set("offset", String(offset));
  try {
    const r = await fetch(`${polarApiBaseUrl(config.POLAR_SERVER)}/v1/products?${searchParams.toString()}`, {
      headers: polarHeaders(),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}`, type: "service_unavailable" } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err), type: "server_error" } }, 500);
  }
});

// GET /v1/admin/polar/subscriptions — list subscriptions
app.get("/v1/admin/polar/subscriptions", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured", type: "not_configured" } }, 400);
  }
  const searchParams = new URLSearchParams();
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  searchParams.set("limit", String(Math.min(limit, 100)));
  searchParams.set("offset", String(offset));
  try {
    const r = await fetch(`${polarApiBaseUrl(config.POLAR_SERVER)}/v1/subscriptions?${searchParams.toString()}`, {
      headers: polarHeaders(),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}`, type: "service_unavailable" } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err), type: "server_error" } }, 500);
  }
});

}
