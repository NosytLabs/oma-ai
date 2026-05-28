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

export const adminRoutes = new Hono<OmaEnv>();

adminRoutes.use("*", sessionAuth);
adminRoutes.use("*", requireAdmin());
adminRoutes.use("*", rateLimit({ windowMs: 60_000, maxRequests: 100 }));

adminRoutes.route("/", usersRoutes);
adminRoutes.route("/", usageRoutes);
adminRoutes.route("/", revenueRoutes);
adminRoutes.route("/", keysRoutes);
adminRoutes.route("/", invoicesRoutes);
adminRoutes.route("/", dlqRoutes);
adminRoutes.route("/", auditLogsRoutes);