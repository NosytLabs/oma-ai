import { Hono } from "hono";
import { db } from "../db/client.js";
import { adminConfig, rateLimitOverrides } from "../db/schema.js";
import { eq, desc, count } from "drizzle-orm";
import { sessionAuth, requireAdmin } from "../auth/middleware.js";
import type { OmaEnv } from "../types.js";
import { z } from "zod";
import { logger } from "../lib/logger.js";

export const configRoutes = new Hono<OmaEnv>();

configRoutes.use("*", sessionAuth);
configRoutes.use("*", requireAdmin());

const feeConfigSchema = z.object({
  config: z.object({
    providers: z.record(z.object({
      markupPercent: z.number().min(5).max(200),
    })),
  }),
});

const rateLimitConfigSchema = z.object({
  config: z.object({
    tiers: z.record(z.object({
      rpm: z.number().min(1),
      tpm: z.number().min(100),
    })),
  }),
});

const rateLimitOverrideSchema = z.object({
  targetType: z.enum(["user", "api_key"]),
  targetId: z.string().uuid(),
  rpm: z.number().min(1).optional(),
  tpm: z.number().min(100).optional(),
  expiresAt: z.string().datetime().optional(),
});

configRoutes.get("/v1/admin/config/fees", async (c) => {
  try {
    const configs = await db.select().from(adminConfig).where(eq(adminConfig.key, "fee_config"));
    
    const defaultConfig = {
      providers: {
        venice: { markupPercent: 10 },
        openrouter: { markupPercent: 10 },
        together: { markupPercent: 10 },
        deepinfra: { markupPercent: 10 },
        litellm: { markupPercent: 10 },
        antseed: { markupPercent: 10 },
        tinyfish: { markupPercent: 10 },
      },
    };

    if (!configs.length) {
      return c.json({ config: defaultConfig });
    }

    const parsed = JSON.parse(configs[0].value);
    return c.json({ config: parsed });
  } catch (err) {
    logger.error({ err }, "Get fee config error:");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

configRoutes.put("/v1/admin/config/fees", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = feeConfigSchema.parse(body);

    const existing = await db.select().from(adminConfig).where(eq(adminConfig.key, "fee_config"));
    
    if (existing.length) {
      await db.update(adminConfig)
        .set({ value: JSON.stringify(parsed.config), updatedAt: new Date() })
        .where(eq(adminConfig.key, "fee_config"));
    } else {
      await db.insert(adminConfig).values({
        key: "fee_config",
        value: JSON.stringify(parsed.config),
      });
    }

    return c.json({ success: true, config: parsed.config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: { message: "Invalid config format", details: err.errors } }, 400);
    }
    logger.error({ err }, "Update fee config error:");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

configRoutes.get("/v1/admin/config/rate-limits", async (c) => {
  try {
    const configs = await db.select().from(adminConfig).where(eq(adminConfig.key, "rate_limit_config"));
    
    const defaultConfig = {
      tiers: {
        free: { rpm: 60, tpm: 10000 },
        basic: { rpm: 120, tpm: 50000 },
        pro: { rpm: 300, tpm: 200000 },
        enterprise: { rpm: 1000, tpm: 1000000 },
      },
    };

    if (!configs.length) {
      return c.json({ config: defaultConfig });
    }

    const parsed = JSON.parse(configs[0].value);
    return c.json({ config: parsed });
  } catch (err) {
    logger.error({ err }, "Get rate limit config error:");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

configRoutes.put("/v1/admin/config/rate-limits", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = rateLimitConfigSchema.parse(body);

    const existing = await db.select().from(adminConfig).where(eq(adminConfig.key, "rate_limit_config"));
    
    if (existing.length) {
      await db.update(adminConfig)
        .set({ value: JSON.stringify(parsed.config), updatedAt: new Date() })
        .where(eq(adminConfig.key, "rate_limit_config"));
    } else {
      await db.insert(adminConfig).values({
        key: "rate_limit_config",
        value: JSON.stringify(parsed.config),
      });
    }

    return c.json({ success: true, config: parsed.config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: { message: "Invalid config format", details: err.errors } }, 400);
    }
    logger.error({ err }, "Update rate limit config error:");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

configRoutes.get("/v1/admin/rate-limit-overrides", async (c) => {
  try {
    const page = Math.max(parseInt(c.req.query("page") || "1", 10), 1);
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;

    const overrides = await db.select({
      id: rateLimitOverrides.id,
      targetType: rateLimitOverrides.targetType,
      targetId: rateLimitOverrides.targetId,
      rpm: rateLimitOverrides.rpm,
      tpm: rateLimitOverrides.tpm,
      expiresAt: rateLimitOverrides.expiresAt,
      createdAt: rateLimitOverrides.createdAt,
    })
    .from(rateLimitOverrides)
    .orderBy(desc(rateLimitOverrides.createdAt))
    .limit(limit)
    .offset(offset);

    const totalResult = await db.select({ count: count() }).from(rateLimitOverrides);

    return c.json({
      overrides,
      pagination: {
        page,
        limit,
        total: totalResult[0]?.count || 0,
        pages: Math.ceil((totalResult[0]?.count || 0) / limit),
      },
    });
  } catch (err) {
    logger.error({ err }, "Get rate limit overrides error:");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

configRoutes.post("/v1/admin/rate-limit-overrides", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = rateLimitOverrideSchema.parse(body);

    const result = await db.insert(rateLimitOverrides).values({
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      rpm: parsed.rpm,
      tpm: parsed.tpm,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
    }).returning();

    return c.json({ success: true, override: result[0] }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: { message: "Invalid override format", details: err.errors } }, 400);
    }
    logger.error({ err }, "Create rate limit override error:");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

configRoutes.delete("/v1/admin/rate-limit-overrides/:id", async (c) => {
  const id = c.req.param("id");

  try {
    await db.delete(rateLimitOverrides).where(eq(rateLimitOverrides.id, id));
    return c.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Delete rate limit override error:");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});