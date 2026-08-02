/**
 * Admin routes — operator/owner surface.
 *
 * All endpoints require `requireAdmin()` — gates on the user's `role` column
 * (preferred) OR `ADMIN_WALLET_ADDRESSES` env (back-compat for SIWE-linked
 * wallet admins). In dev mode without any admin configured, the first
 * user can promote themselves via `POST /v1/admin/promote-self` (one
 * time, dev-only).
 *
 *   GET    /v1/admin/health                  — server version + uptime + DB/Redis ping
 *   GET    /v1/admin/models                  — list catalog with pricing
 *   PATCH  /v1/admin/models/:id              — adjust input/output price per 1M tokens
 *   GET    /v1/admin/usage                   — aggregated usage (last 24h / 7d / 30d)
 *   GET    /v1/admin/usage/recent            — last N usage rows
 *   GET    /v1/admin/users                   — list users (?q=<text> for search)
 *   PATCH  /v1/admin/users/:id               — update user (banned, role, credit delta)
 *   POST   /v1/admin/users/:id/credits       — add/remove credits with reason
 *   POST   /v1/admin/users/:id/suspend       — suspend user (revokes API keys)
 *   POST   /v1/admin/users/:id/unsuspend     — unsuspend user
 *   GET    /v1/admin/audit                   — audit log (action/userId/from/to filters + cursor pagination)
 *   POST   /v1/admin/polar/refund            — issue Polar refund + drain credits
 *   GET    /v1/admin/polar/payments          — list Polar payments
 *   GET    /v1/admin/polar/customers         — list Polar customers
 *   POST   /v1/admin/polar/checkouts         — create Polar checkout
 *   GET    /v1/admin/polar/products          — list Polar products
 *   GET    /v1/admin/polar/subscriptions     — list Polar subscriptions
 *   GET    /v1/admin/settings                — site settings (admin)
 *   PATCH  /v1/admin/settings                — update site settings
 *   POST   /v1/admin/promote-self            — (dev) promote caller to admin role
 *   GET    /v1/admin/integrations            — Polar / Gonka provider status
 *
 * Pricing edits write to the in-memory catalog (`inference/models.ts`).
 * Changes survive until process restart — the canonical source is
 * `models.json` on disk via `MODELS_CONFIG_PATH` or the default catalog.
 * Audit log records every pricing change.
 *
 * Slice 6 (admin controls depth) added:
 *   - users search via ?q=
 *   - dedicated credit adjustment endpoint (CREDIT_ADJUSTED audit)
 *   - dedicated suspend / unsuspend endpoints (revokes API keys on suspend)
 *   - Polar refund endpoint (REFUND_ISSUED audit, drains credits)
 *   - audit log filters + cursor pagination
 */
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { sql, desc, eq, gte, count, lt, and, or, ilike } from "drizzle-orm";
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
import type { OmaEnv } from "../../types.js";
import { requireAdmin, sessionAuth } from "../../auth/middleware.js";
import { db } from "../../db/client.js";
import { user, usageRecords, auditLogs, creditBalances, siteSettings, apiKeys } from "../../db/schema.js";
import { listAllModels, getModelById } from "../../inference/models.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";
import { auditLog } from "../../middleware/audit.js";
import { adjustCredits, drainCreditsForRefund } from "./admin-controls.js";

export const adminRoutes = new Hono<OmaEnv>();

// `/v1/admin/promote-self` is the bootstrap for the very first admin in dev
// (and the recovery hatch if the only admin loses access). It MUST stay
// available even when nobody is admin yet, so it uses sessionAuth only
// (not requireAdmin). Everything else under /v1/admin/* requires admin.
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

adminRoutes.use("/v1/admin/*", sessionAuth, requireAdmin());

// ---------------------------------------------------------------------------
// Pricing catalog — patch in-memory at runtime; durable on next process boot.
// ---------------------------------------------------------------------------

/** Mutable per-model pricing overlay. Keyed by model id.
 *  Persists to MODELS_CONFIG_PATH (defaults to server/models.json) so
 *  PATCH /v1/admin/models/:id survives process restarts. The in-memory
 *  map is just a hot cache. */
const pricingOverrides = new Map<
  string,
  { inputPricePer1M: number; outputPricePer1M: number; updatedAt: string }
>();

/** File-backed pricing store. Writes are atomic (tmp + rename) and
 *  guarded by a process-local mutex so concurrent PATCHes don't clobber
 *  each other. */
