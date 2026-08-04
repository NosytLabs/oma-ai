/**
 * Admin audit log — filterable + cursor-paginated.
 */
import type { Hono } from "hono";
import { desc, eq, gte, lt, and, or } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { db } from "../../db/client.js";
import { auditLogs } from "../../db/schema.js";
import { logger } from "../../lib/logger.js";

interface AuditCursor {
	ts: string;
	id: string;
}

function encodeAuditCursor(c: AuditCursor): string {
	return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

function decodeAuditCursor(raw: string): AuditCursor | null {
	try {
		const decoded = Buffer.from(raw, "base64url").toString("utf8");
		const parsed = JSON.parse(decoded) as Partial<AuditCursor>;
		if (typeof parsed.ts !== "string" || typeof parsed.id !== "string") {
			return null;
		}
		return { ts: parsed.ts, id: parsed.id };
	} catch {
		return null;
	}
}

export function registerAuditRoutes(app: Hono<OmaEnv>): void {
app.get("/v1/admin/audit", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? "100"), 500);
  const action = c.req.query("action")?.trim();
  const userId = c.req.query("userId")?.trim();
  const fromStr = c.req.query("from")?.trim();
  const toStr = c.req.query("to")?.trim();
  const cursorStr = c.req.query("cursor")?.trim();

  // Build dynamic WHERE clause from filters + cursor
  const filters = [];
  if (action) {
    filters.push(eq(auditLogs.action, action as typeof auditLogs.$inferInsert.action));
  }
  if (userId) {
    filters.push(eq(auditLogs.userId, userId));
  }
  if (fromStr) {
    const fromDate = new Date(fromStr);
    if (Number.isNaN(fromDate.getTime())) {
      return c.json(
        { error: { message: "Invalid 'from' timestamp" } },
        400,
      );
    }
    filters.push(gte(auditLogs.createdAt, fromDate));
  }
  if (toStr) {
    const toDate = new Date(toStr);
    if (Number.isNaN(toDate.getTime())) {
      return c.json(
        { error: { message: "Invalid 'to' timestamp" } },
        400,
      );
    }
    filters.push(lt(auditLogs.createdAt, toDate));
  }
  if (cursorStr) {
    const cursor = decodeAuditCursor(cursorStr);
    if (!cursor) {
      return c.json(
        { error: { message: "Invalid cursor" } },
        400,
      );
    }
    const cursorDate = new Date(cursor.ts);
    if (Number.isNaN(cursorDate.getTime())) {
      return c.json(
        { error: { message: "Invalid cursor timestamp" } },
        400,
      );
    }
    // strict-less-than to avoid duplicates on ties, with id as the
    // tiebreaker when timestamps match (keyset pagination).
    filters.push(
      or(
        lt(auditLogs.createdAt, cursorDate),
        and(
          eq(auditLogs.createdAt, cursorDate),
          lt(auditLogs.id, cursor.id),
        ),
      )!,
    );
  }

  try {
    let query = db.select().from(auditLogs).$dynamic();
    if (filters.length > 0) {
      query = query.where(and(...filters));
    }
    // Fetch limit+1 so we can detect whether there's a next page.
    const rows = await query
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1);

    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasNext && page.length > 0
        ? encodeAuditCursor({
            ts: page[page.length - 1].createdAt.toISOString(),
            id: page[page.length - 1].id,
          })
        : null;

    return c.json({
      data: page,
      count: page.length,
      nextCursor,
      filters: {
        action: action ?? null,
        userId: userId ?? null,
        from: fromStr ?? null,
        to: toStr ?? null,
        limit,
      },
    });
  } catch (err) {
    logger.error({ err }, "[admin/audit] failed");
    return c.json({ error: { message: "audit query failed" } }, 500);
  }
});

}
