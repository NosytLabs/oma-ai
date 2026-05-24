import { db } from "../db/client.js";
import { auditLogs } from "../db/schema.js";
import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { randomUUID } from "crypto";

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
    console.error("[audit] Failed to write audit log:", err);
  }
}

function getClientIp(c: Context<OmaEnv>): string {
  const xForwardedFor = c.req.header("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
    return ips.length > 0 ? ips[ips.length - 1] : "unknown";
  }
  return c.req.header("x-real-ip") || "unknown";
}

export function createAuditLogger(params: Omit<AuditLogParams, "ipAddress" | "userAgent">) {
  return async (c: Context<OmaEnv>, _next: Next) => {
    const userId = c.get("userId") as string | undefined;
    const ipAddress = getClientIp(c);
    const userAgent = c.req.header("user-agent") || undefined;

    await auditLog({
      ...params,
      userId: userId ?? params.userId,
      ipAddress,
      userAgent,
    });
    await _next();
  };
}

export function auditWriteOp(action: AuditAction, resource: string, getResourceId?: (c: Context<OmaEnv>) => string | undefined, metadataFn?: (c: Context<OmaEnv>) => Record<string, unknown> | undefined) {
  return async (c: Context<OmaEnv>, next: Next) => {
    const userId = c.get("userId") as string | undefined;
    const ipAddress = getClientIp(c);
    const userAgent = c.req.header("user-agent") || undefined;
    const resourceId = getResourceId ? getResourceId(c) : undefined;
    const metadata = metadataFn ? metadataFn(c) : undefined;

    await auditLog({
      userId,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      metadata,
    });

    await next();
  };
}