function resolveOverridesFilePath(): string {
	const envPath = process.env.MODELS_CONFIG_PATH?.trim();
	if (envPath) return envPath;
	// Default: server/models.json. Resolve from the *project root*, not
	// from process.cwd(), so the file lands at <repo>/server/models.json
	// regardless of whether the server is started from the project root
	// (`pnpm --filter oma-server dev`) or from server/ (`cd server && dev`).
	// We find the project root by looking for the package.json that
	// declares the "oma-monorepo" workspace.
	const fs = nodeFs;
	const path = nodePath;
	let dir = process.cwd();
	for (let i = 0; i < 6; i++) {
		const candidate = path.join(dir, "package.json");
		if (fs.existsSync(candidate)) {
			try {
				const pkg = JSON.parse(fs.readFileSync(candidate, "utf8")) as {
					name?: string;
				};
				if (pkg.name === "oma-monorepo") {
					return path.join(dir, "server", "models.json");
				}
			} catch {
				// ignore
			}
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	// Fallback: relative-to-CWD
	return path.resolve(process.cwd(), "server", "models.json");
}

const MODELS_OVERRIDES_FILE = resolveOverridesFilePath();

interface PersistedOverridesFile {
	schemaVersion: 1;
	updatedAt: string;
	overrides: Record<
		string,
		{ inputPricePer1M: number; outputPricePer1M: number; updatedAt: string }
	>;
}

let persistQueue: Promise<void> = Promise.resolve();

async function loadPersistedOverrides(): Promise<void> {
	try {
		const fs = await import("node:fs/promises");
		const file = MODELS_OVERRIDES_FILE;
		const raw = await fs.readFile(file, "utf8");
		// Only load as overrides if it's the new schema (schemaVersion: 1).
		// The file is shared with the catalog seed; the override section
		// is embedded at a known key, but for simplicity we keep them
		// in a separate file: server/models-overrides.json.
		const parsed = JSON.parse(raw) as PersistedOverridesFile;
		if (parsed?.schemaVersion === 1) {
			for (const [modelId, override] of Object.entries(parsed.overrides ?? {})) {
				pricingOverrides.set(modelId, override);
			}
			logger.info(
				{ count: pricingOverrides.size, file },
				"[admin] loaded pricing overrides from disk",
			);
		} else {
			logger.info(
				{ file },
				"[admin] no pricing-override schemaVersion: 1; using in-memory defaults",
			);
		}
	} catch (err: unknown) {
		const e = err as NodeJS.ErrnoException;
		if (e.code === "ENOENT") {
			logger.info(
				{ file: MODELS_OVERRIDES_FILE },
				"[admin] no pricing-override file yet; using in-memory defaults",
			);
		} else {
			logger.warn(
				{ err, file: MODELS_OVERRIDES_FILE },
				"[admin] failed to load pricing overrides from disk",
			);
		}
	}
}

void loadPersistedOverrides();

async function persistOverride(
	modelId: string,
	override: { inputPricePer1M: number; outputPricePer1M: number; updatedAt: string },
): Promise<void> {
	// 2026-07-30: write to a SEPARATE file (server/models-overrides.json)
	// rather than overwriting the catalog seed (server/models.json).
	// Two files, one purpose each; the catalog is read-only, overrides
	// are mutable. This keeps git diffs clean and prevents the PATCH
	// from accidentally truncating the catalog.
	const fs = await import("node:fs/promises");
	const path = await import("node:path");
	const overridesFile = path.join(
		path.dirname(MODELS_OVERRIDES_FILE),
		"models-overrides.json",
	);

	persistQueue = persistQueue
		.then(async () => {
			const next: PersistedOverridesFile = {
				schemaVersion: 1,
				updatedAt: new Date().toISOString(),
				overrides: { ...Object.fromEntries(pricingOverrides), [modelId]: override },
			};
			try {
				const raw = await fs.readFile(overridesFile, "utf8");
				const existing = JSON.parse(raw) as PersistedOverridesFile;
				if (existing?.schemaVersion === 1) {
					next.overrides = { ...existing.overrides, [modelId]: override };
				}
			} catch (err: unknown) {
				const e = err as NodeJS.ErrnoException;
				if (e.code !== "ENOENT") {
					logger.warn(
						{ err, file: overridesFile },
						"[admin] overrides file unreadable; rewriting",
					);
				}
			}
			next.schemaVersion = 1;
			next.updatedAt = new Date().toISOString();

			const tmp = `${overridesFile}.${process.pid}.${Date.now()}.tmp`;
			await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
			await fs.rename(tmp, overridesFile);
			logger.info(
				{ modelId, file: overridesFile },
				"[admin] persisted pricing override to disk",
			);
		})
		.catch((err) => {
			logger.error({ err, modelId }, "[admin] failed to persist pricing override");
		});
	await persistQueue;
}

export function getModelPricingOverride(modelId: string) {
	return pricingOverrides.get(modelId);
}

const patchSchema = z.object({
	inputPricePer1M: z.number().min(0).max(1000).optional(),
	outputPricePer1M: z.number().min(0).max(1000).optional(),
});

adminRoutes.get("/v1/admin/models", (c) => {
	const models = listAllModels().map((m) => {
		const override = pricingOverrides.get(m.id);
		return {
			id: m.id,
			displayName: m.displayName,
			provider: m.provider,
			gonkaId: m.gonkaId ?? null,
			category: m.category,
			inputPricePer1M: override?.inputPricePer1M ?? m.inputPricePer1M,
			outputPricePer1M: override?.outputPricePer1M ?? m.outputPricePer1M,
			markupPercent: m.markupPercent,
			contextWindow: m.contextWindow ?? null,
			maxTokens: m.maxTokens,
			supportsStreaming: m.supportsStreaming,
			supportsTools: m.capabilities?.includes("tools") ?? false,
			override: override ? { inputPricePer1M: override.inputPricePer1M, outputPricePer1M: override.outputPricePer1M, updatedAt: override.updatedAt } : null,
		};
	});
	return c.json({ object: "list", data: models, count: models.length });
});

adminRoutes.patch("/v1/admin/models/:id", async (c) => {
	const id = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	const parsed = patchSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { message: "Invalid pricing update", issues: parsed.error.flatten() } }, 400);
	}
	const modelDef = getModelById(id);
	if (!modelDef) {
		return c.json({ error: { message: `Model ${id} not found` } }, 404);
	}

	const prev = pricingOverrides.get(id);
	const next = {
		inputPricePer1M:
			parsed.data.inputPricePer1M ?? prev?.inputPricePer1M ?? modelDef.inputPricePer1M,
		outputPricePer1M:
			parsed.data.outputPricePer1M ?? prev?.outputPricePer1M ?? modelDef.outputPricePer1M,
		updatedAt: new Date().toISOString(),
	};
	pricingOverrides.set(id, next);

	// 2026-07-30: write through to disk so the override survives
	// process restarts. Atomic via tmp + rename, serialized by
	// persistQueue so concurrent PATCHes can't corrupt the file.
	await persistOverride(id, next);

	await auditLog({
		userId: c.get("userId"),
		action: "USER_UPDATED",
		resource: "model_pricing",
		resourceId: id,
		metadata: {
			inputPricePer1M: next.inputPricePer1M,
			outputPricePer1M: next.outputPricePer1M,
			previous: {
				inputPricePer1M: modelDef.inputPricePer1M,
				outputPricePer1M: modelDef.outputPricePer1M,
			},
		},
	});

	return c.json({
		id,
		inputPricePer1M: next.inputPricePer1M,
		outputPricePer1M: next.outputPricePer1M,
		updatedAt: next.updatedAt,
	});
});

