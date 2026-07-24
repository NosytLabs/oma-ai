import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";
import { sessionAuth, requireAdmin } from "../../auth/middleware.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { requireFreshTotp } from "../../auth/require-fresh-totp.js";
import { usersRoutes } from "./users.js";
import { usageRoutes } from "./usage.js";
import { revenueRoutes } from "./revenue.js";
import { keysRoutes } from "./keys.js";
import { invoicesRoutes } from "./invoices.js";
import { dlqRoutes } from "./dlq.js";
import { auditLogsRoutes } from "./audit-logs.js";
import { surplusRoutes } from "./surplus.js";
import { adminRefundRoutes } from "./refunds.js";

export const adminRoutes = new Hono<OmaEnv>();

adminRoutes.use("/admin/*", sessionAuth);
adminRoutes.use("/v1/admin/*", sessionAuth);
adminRoutes.use("/admin/*", requireAdmin());
adminRoutes.use("/v1/admin/*", requireAdmin());
adminRoutes.use("/admin/*", rateLimit({ windowMs: 60_000, maxRequests: 100 }));
adminRoutes.use("/v1/admin/*", rateLimit({ windowMs: 60_000, maxRequests: 100 }));

// H-ADMIN-1: TOTP step-up on the highest-blast-radius admin routes. Money
// movement (sweep, refund grant/deny) requires a fresh 2FA code in
// addition to a valid session. The middleware is opt-in — admins without 2FA
// enabled pass through unchanged. This blocks a stolen admin JWT from
// draining the treasury on its own.
// /admin/ledger/sweep is intentionally not implemented: the TOTP step-up
// middleware is registered ahead of any handler so that, if a future
// implementation lands, the money-movement guard is already in place. Until
// then, the handler below returns 501 with a clear message so admin clients
// get a useful error instead of falling through to the 404 handler.
adminRoutes.use("/admin/ledger/sweep", requireFreshTotp());
adminRoutes.use("/v1/admin/ledger/sweep", requireFreshTotp());
adminRoutes.all("/admin/ledger/sweep", (c) =>
  c.json({ error: { message: "Ledger sweep is not implemented", type: "not_implemented" } }, 501),
);
adminRoutes.all("/v1/admin/ledger/sweep", (c) =>
  c.json({ error: { message: "Ledger sweep is not implemented", type: "not_implemented" } }, 501),
);
adminRoutes.use("/admin/refunds/:id/grant", requireFreshTotp());
adminRoutes.use("/v1/admin/refunds/:id/grant", requireFreshTotp());
adminRoutes.use("/admin/refunds/:id/deny", requireFreshTotp());
adminRoutes.use("/v1/admin/refunds/:id/deny", requireFreshTotp());

adminRoutes.route("/", adminRefundRoutes);
adminRoutes.route("/", usersRoutes);
adminRoutes.route("/", usageRoutes);
adminRoutes.route("/", revenueRoutes);
adminRoutes.route("/", keysRoutes);
adminRoutes.route("/", invoicesRoutes);
adminRoutes.route("/", dlqRoutes);
adminRoutes.route("/", auditLogsRoutes);
adminRoutes.route("/", surplusRoutes);