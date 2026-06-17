import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db/client.js";
import { auditLogs } from "../../db/schema.js";
import { eq, desc, count, and, gte, lte } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { logger } from "../../lib/logger.js";

const limitSchema = z.coerce.number().int().positive().max(100).default(50);
const dateSchema = z.string().refine((d) => !isNaN(Date.parse(d)), { message: "Invalid date format" }).optional();

export const auditLogsRoutes = new Hono<OmaEnv>();

auditLogsRoutes.get("/v1/admin/audit-logs", async (c) => {
  const limitResult = limitSchema.safeParse(c.req.query("limit") || "50");
  const limit = limitResult.success ? limitResult.data : 50;
  const offsetResult = z.coerce.number().int().nonnegative().default(0).safeParse(c.req.query("offset") || "0");
  const offset = offsetResult.success ? offsetResult.data : 0;
  const userIdFilter = c.req.query("userId");
  const actionFilter = c.req.query("action");
  const resourceFilter = c.req.query("resource");
  const startDateResult = dateSchema.safeParse(c.req.query("startDate"));
  const startDate = startDateResult.success ? startDateResult.data : undefined;
  const endDateResult = dateSchema.safeParse(c.req.query("endDate"));
  const endDate = endDateResult.success ? endDateResult.data : undefined;

  try {
    const conditions = [];

    if (userIdFilter) {
      conditions.push(eq(auditLogs.userId, userIdFilter));
    }
    if (actionFilter) {
      conditions.push(eq(auditLogs.action, actionFilter as typeof auditLogs.$inferSelect.action));
    }
    if (resourceFilter) {
      conditions.push(eq(auditLogs.resource, resourceFilter));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logsResult = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);

    const logsWithParsedMetadata = logsResult.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    return c.json({
      logs: logsWithParsedMetadata,
      pagination: {
        limit,
        offset,
        total: Number(totalResult[0]?.count || 0),
      },
    });
  } catch (err) {
    logger.error({ err }, "Admin audit logs error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});