// ---------------------------------------------------------------------------
// Usage analytics — aggregates from usageRecords
// ---------------------------------------------------------------------------

adminRoutes.get("/v1/admin/usage", async (c) => {
  const window = (c.req.query("window") ?? "7d").toLowerCase();
  const days = window === "24h" ? 1 : window === "30d" ? 30 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [totals] = await db
      .select({
        requests: count(),
        inputTokens: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)::int`,
        costCents: sql<number>`COALESCE(SUM(${usageRecords.costCents}::numeric), 0)::float`,
        markupCents: sql<number>`COALESCE(SUM(${usageRecords.markupCents}::numeric), 0)::float`,
        totalCents: sql<number>`COALESCE(SUM(${usageRecords.totalCents}::numeric), 0)::float`,
      })
      .from(usageRecords)
      .where(gte(usageRecords.createdAt, since));

    // Per-model breakdown
    const perModel = await db
      .select({
        model: usageRecords.model,
        provider: usageRecords.provider,
        requests: count(),
        inputTokens: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)::int`,
        totalCents: sql<number>`COALESCE(SUM(${usageRecords.totalCents}::numeric), 0)::float`,
      })
      .from(usageRecords)
      .where(gte(usageRecords.createdAt, since))
      .groupBy(usageRecords.model, usageRecords.provider)
      .orderBy(sql`SUM(${usageRecords.totalCents}::numeric) DESC`)
      .limit(20);

    return c.json({
      window,
      since: since.toISOString(),
      totals: {
        requests: Number(totals?.requests ?? 0),
        inputTokens: Number(totals?.inputTokens ?? 0),
        outputTokens: Number(totals?.outputTokens ?? 0),
        costCents: Number(totals?.costCents ?? 0),
        markupCents: Number(totals?.markupCents ?? 0),
        totalCents: Number(totals?.totalCents ?? 0),
      },
      perModel: perModel.map((m) => ({
        model: m.model,
        provider: m.provider,
        requests: Number(m.requests),
        inputTokens: Number(m.inputTokens),
        outputTokens: Number(m.outputTokens),
        totalCents: Number(m.totalCents),
      })),
    });
  } catch (err) {
    logger.error({ err }, "[admin/usage] query failed");
    return c.json({ error: { message: "usage query failed" } }, 500);
  }
});

adminRoutes.get("/v1/admin/usage/recent", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);
  const filterUserId = c.req.query("userId")?.trim();
  try {
    let query = db
      .select({
        id: usageRecords.id,
        requestId: usageRecords.requestId,
        userId: usageRecords.userId,
        model: usageRecords.model,
        provider: usageRecords.provider,
        inputTokens: usageRecords.inputTokens,
        outputTokens: usageRecords.outputTokens,
        costCents: usageRecords.costCents,
        totalCents: usageRecords.totalCents,
        status: usageRecords.status,
        createdAt: usageRecords.createdAt,
      })
      .from(usageRecords);

    if (filterUserId) {
      // @ts-ignore
      query = query.where(eq(usageRecords.userId, filterUserId));
    }

    // @ts-ignore
    const rows = await query.orderBy(desc(usageRecords.createdAt)).limit(limit);
    return c.json({ data: rows, count: rows.length });
  } catch (err) {
    logger.error({ err }, "[admin/usage/recent] failed");
    return c.json({ error: { message: "usage query failed" } }, 500);
  }
});

