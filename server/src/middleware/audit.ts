import type { Context, Next } from "hono";
import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";

export type AuditAction = typeof auditLogs.$inferInsert.action;

export interface AuditLogParams {
  userId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: randomUUID(),
      userId: params.userId ?? null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.error({ err, params }, "Failed to write audit log");
  }
}

/**
 * Middleware that logs an audit entry after the request completes.
 * Sets context: userId (from prior middleware), client IP, user-agent.
 */
export function createAuditLogger(params: { action: AuditAction; resource: string }) {
  return async (c: Context, next: Next) => {
    await next();
    const userId = c.get("userId") as string | undefined;
    const ipAddress = c.req.header("x-real-ip")
      ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";
    const userAgent = c.req.header("user-agent") ?? null;
    await auditLog({
      userId,
      action: params.action,
      resource: params.resource,
      resourceId: c.get("resourceId") as string | undefined,
      metadata: c.get("auditMetadata") as Record<string, unknown> | undefined,
      ipAddress,
      userAgent: userAgent ?? undefined,
    });
  };
}

/**
 * Convenience wrapper: sets resourceId and metadata from per-request
 * functions before delegating to createAuditLogger.
 */
export function auditWriteOp(
  action: AuditAction,
  resource: string,
  resourceIdFn: (c: Context) => string,
  metadataFn: (c: Context) => Record<string, unknown>,
) {
  const auditMiddleware = createAuditLogger({ action, resource });
  return async (c: Context, next: Next) => {
    c.set("resourceId", resourceIdFn(c));
    c.set("auditMetadata", metadataFn(c));
    await auditMiddleware(c, next);
  };
}

