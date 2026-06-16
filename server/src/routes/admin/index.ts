import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";
import { sessionAuth, requireAdmin } from "../../auth/middleware.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { usersRoutes } from "./users.js";
import { usageRoutes } from "./usage.js";
import { revenueRoutes } from "./revenue.js";
import { keysRoutes } from "./keys.js";
import { invoicesRoutes } from "./invoices.js";
import { dlqRoutes } from "./dlq.js";
import { auditLogsRoutes } from "./audit-logs.js";
import { byokRoutes } from "./byok.js";
import { surplusRoutes } from "./surplus.js";
import { adminRefundRoutes } from "./refunds.js";

export const adminRoutes = new Hono<OmaEnv>();

adminRoutes.use("/admin/*", sessionAuth);
adminRoutes.use("/v1/admin/*", sessionAuth);
adminRoutes.use("/admin/*", requireAdmin());
adminRoutes.use("/v1/admin/*", requireAdmin());
adminRoutes.use("/admin/*", rateLimit({ windowMs: 60_000, maxRequests: 100 }));
adminRoutes.use("/v1/admin/*", rateLimit({ windowMs: 60_000, maxRequests: 100 }));

adminRoutes.route("/", adminRefundRoutes);
adminRoutes.route("/", usersRoutes);
adminRoutes.route("/", usageRoutes);
adminRoutes.route("/", revenueRoutes);
adminRoutes.route("/", keysRoutes);
adminRoutes.route("/", invoicesRoutes);
adminRoutes.route("/", dlqRoutes);
adminRoutes.route("/", auditLogsRoutes);
adminRoutes.route("/", byokRoutes);
adminRoutes.route("/", surplusRoutes);