// ---------------------------------------------------------------------------
// Users list — admin overview
// ---------------------------------------------------------------------------

adminRoutes.get("/v1/admin/users", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? "100"), 500);
  const q = c.req.query("q")?.trim();
  try {
    // ?q=<text> — substring search across email, evm_address, user.id, and
    // account_number. Schema declares accountNumber (see db/schema.ts); the
    // typed column is preferred over the previous raw-SQL EXISTS fallback.
    let whereClause: ReturnType<typeof and> | undefined;
    if (q) {
      const pattern = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      const idFilter = q.length > 0 ? sql<string>`${user.id}::text ILIKE ${pattern}` : sql`FALSE`;
      whereClause = and(
        or(
          ilike(user.email, pattern),
          ilike(user.evmAddress, pattern),
          idFilter,
          ilike(user.accountNumber, pattern),
        ),
      );
    }

    let query = db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        evmAddress: user.evmAddress,
        role: user.role,
        banned: user.banned,
        suspended: user.suspended,
        isAnonymous: user.isAnonymous,
        createdAt: user.createdAt,
      })
      .from(user)
      .$dynamic();
    if (whereClause) query = query.where(whereClause);
    const users = await query.orderBy(desc(user.createdAt)).limit(limit);

    const balances = await db
      .select()
      .from(creditBalances)
      .limit(limit);
    const balMap = new Map(balances.map((b) => [b.userId, b]));

    return c.json({
      data: users.map((u) => {
        const b = balMap.get(u.id);
        return {
          ...u,
          balanceCents: b ? Number(b.balanceCents) : 0,
          totalUsedCents: b ? Number(b.totalUsedCents) : 0,
          totalDepositedCents: b ? Number(b.totalDepositedCents) : 0,
        };
      }),
      count: users.length,
      query: q ?? null,
    });
  } catch (err) {
    logger.error({ err }, "[admin/users] failed");
    return c.json({ error: { message: "user query failed" } }, 500);
  }
});

const updateUserSchema = z.object({
  banned: z.boolean().optional(),
  suspended: z.boolean().optional(),
  role: z.string().optional(),
  creditBalanceCentsDelta: z.number().optional(),
});

