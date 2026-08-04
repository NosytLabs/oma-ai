/**
 * Admin user management routes — list, patch, delete, credits, suspend.
 */
import type { Hono } from "hono";
import { z } from "zod";
import { sql, desc, eq, count, and, or, ilike } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { db } from "../../db/client.js";
import {
	user,
	auditLogs,
	creditBalances,
	apiKeys,
	session,
	account,
	walletAddress,
	verification,
} from "../../db/schema.js";
import { ADMIN_WALLET_ADDRESSES_SET } from "../../config.js";
import { logger } from "../../lib/logger.js";
import { auditLog } from "../../middleware/audit.js";
import { adjustCredits } from "./admin-controls.js";

export function registerUserRoutes(app: Hono<OmaEnv>): void {
app.get("/v1/admin/users", async (c) => {
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

const adminDeleteUserSchema = z.object({
	confirmation: z.literal("DELETE"),
	reason: z.string().trim().min(1).max(500),
});

/**
 * DELETE /v1/admin/users/:id — privacy-preserving operator deletion.
 *
 * This intentionally anonymizes instead of hard-deleting the user row:
 * usage/billing rows keep their referential integrity, while auth material
 * and identifying fields are removed. The operation is explicit, audited,
 * cannot target the acting admin, and cannot remove the last admin.
 */
app.delete("/v1/admin/users/:id", async (c) => {
	const targetId = c.req.param("id");
	const body = await c.req.json().catch(() => null);
	const parsed = adminDeleteUserSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{
				error: {
					message: "Type DELETE and provide a reason to confirm account deletion",
					issues: parsed.error.flatten(),
				},
			},
			400,
		);
	}

	const adminId = c.get("userId");
	if (!adminId) return c.json({ error: { message: "auth required" } }, 401);
	if (targetId === adminId) {
		return c.json({ error: { message: "Admins cannot delete their own account from this panel" } }, 400);
	}

	try {
		const [existing] = await db
			.select({ id: user.id, role: user.role, evmAddress: user.evmAddress, email: user.email })
			.from(user)
			.where(eq(user.id, targetId))
			.limit(1);
		if (!existing) return c.json({ error: { message: "User not found" } }, 404);

		if (existing.evmAddress && ADMIN_WALLET_ADDRESSES_SET.has(existing.evmAddress.toLowerCase())) {
			return c.json({ error: { message: "Cannot delete an account protected by the admin wallet allowlist" } }, 409);
		}
		if (existing.role === "admin") {
			const [{ total }] = await db
				.select({ total: count() })
				.from(user)
				.where(eq(user.role, "admin"));
			if (Number(total) <= 1) {
				return c.json({ error: { message: "Cannot delete the last administrator" } }, 409);
			}
		}

		const anonymizedEmail = `deleted-${crypto.randomUUID()}@deleted.invalid`;
		await db.transaction(async (tx) => {
			// Remove login/session credentials and wallet/API-key material first.
			await tx.delete(session).where(eq(session.userId, targetId));
			await tx.delete(account).where(eq(account.userId, targetId));
			await tx.delete(walletAddress).where(eq(walletAddress.userId, targetId));
			await tx
				.delete(verification)
				.where(or(eq(verification.identifier, targetId), eq(verification.identifier, existing.email)));
			await tx.update(apiKeys).set({ active: false }).where(eq(apiKeys.userId, targetId));
			await tx
				.update(user)
				.set({
					name: "Deleted user",
					email: anonymizedEmail,
					emailVerified: false,
					image: null,
					evmAddress: null,
					accountNumber: null,
					role: null,
					banned: true,
					suspended: true,
					isAnonymous: true,
					banReason: "Account deleted by administrator",
					updatedAt: new Date(),
				})
				.where(eq(user.id, targetId));
			await tx.insert(auditLogs).values({
				userId: adminId,
				action: "USER_DELETED",
				resource: "user",
				resourceId: targetId,
				metadata: {
					reason: parsed.data.reason,
					anonymized: true,
					previousRole: existing.role,
				},
				createdAt: new Date(),
			});
		});

		return c.json({ success: true, userId: targetId, anonymized: true });
	} catch (err) {
		logger.error({ err, targetId, adminId }, "[admin/users/delete] anonymization failed");
		return c.json({ error: { message: "Failed to delete user" } }, 500);
	}
});

const updateUserSchema = z.object({
  banned: z.boolean().optional(),
  suspended: z.boolean().optional(),
  role: z.string().optional(),
  creditBalanceCentsDelta: z.number().optional(),
});

// PATCH /v1/admin/users/:id — update user details (banned, suspended, role, credit balance delta)
app.patch("/v1/admin/users/:id", async (c) => {
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
app.post("/v1/admin/users/:id/credits", async (c) => {
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
app.post("/v1/admin/users/:id/suspend", async (c) => {
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
app.post("/v1/admin/users/:id/unsuspend", async (c) => {
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

}
