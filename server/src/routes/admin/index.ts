/**
 * Admin routes — operator/owner surface.
 *
 * All endpoints require `requireAdmin()` except promote-self (dev bootstrap)
 * and GET /v1/site-settings (public). Domain handlers live in sibling modules.
 *
 * Pricing overrides: see pricing.ts (export getModelPricingOverride).
 */
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { requireAdmin, sessionAuth } from "../../auth/middleware.js";
import { db } from "../../db/client.js";
import { user } from "../../db/schema.js";
import { config } from "../../config.js";
import { auditLog } from "../../middleware/audit.js";
import { registerPricingRoutes, getModelPricingOverride } from "./pricing.js";
import { registerUsageRoutes } from "./usage.js";
import { registerUserRoutes } from "./users.js";
import { registerAuditRoutes } from "./audit.js";
import { registerHealthRoutes } from "./health.js";
import { registerPolarRoutes } from "./polar.js";
import { registerSettingsRoutes } from "./settings.js";

export { getModelPricingOverride };

export const adminRoutes = new Hono<OmaEnv>();

// `/v1/admin/promote-self` is the bootstrap for the very first admin in dev.
adminRoutes.post("/v1/admin/promote-self", sessionAuth, async (c) => {
	if (config.NODE_ENV === "production") {
		return c.json({ error: { message: "promote-self is dev-only" } }, 403);
	}
	const userId = c.get("userId");
	if (!userId) return c.json({ error: { message: "auth required" } }, 401);
	const [u] = await db
		.select({ role: user.role })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (u?.role === "admin") {
		return c.json({ ok: true, alreadyAdmin: true });
	}
	await db.update(user).set({ role: "admin", updatedAt: new Date() }).where(eq(user.id, userId));
	await auditLog({
		userId,
		action: "USER_UPDATED",
		resource: "user_role",
		resourceId: userId,
		metadata: { from: u?.role ?? null, to: "admin", method: "promote-self" },
	});
	return c.json({ ok: true, promoted: true });
});

// Gate all remaining /v1/admin/* routes. Public GET /v1/site-settings is
// outside this prefix and stays open when registered below.
adminRoutes.use("/v1/admin/*", sessionAuth, requireAdmin());

registerPricingRoutes(adminRoutes);
registerUsageRoutes(adminRoutes);
registerUserRoutes(adminRoutes);
registerAuditRoutes(adminRoutes);
registerHealthRoutes(adminRoutes);
registerPolarRoutes(adminRoutes);
registerSettingsRoutes(adminRoutes);