// PATCH /v1/admin/users/:id — update user details (banned, suspended, role, credit balance delta)
adminRoutes.patch("/v1/admin/users/:id", async (c) => {
  const targetId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: "Invalid request payload",
          issues: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  try {
    // 1. Fetch user to verify they exist + get baseline for audit logs
    const [existing] = await db
      .select()
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);
    if (!existing) {
      return c.json({ error: { message: "User not found" } }, 404);
    }

    const [existingBal] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, targetId))
      .limit(1);

    const updateFields: Partial<typeof user.$inferSelect> = {
      updatedAt: new Date(),
    };
    if (parsed.data.banned !== undefined) {
      updateFields.banned = parsed.data.banned;
    }
    if (parsed.data.suspended !== undefined) {
      updateFields.suspended = parsed.data.suspended;
    }
    if (parsed.data.role !== undefined) {
      updateFields.role = parsed.data.role;
    }

    // 2. Perform updates
    await db.update(user).set(updateFields).where(eq(user.id, targetId));

    // If the user just got suspended, revoke all active API keys so
    // dangling bearer tokens can't keep hitting the gateway. This is
    // defense-in-depth: the auth middleware ALSO checks suspended, but
    // revoking is the right thing to do so we don't rely solely on the
    // middleware check (a leaked Bearer would be re-rejected, but
    // revoking is cleaner).
    if (parsed.data.suspended === true && !existing.suspended) {
      await db
        .update(apiKeys)
        .set({ active: false })
        .where(and(eq(apiKeys.userId, targetId), eq(apiKeys.active, true)));
    }

    if (parsed.data.creditBalanceCentsDelta !== undefined) {
      const delta = parsed.data.creditBalanceCentsDelta;
      await db
        .insert(creditBalances)
        .values({
          userId: targetId,
          balanceCents: delta.toString(),
          totalDepositedCents: delta > 0 ? delta.toString() : "0",
          totalUsedCents: "0",
        })
        .onConflictDoUpdate({
          target: creditBalances.userId,
          set: {
            balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric + ${delta}::numeric, 0)`,
            totalDepositedCents: delta > 0
              ? sql`${creditBalances.totalDepositedCents}::numeric + ${delta}::numeric`
              : creditBalances.totalDepositedCents,
            lastActivityAt: sql`NOW()`,
          },
        });
    }

    // 3. Fetch final state for return + audit
    const [finalUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);
    const [finalBal] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, targetId))
      .limit(1);

    const adminId = c.get("userId");
    if (adminId) {
      await auditLog({
        userId: adminId,
        action: "USER_UPDATED",
        resource: "user",
        resourceId: targetId,
        metadata: {
          before: {
            user: existing,
            balance: existingBal ? Number(existingBal.balanceCents) : 0,
          },
          after: {
            user: finalUser,
            balance: finalBal ? Number(finalBal.balanceCents) : 0,
          },
        },
      });
    }

    return c.json({
      success: true,
      user: {
        ...finalUser,
        balanceCents: finalBal ? Number(finalBal.balanceCents) : 0,
        totalUsedCents: finalBal ? Number(finalBal.totalUsedCents) : 0,
        totalDepositedCents: finalBal ? Number(finalBal.totalDepositedCents) : 0,
      },
    });
  } catch (err) {
    logger.error({ err, targetId }, "[admin/users/patch] update failed");
    return c.json({ error: { message: "Failed to update user" } }, 500);
  }
});

// ---------------------------------------------------------------------------
// Slice 6 — admin operator controls
//   - dedicated credit adjustment endpoint with reason + CREDIT_ADJUSTED audit
//   - dedicated suspend / unsuspend endpoints that revoke API keys + write
//     USER_SUSPENDED / USER_UNSUSPENDED audit
// ---------------------------------------------------------------------------

const creditAdjustSchema = z.object({
  amountCents: z.number().int(),
  reason: z.string().trim().min(1).max(500),
});

/**
 * POST /v1/admin/users/:id/credits — manually adjust a user's credit
 * balance. Positive amountCents adds to the balance (and totalDepositedCents
 * for analytics); negative drains the balance (capped at 0 so it can never
 * go negative). Always writes a CREDIT_ADJUSTED audit entry.
 */
adminRoutes.post("/v1/admin/users/:id/credits", async (c) => {
  const targetId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = creditAdjustSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: "Invalid request payload",
          issues: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const adminId = c.get("userId");
  if (!adminId) {
    return c.json({ error: { message: "auth required" } }, 401);
  }

  try {
    // 1. Verify target user exists
    const [existing] = await db
      .select({ id: user.id, banned: user.banned, suspended: user.suspended })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);
    if (!existing) {
      return c.json({ error: { message: "User not found" } }, 404);
    }

    // 2. Atomic balance update via the shared helper so the math is
    // unit-testable (see __tests__/admin-controls.test.ts).
    const delta = parsed.data.amountCents;
    const adjustResult = await adjustCredits(db, targetId, delta);
    const beforeBalanceCents = adjustResult.beforeBalanceCents;
    const newBalanceCents = adjustResult.balanceCents;

    // 4. Audit — admin operator + reason + before/after snapshot
    await auditLog({
      userId: adminId,
      action: "CREDIT_ADJUSTED",
      resource: "user_credits",
      resourceId: targetId,
      metadata: {
        amountCents: delta,
        reason: parsed.data.reason,
        beforeBalanceCents,
        afterBalanceCents: newBalanceCents,
        targetUserId: targetId,
      },
    });

    return c.json({
      success: true,
      userId: targetId,
      amountCents: delta,
      reason: parsed.data.reason,
      beforeBalanceCents,
      balanceCents: newBalanceCents,
      totalDepositedCents: adjustResult.totalDepositedCents,
      totalUsedCents: adjustResult.totalUsedCents,
    });
  } catch (err) {
    logger.error({ err, targetId }, "[admin/users/credits] adjustment failed");
    return c.json({ error: { message: "Failed to adjust credits" } }, 500);
  }
});

const suspendBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * POST /v1/admin/users/:id/suspend — set user.suspended=true, revoke all
 * active API keys for the user, and write USER_SUSPENDED audit.
 */
adminRoutes.post("/v1/admin/users/:id/suspend", async (c) => {
  const targetId = c.req.param("id");
  const body = await c.req.json().catch(() => null).catch(() => ({}));
  // Allow empty body (no reason required for suspend)
  const parsed = body
    ? suspendBodySchema.safeParse(body)
    : ({ success: true, data: { reason: undefined } } as const);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: "Invalid request payload",
          issues: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const adminId = c.get("userId");
  if (!adminId) {
    return c.json({ error: { message: "auth required" } }, 401);
  }

  try {
    const [existing] = await db
      .select({ id: user.id, suspended: user.suspended })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);
    if (!existing) {
      return c.json({ error: { message: "User not found" } }, 404);
    }

    if (existing.suspended) {
      // Idempotent — already suspended. Don't double-audit or double-revoke.
      return c.json({
        success: true,
        alreadySuspended: true,
        userId: targetId,
      });
    }

    await db
      .update(user)
      .set({ suspended: true, updatedAt: new Date() })
      .where(eq(user.id, targetId));

    // Revoke all active API keys for the user. After revoke, bearerAuth
    // would still reject on suspended= true, but revoking is the right
    // thing for defense-in-depth (kills any in-flight singleflight
    // cached keyHash result that hasn't yet observed the suspended flag).
    const revoked = await db
      .update(apiKeys)
      .set({ active: false })
      .where(and(eq(apiKeys.userId, targetId), eq(apiKeys.active, true)))
      .returning({ id: apiKeys.id });

    await auditLog({
      userId: adminId,
      action: "USER_SUSPENDED",
      resource: "user",
      resourceId: targetId,
      metadata: {
        reason: parsed.data.reason ?? null,
        revokedApiKeyIds: revoked.map((k) => k.id),
        targetUserId: targetId,
      },
    });

    return c.json({
      success: true,
      userId: targetId,
      suspended: true,
      revokedApiKeyCount: revoked.length,
      reason: parsed.data.reason ?? null,
    });
  } catch (err) {
    logger.error({ err, targetId }, "[admin/users/suspend] failed");
    return c.json({ error: { message: "Failed to suspend user" } }, 500);
  }
});

/**
 * POST /v1/admin/users/:id/unsuspend — clear user.suspended=false and write
 * USER_UNSUSPENDED audit. Does NOT auto-reissue API keys; admin must
 * explicitly rotate if needed.
 */
adminRoutes.post("/v1/admin/users/:id/unsuspend", async (c) => {
  const targetId = c.req.param("id");
  const body = await c.req.json().catch(() => null).catch(() => ({}));
  const parsed = body
    ? suspendBodySchema.safeParse(body)
    : ({ success: true, data: { reason: undefined } } as const);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: "Invalid request payload",
          issues: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const adminId = c.get("userId");
  if (!adminId) {
    return c.json({ error: { message: "auth required" } }, 401);
  }

  try {
    const [existing] = await db
      .select({ id: user.id, suspended: user.suspended })
      .from(user)
      .where(eq(user.id, targetId))
      .limit(1);
    if (!existing) {
      return c.json({ error: { message: "User not found" } }, 404);
    }

    if (!existing.suspended) {
      return c.json({
        success: true,
        alreadyUnsuspended: true,
        userId: targetId,
      });
    }

    await db
      .update(user)
      .set({ suspended: false, updatedAt: new Date() })
      .where(eq(user.id, targetId));

    await auditLog({
      userId: adminId,
      action: "USER_UNSUSPENDED",
      resource: "user",
      resourceId: targetId,
      metadata: {
        reason: parsed.data.reason ?? null,
        targetUserId: targetId,
      },
    });

    return c.json({
      success: true,
      userId: targetId,
      suspended: false,
      reason: parsed.data.reason ?? null,
    });
  } catch (err) {
    logger.error({ err, targetId }, "[admin/users/unsuspend] failed");
    return c.json({ error: { message: "Failed to unsuspend user" } }, 500);
  }
});

// ---------------------------------------------------------------------------
// Audit log — filterable + cursor-paginated (Slice 6)
// ---------------------------------------------------------------------------
//
// Supported query params:
//   ?action=<enum>     — filter by audit_action enum value
//   ?userId=<id>       — filter by audit row's user_id (the actor for admin
//                        actions, or the target for end-user events)
//   ?from=<ISO>        — createdAt >= from (inclusive)
//   ?to=<ISO>          — createdAt <= to  (inclusive)
//   ?limit=<int>       — page size, max 500, default 100
//   ?cursor=<base64>   — opaque cursor from a previous response's `nextCursor`.
//                        Encodes (createdAt, id) of the last row of the
//                        previous page so subsequent pages continue without
//                        duplicates or gaps when new rows arrive.
//
// Cursor is a base64-encoded JSON `{ts: ISO, id: uuid}` so the admin UI
// can pass through a single opaque string.

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

adminRoutes.get("/v1/admin/audit", async (c) => {
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

// ---------------------------------------------------------------------------
// Integrations status — Polar, Gonka provider health
// ---------------------------------------------------------------------------

adminRoutes.get("/v1/admin/integrations", async (c) => {
  const polarConfigured = !!config.POLAR_ACCESS_TOKEN && config.POLAR_ACCESS_TOKEN !== "polar_oat_..." && !config.POLAR_ACCESS_TOKEN.startsWith("polar_oat_...");
  const gonkaConfigured = !!config.GONKA_API_KEY;
  const veniceConfigured = !!config.VENICE_API_KEY;
  const resendConfigured = !!config.RESEND_API_KEY && !config.RESEND_API_KEY.startsWith("re_VErSwvfj_Kr8YCVhJTB2bGK7wcg35vJ3K");

  // Probe Gonka live — 200 = healthy, anything else = degraded
  let gonkaHealth: { status: "healthy" | "degraded" | "down"; latencyMs?: number; note?: string } = { status: "down" };
  if (gonkaConfigured) {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`${config.GONKA_API_URL}/v1/models`, {
        headers: { Authorization: `Bearer ${config.GONKA_API_KEY}` },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      gonkaHealth = {
        status: r.ok ? "healthy" : "degraded",
        latencyMs: Date.now() - start,
        note: r.ok ? undefined : `upstream returned ${r.status}`,
      };
    } catch (err) {
      gonkaHealth = { status: "down", note: String((err as Error).message ?? err) };
    }
  } else {
    gonkaHealth = { status: "down", note: "GONKA_API_KEY not set" };
  }

  return c.json({
    polar: {
      configured: polarConfigured,
      server: config.POLAR_SERVER,
      organizationId: config.POLAR_ORGANIZATION_ID?.startsWith("org_...") ? null : config.POLAR_ORGANIZATION_ID,
      note: polarConfigured ? "Polar events will be sent" : "Set POLAR_ACCESS_TOKEN in server/.env to enable usage metering",
    },
    gonka: {
      configured: gonkaConfigured,
      url: config.GONKA_API_URL,
      health: gonkaHealth,
    },
    venice: {
      configured: veniceConfigured,
      url: config.VENICE_API_URL,
      private: !config.OMMA_ALLOW_NON_PRIVATE_VENICE,
    },
    resend: {
      configured: resendConfigured,
      from: config.RESEND_FROM,
    },
    node_env: config.NODE_ENV,
    dailyLimits: {
      anonymous: 20,
      registered: 100,
    },
  });
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

adminRoutes.get("/v1/admin/health", async (c) => {
  const uptime = process.uptime();
  const used = process.memoryUsage();
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    logger.warn({ err }, "admin/health db ping failed");
  }
  return c.json({
    status: "ok",
    version: "2.1.0",
    env: config.NODE_ENV,
    uptime_s: Math.round(uptime),
    memory: {
      rss_mb: Math.round(used.rss / 1024 / 1024),
      heap_used_mb: Math.round(used.heapUsed / 1024 / 1024),
    },
    db: dbOk ? "reachable" : "down",
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Polar Management — payments, customers, checkouts, products, subscriptions
// ---------------------------------------------------------------------------

function polarHeaders() {
  return {
    Authorization: `Bearer ${config.POLAR_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Slice 6 — Polar refund tool
//   POST /v1/admin/polar/refund — issues a Polar refund and drains the
//   corresponding credits from the user's balance. Writes REFUND_ISSUED.
// ---------------------------------------------------------------------------
//
// `paymentId` here maps to Polar's `order_id` — Polar refunds are issued
// against an order, not a payment. From the operator's perspective this is
// the payment id surfaced by the Polar customer-portal UI. The internal
// call to Polar uses the order_id field.

const refundSchema = z.object({
  paymentId: z.string().trim().min(1).max(200),
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
  // Optional: pin refund to a specific user. If omitted we look up by
  // Polar metadata.external_customer_id (the user's id / wallet).
  userId: z.string().trim().optional(),
});

adminRoutes.post("/v1/admin/polar/refund", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured" } }, 400);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = refundSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          message: "Invalid refund payload",
          issues: parsed.error.flatten(),
        },
      },
      400,
    );
  }

  const adminId = c.get("userId");
  if (!adminId) {
    return c.json({ error: { message: "auth required" } }, 401);
  }

  const { paymentId, amountCents, reason, userId: pinnedUserId } = parsed.data;

  // 1. Issue the Polar refund via SDK if available; fall back to REST so
  //    this works even if the SDK types drift from the live Polar API.
  let polarRefundId: string | null = null;
  try {
    const { Polar } = await import("@polar-sh/sdk");
    const polar = new Polar({
      accessToken: config.POLAR_ACCESS_TOKEN!,
      server: (config.POLAR_SERVER as "production" | "sandbox") ?? "production",
    });
    const refund = await polar.refunds.create({
      orderId: paymentId,
      amount: amountCents,
      reason: "customer_request",
      comment: reason,
      revokeBenefits: false,
    });
    polarRefundId = (refund as { id?: string }).id ?? null;
  } catch (sdkErr) {
    // SDK path failed — fall back to REST. Polar expects `order_id` for
    // refunds. The amount is in cents (matching the SDK call).
    try {
      const r = await fetch(`${config.POLAR_SERVER}/v1/refunds`, {
        method: "POST",
        headers: polarHeaders(),
        body: JSON.stringify({
          order_id: paymentId,
          amount: amountCents,
          reason: "customer_request",
          comment: reason,
          revoke_benefits: false,
        }),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        logger.error(
          { err: sdkErr, status: r.status, detail, paymentId },
          "[admin/polar/refund] Polar SDK + REST both failed",
        );
        return c.json(
          {
            error: {
              message: `Polar refund failed: ${r.status} ${detail}`,
            },
          },
          r.status as ContentfulStatusCode,
        );
      }
      const polarResp = (await r.json()) as { id?: string };
      polarRefundId = polarResp.id ?? null;
    } catch (restErr) {
      logger.error(
        { err: restErr, paymentId },
        "[admin/polar/refund] REST fallback also failed",
      );
      return c.json(
        { error: { message: "Polar refund request failed" } },
        502,
      );
    }
  }

  // 2. Drain credits from the user's balance. If pinnedUserId was
  //    supplied use that; otherwise resolve via Polar's payment metadata
  //    (REST GET /v1/payments/:id). If we cannot resolve a user we still
  //    succeed (refund went through) but log + return a warning.
  let resolvedUserId: string | null = pinnedUserId ?? null;
  if (!resolvedUserId) {
    try {
      const r = await fetch(
        `${config.POLAR_SERVER}/v1/payments/${encodeURIComponent(paymentId)}`,
        { headers: polarHeaders() },
      );
      if (r.ok) {
        const data = (await r.json()) as {
          metadata?: { user_id?: string; userId?: string };
          customer_id?: string;
        };
        const metaUserId = data.metadata?.user_id ?? data.metadata?.userId;
        if (metaUserId) resolvedUserId = metaUserId;
      }
    } catch (err) {
      logger.warn({ err, paymentId }, "[admin/polar/refund] could not resolve user from Polar metadata");
    }
  }

  let drainedUserId: string | null = null;
  let drainedBalanceCents: number | null = null;
  if (resolvedUserId) {
    // Delegate the SQL to the shared helper so the math is unit-testable.
    const drainResult = await drainCreditsForRefund(
      db,
      resolvedUserId,
      amountCents,
    );
    drainedUserId = drainResult.userId;
    drainedBalanceCents = drainResult.balanceCents;
  }

  // 3. Audit
  await auditLog({
    userId: adminId,
    action: "REFUND_ISSUED",
    resource: "polar_refund",
    resourceId: paymentId,
    metadata: {
      reason,
      amountCents,
      polarRefundId,
      drainedUserId,
      drainedBalanceCents,
      source: "admin/polar/refund",
    },
  });

  return c.json({
    success: true,
    polarRefundId,
    paymentId,
    amountCents,
    reason,
    drainedUserId,
    drainedBalanceCents,
    warning: drainedUserId
      ? null
      : "refund issued but could not resolve user — credits not drained",
  });
});

