/**
 * Public site-settings + admin settings toggles.
 */
import type { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { db } from "../../db/client.js";
import { siteSettings } from "../../db/schema.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";
import { auditLog } from "../../middleware/audit.js";

export function registerSettingsRoutes(app: Hono<OmaEnv>): void {
app.get("/v1/site-settings", async (c) => {
  const usdcDepositConfigured = Boolean(config.USDC_DEPOSIT_ADDRESS);
  const polarConfigured = Boolean(
    config.POLAR_ACCESS_TOKEN &&
      (config.POLAR_HOBBY_PRODUCT_ID ||
        config.POLAR_BUILDER_PRODUCT_ID ||
        config.POLAR_SCALE_PRODUCT_ID),
  );
  try {
    let [settings] = await db.select().from(siteSettings).limit(1);
    if (!settings) {
      [settings] = await db
        .insert(siteSettings)
        .values({ id: "default" })
        .returning();
    }
    return c.json({
      maintenanceMode: settings.maintenanceMode,
      cardPaymentsEnabled: settings.cardPaymentsEnabled,
      cryptoPaymentsEnabled: settings.cryptoPaymentsEnabled,
      usdcDepositConfigured,
      polarConfigured,
    });
  } catch (err) {
    logger.error({ err }, "[settings] failed to fetch site settings");
    return c.json({
      maintenanceMode: false,
      cardPaymentsEnabled: true,
      cryptoPaymentsEnabled: true,
      usdcDepositConfigured,
      polarConfigured,
    });
  }
});

// GET /v1/admin/settings (admin-protected)
app.get("/v1/admin/settings", async (c) => {
  let [settings] = await db.select().from(siteSettings).limit(1);
  if (!settings) {
    [settings] = await db
      .insert(siteSettings)
      .values({ id: "default" })
      .returning();
  }
  return c.json(settings);
});

const patchSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  cardPaymentsEnabled: z.boolean().optional(),
  cryptoPaymentsEnabled: z.boolean().optional(),
});

// PATCH /v1/admin/settings (admin-protected)
app.patch("/v1/admin/settings", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = patchSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: "Invalid settings payload",
          issues: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  let [settings] = await db.select().from(siteSettings).limit(1);
  if (!settings) {
    [settings] = await db
      .insert(siteSettings)
      .values({ id: "default" })
      .returning();
  }

  const before = { ...settings };
  const updateData: Partial<typeof settings> = {
    updatedAt: new Date(),
  };
  if (parsed.data.maintenanceMode !== undefined) {
    updateData.maintenanceMode = parsed.data.maintenanceMode;
  }
  if (parsed.data.cardPaymentsEnabled !== undefined) {
    updateData.cardPaymentsEnabled = parsed.data.cardPaymentsEnabled;
  }
  if (parsed.data.cryptoPaymentsEnabled !== undefined) {
    updateData.cryptoPaymentsEnabled = parsed.data.cryptoPaymentsEnabled;
  }

  const [updated] = await db
    .update(siteSettings)
    .set(updateData)
    .where(eq(siteSettings.id, "default"))
    .returning();

  const userId = c.get("userId");
	if (userId) {
		await auditLog({
			userId,
			action: "USER_UPDATED",
			resource: "site_settings",
			resourceId: "default",
			metadata: { before, after: updated },
		});
	}

  return c.json({ success: true, settings: updated });
});

}
