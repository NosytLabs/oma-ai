import type { Context, Next } from "hono";
import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
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
  // Anonymous free-tier traffic uses the literal "anonymous" sentinel as
  // a userId. The audit_logs.user_id column has a FK to user.id, so we
  // cannot insert "anonymous" — silently skip the audit row for anon.
  // (The rate-limit middleware + Redis daily counter already cover anon.)
  if (params.userId === "anonymous" || !params.userId) {
    return;
  }
  try {
    await db.insert(auditLogs).values({
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata ?? null,
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
 * Middleware factory for write-operation audit logs with dynamic resourceId
 * and metadata resolved from the request context.
 */
export function auditWriteOp(
  action: AuditAction,
  resource: string,
  resourceIdFn: (c: Context) => string | undefined,
  metadataFn: (c: Context) => Record<string, unknown> | undefined,
) {
  return async (c: Context, next: Next) => {
    await next();
    const userId = c.get("userId") as string | undefined;
    const ipAddress = c.req.header("x-real-ip")
      ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";
    const userAgent = c.req.header("user-agent") ?? null;
    await auditLog({
      userId,
      action,
      resource,
      resourceId: resourceIdFn(c),
      metadata: metadataFn(c),
      ipAddress,
      userAgent: userAgent ?? undefined,
    });
  };
}