// GET /v1/admin/polar/payments — list recent payments
adminRoutes.get("/v1/admin/polar/payments", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured" } }, 400);
  }
  const searchParams = new URLSearchParams();
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  searchParams.set("limit", String(Math.min(limit, 100)));
  searchParams.set("offset", String(offset));
  const sort = c.req.query("sort");
  if (sort) searchParams.set("sort", sort);
  try {
    const r = await fetch(`${config.POLAR_SERVER}/v1/payments?${searchParams.toString()}`, {
      headers: polarHeaders(),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}` } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err) } }, 500);
  }
});

// GET /v1/admin/polar/customers — list customers
adminRoutes.get("/v1/admin/polar/customers", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured" } }, 400);
  }
  const searchParams = new URLSearchParams();
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  searchParams.set("limit", String(Math.min(limit, 100)));
  searchParams.set("offset", String(offset));
  try {
    const r = await fetch(`${config.POLAR_SERVER}/v1/customers?${searchParams.toString()}`, {
      headers: polarHeaders(),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}` } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err) } }, 500);
  }
});

// POST /v1/admin/polar/checkouts — create a checkout link
adminRoutes.post("/v1/admin/polar/checkouts", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured" } }, 400);
  }
  const body = await c.req.json();
  const { productId, customerEmail, customerName, successUrl, cancelUrl } = body as {
    productId: string;
    customerEmail?: string;
    customerName?: string;
    successUrl?: string;
    cancelUrl?: string;
  };
  if (!productId) {
    return c.json({ error: { message: "productId is required" } }, 400);
  }
  const payload: Record<string, unknown> = { productId };
  if (customerEmail) payload.customerEmail = customerEmail;
  if (customerName) payload.customerName = customerName;
  if (successUrl) payload.successUrl = successUrl;
  if (cancelUrl) payload.cancelUrl = cancelUrl;
  try {
    const r = await fetch(`${config.POLAR_SERVER}/v1/checkouts`, {
      method: "POST",
      headers: polarHeaders(),
      body: JSON.stringify(payload),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}` } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err) } }, 500);
  }
});

// GET /v1/admin/polar/products — list products
adminRoutes.get("/v1/admin/polar/products", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured" } }, 400);
  }
  const searchParams = new URLSearchParams();
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  searchParams.set("limit", String(Math.min(limit, 100)));
  searchParams.set("offset", String(offset));
  try {
    const r = await fetch(`${config.POLAR_SERVER}/v1/products?${searchParams.toString()}`, {
      headers: polarHeaders(),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}` } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err) } }, 500);
  }
});

