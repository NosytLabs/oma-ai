import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { db } from "../db/client.js";
import { user, usageRecords, auditLogs } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { auditLog } from "../middleware/audit.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { sessionAuth } from "../auth/middleware.js";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  createApiKeyCookieHeader,
  createLogoutCookieHeader,
} from "../auth/api-keys.js";
import { auth } from "../auth.js";
import type { OmaEnv } from "../types.js";

export const authRoutes = new Hono<OmaEnv>();

// ─── Session helpers ──────────────────────────────────────────────────────────

/** Pull the Better Auth session from request headers (Hono → fetch). */
async function getSession(c: Context) {
  const headers = new Headers();
  for (const [k, v] of c.req.raw.headers) headers.set(k, v);
  return auth.api.getSession({ headers });
}

// ============================================================
// /user — current user lookup (Better Auth session).
// ============================================================
authRoutes.get("/user", async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json(
      { error: { message: "Unauthorized", type: "authentication_error" } },
      401,
    );
  }
  return c.json({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    evmAddress: session.user.evmAddress ?? null,
    isAnonymous: session.user.isAnonymous ?? false,
    createdAt: session.user.createdAt,
  });
});

// ============================================================
// /account — delete the account (Better Auth).
// ============================================================
authRoutes.delete("/account", async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json(
      { error: { message: "Unauthorized", type: "authentication_error" } },
      401,
    );
  }
  const userId = session.user.id;
  await db.delete(user).where(eq(user.id, userId));
  await auditLog({
    userId,
    action: "USER_DELETED",
    resource: "users",
    resourceId: userId,
  });
  return c.json({ success: true });
});

// ============================================================
// /v1/keys — API key CRUD.
// Used by the dashboard to mint a key for browser-direct SSE chat
// (Authorization: Bearer oma_sk_… or HttpOnly oma_api_key cookie).
// All endpoints require a Better Auth session.
// ============================================================
const createKeySchema = z.object({
  name: z.string().min(1).max(64).default("default"),
});

// GET /v1/keys — list active keys for the current user.
authRoutes.get("/v1/keys", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const rows = await listApiKeys(userId, false);
  return c.json({
    keys: rows.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.keyPrefix,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    })),
  });
});

// POST /v1/keys — mint a new key. Returns the raw key ONCE.
authRoutes.post(
  "/v1/keys",
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  sessionAuth,
  async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: "Invalid request",
            type: "invalid_request_error",
            issues: parsed.error.flatten(),
          },
        },
        400,
      );
    }
    const result = await createApiKey(userId, parsed.data.name);
    await auditLog({
      userId,
      action: "API_KEY_CREATED",
      resource: "api_keys",
      resourceId: result.id,
      metadata: { name: result.name },
    });
    return c.json({
      id: result.id,
      name: result.name,
      prefix: result.prefix,
      createdAt: result.createdAt.toISOString(),
      key: result.rawKey,
    });
  },
);

// DELETE /v1/keys/:id — revoke a key.
authRoutes.delete("/v1/keys/:id", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  if (!id) {
    return c.json(
      { error: { message: "Missing key id", type: "invalid_request_error" } },
      400,
    );
  }
  const revoked = await revokeApiKey(userId, id);
  if (!revoked) {
    return c.json(
      { error: { message: "API key not found", type: "not_found" } },
      404,
    );
  }
  await auditLog({
    userId,
    action: "API_KEY_REVOKED",
    resource: "api_keys",
    resourceId: id,
  });
  return c.json({ success: true, id });
});

// ============================================================
// /v1/history — wipe usage history + audit trail WITHOUT deleting
// the account. GDPR "right to forget" for telemetry while the
// user's balance, API keys, and identity stay intact.
// ============================================================
authRoutes.delete("/v1/history", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const [usage, audit] = await Promise.all([
    db.delete(usageRecords).where(eq(usageRecords.userId, userId)),
    db.delete(auditLogs).where(eq(auditLogs.userId, userId)),
  ]);
  // Write ONE fresh audit row so moderators can still see the wipe
  // happened (the previous trail is intentionally gone).
  await auditLog({
    userId,
    action: "USER_UPDATED",
    resource: "history",
    resourceId: userId,
    metadata: { action: "wipe_history" },
  });
  return c.json({
    success: true,
    deleted: {
      usageRecords: usage.rowCount ?? 0,
      auditLogs: audit.rowCount ?? 0,
    },
  });
});

// ============================================================
// POST /v1/keys/install — install the given raw key as an HttpOnly
// cookie on the current response. Used by the dashboard after minting
// a key, so the browser's SSE chat can authenticate against the Hono
// backend directly without re-issuing the key as an Authorization header.
authRoutes.post(
  "/v1/keys/install",
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  sessionAuth,
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ key: z.string().min(20) }).safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { message: "Missing or invalid key", type: "invalid_request_error" } },
        400,
      );
    }
    c.header("Set-Cookie", createApiKeyCookieHeader(parsed.data.key));
    return c.json({ success: true });
  },
);

// POST /v1/keys/logout — clear the HttpOnly API key cookie (does NOT
// touch the Better Auth session; use Better Auth sign-out for that).
authRoutes.post("/v1/keys/logout", sessionAuth, async (c) => {
  c.header("Set-Cookie", createLogoutCookieHeader());
  return c.json({ success: true });
});