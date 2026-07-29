import { Hono } from "hono";
import { defineWebSocketHelper, type WSContext } from "hono/ws";
import { sessionAuth } from "../auth/middleware.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { db } from "../db/client.js";
import {
  auditLogs,
  rateLimitOverrides,
  apiKeys,
  signingKeys,
  deposits,
} from "../db/schema.js";
import { desc, eq, gte, and } from "drizzle-orm";
import { isProviderAvailable } from "../inference/provider-health.js";
import { ALL_PROVIDERS } from "../inference/provider-selector.js";
import { depositEvents, type DepositEvent } from "../lib/deposit-events.js";
import type { OmaEnv } from "../types.js";

export const networkRoutes = new Hono<OmaEnv>();
const authed = sessionAuth;

// 1. Audit event stream — SCOPED to the calling user. Previously returned
//    rows from all users incl. ipAddress/metadata (cross-user PII leak, S1).
//    ipAddress + metadata are now stripped; admin-wide view lives at the
//    admin-gated /v1/admin/audit-logs.
networkRoutes.get("/audit/events", authed, async (c) => {
  const limitRaw = Number(c.req.query("limit") ?? 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;
  const sinceRaw = c.req.query("since");
  const since = sinceRaw ? new Date(sinceRaw) : null;
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      userId: auditLogs.userId,
      action: auditLogs.action,
      resource: auditLogs.resource,
      resourceId: auditLogs.resourceId,
    })
    .from(auditLogs)
    .where(
      since && !Number.isNaN(since.getTime())
        ? and(eq(auditLogs.userId, userId), gte(auditLogs.createdAt, since))
        : eq(auditLogs.userId, userId)
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  return c.json({ events: rows, count: rows.length, since: since?.toISOString() ?? null });
});

// 2. Live rate-limit bucket inspection for a key prefix. SCOPED to the
//    caller's own keys — previously any authenticated user could look up any
//    key's owner/overrides/Redis bucket (cross-user key disclosure, S2).
//    Admin cross-user lookup lives at /v1/admin/keys.
networkRoutes.get("/rate-limits/:key", authed, async (c) => {
  const key = c.req.param("key") ?? "";
  const callerId = c.get("userId") as string | undefined;
  if (!callerId) {
    return c.json({ error: { message: "unauthorized", type: "authentication_error" } }, 401);
  }
  const ak = await db
    .select({ id: apiKeys.id, keyPrefix: apiKeys.keyPrefix, name: apiKeys.name, userId: apiKeys.userId })
    .from(apiKeys)
    .where(eq(apiKeys.keyPrefix, key))
    .limit(1);

  // Owner-scope: if the key exists but isn't the caller's, refuse. If the key
  // is unknown we return apiKey:null below (no disclosure either way).
  if (ak[0] && ak[0].userId !== callerId) {
    return c.json({ error: { message: "forbidden", type: "forbidden" } }, 403);
  }

  let overrides: { rpm: number | null; tpm: number | null; expiresAt: Date | null } | null = null;
  if (ak[0]) {
    const ov = await db
      .select({ rpm: rateLimitOverrides.rpm, tpm: rateLimitOverrides.tpm, expiresAt: rateLimitOverrides.expiresAt })
      .from(rateLimitOverrides)
      .where(and(eq(rateLimitOverrides.targetType, "api_key"), eq(rateLimitOverrides.targetId, ak[0].id)))
      .limit(1);
    overrides = ov[0] ?? null;
  }

  let live: { tokens: number; lastRefill: number } | null = null;
  if (isRedisReady()) {
    const redis = await getRedisClient();
    if (redis) {
      const h = (await redis.hMGet(`tb:${key}`, "tokens", "last_refill")) as (string | null)[] | null;
      if (h && h[0] !== null && h[0] !== undefined) {
        live = { tokens: Number(h[0]), lastRefill: Number(h[1] ?? "0") };
      }
    }
  }

  return c.json({
    key,
    apiKey: ak[0] ?? null,
    overrides,
    live,
    redisReady: isRedisReady(),
  });
});

// 3. Pin a user-scoped HMAC signing public key.
networkRoutes.post("/signing/pin", authed, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: { message: "unauthorized", type: "authentication_error" } }, 401);
  let body: { publicKey?: unknown; name?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "invalid JSON body", type: "validation_error" } }, 400);
  }
  const publicKey = body.publicKey;
  if (typeof publicKey !== "string" || publicKey.length === 0) {
    return c.json({ error: { message: "publicKey (string) is required", type: "validation_error" } }, 400);
  }
  const [row] = await db
    .insert(signingKeys)
    .values({ userId, publicKey, name: typeof body.name === "string" ? body.name : "default" })
    .returning();
  return c.json({ id: row.id, publicKey: row.publicKey, name: row.name, createdAt: row.createdAt }, 201);
});

// 4. Upstream provider health — COARSE public status. Previously exposed
//    per-provider circuit-breaker state + latency/error counts + cooldown
//    timestamps to any authenticated user (S4: infra internals leak).
//    The detailed view for operators lives at the admin-gated
//    /v1/admin/observability/* routes; this endpoint is the user-facing
//    "is inference up" check only.
networkRoutes.get("/upstream/health", authed, async (c) => {
  const providers: Record<string, string> = {};
  let allUp = true;
  for (const p of ALL_PROVIDERS) {
    const available = await isProviderAvailable(p);
    providers[p] = available ? "ok" : "unavailable";
    if (!available) allUp = false;
  }
  return c.json({
    status: allUp ? "ok" : "degraded",
    providers,
    checkedAt: new Date().toISOString(),
    count: ALL_PROVIDERS.length,
  });
});

// 5. Live deposit feed (WebSocket). Streams recent deposits on connect,
// then pushes real-time deposit-completed events for the authenticated user.
const depositFeed = defineWebSocketHelper(() => {});

networkRoutes.get(
  "/deposit/feed",
  authed,
  depositFeed((c) => {
    const userId = c.get("userId");
    let handler: ((dep: DepositEvent) => void) | null = null;
    return {
      onOpen: async (_evt: unknown, ws: WSContext) => {
        if (!userId) {
          ws.close();
          return;
        }
        try {
          const recent = await db
            .select({
              id: deposits.id,
              userId: deposits.userId,
              type: deposits.type,
              amountUsd: deposits.amountUsd,
              creditsIssued: deposits.creditsIssued,
              txHash: deposits.txHash,
              status: deposits.status,
              createdAt: deposits.createdAt,
              completedAt: deposits.completedAt,
            })
            .from(deposits)
            .where(eq(deposits.userId, userId))
            .orderBy(desc(deposits.createdAt))
            .limit(20);
          ws.send(JSON.stringify({ type: "history", deposits: recent }));

          handler = (dep: DepositEvent) => {
            if (dep.userId === userId) {
              ws.send(JSON.stringify({ type: "deposit.matched", deposit: dep }));
            }
          };
          depositEvents.on("deposit.matched", handler);
        } catch (err) {
          try {
            ws.send(JSON.stringify({ type: "error", message: String(err) }));
          } catch {
            /* socket already gone */
          }
        }
      },
      onClose: () => {
        if (handler) depositEvents.off("deposit.matched", handler);
      },
    };
  }),
);