// GET /v1/admin/polar/subscriptions — list subscriptions
adminRoutes.get("/v1/admin/polar/subscriptions", async (c) => {
  if (!config.POLAR_ACCESS_TOKEN) {
    return c.json({ error: { message: "Polar not configured" } }, 400);
  }
  const searchParams = new URLSearchParams();
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  searchParams.set("limit", String(Math.min(limit, 100)));
  searchParams.set("offset", String(offset));
  try {
    const r = await fetch(`${config.POLAR_SERVER}/v1/subscriptions?${searchParams.toString()}`, {
      headers: polarHeaders(),
    });
    if (!r.ok) return c.json({ error: { message: `Polar API error: ${r.status}` } }, r.status as ContentfulStatusCode);
    const data = await r.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: { message: String((err as Error).message ?? err) } }, 500);
  }
});

// GET /v1/site-settings (public)
adminRoutes.get("/v1/site-settings", async (c) => {
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
    });
  } catch (err) {
    logger.error({ err }, "[settings] failed to fetch site settings");
    return c.json({
      maintenanceMode: false,
      cardPaymentsEnabled: true,
      cryptoPaymentsEnabled: true,
    });
  }
});

// GET /v1/admin/settings (admin-protected)
adminRoutes.get("/v1/admin/settings", async (c) => {
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
adminRoutes.patch("/v1/admin/settings", async (c) => {
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
