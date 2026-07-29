/**
 * Per-route 2FA middleware.
 *
 * Used by sensitive operations (unlink wallet, rotate account number, disable
 * 2FA, regenerate backup codes) to require a fresh TOTP code in the
 * `X-2FA-Code` header on top of the existing session. This is how we keep
 * 2FA web-only without making every API request annoying.
 *
 * Flow:
 *   - sessionAuth first verifies the session JWT
 *   - this middleware then checks `X-2FA-Code` against the user's TOTP secret
 *   - if 2FA is not enabled for the user, the middleware is a no-op
 *
 * IMPORTANT: this is a defense-in-depth check on top of an existing session.
 * It does NOT issue a session — it gates a single request. The caller is
 * still authenticated via sessionAuth.
 */
import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { verifyTotpCode, consumeBackupCode, TwoFactorError } from "./two-factor.js";
import type { OmaEnv } from "../types.js";
import { logger } from "../lib/logger.js";

export function requireFreshTotp(options?: { allowBackupCode?: boolean; failClosed?: boolean }) {
  const allowBackupCode = options?.allowBackupCode ?? true;
  // failClosed: when true, accounts WITHOUT 2FA enrolled are rejected (403)
  // instead of passing through. Used on admin money routes when
  // config.REQUIRE_ADMIN_2FA is on, so the TOTP step-up is a hard requirement
  // rather than opt-in. When false (default), keeps the original opt-in
  // behavior but emits a WARN so non-2FA sensitive actions are auditable.
  const failClosed = options?.failClosed ?? false;
  return async (c: Context<OmaEnv>, next: Next) => {
    const userId = c.get("userId") as string | undefined;
    if (!userId) {
      return c.json({ error: { message: "Authentication required", type: "unauthorized" } }, 401);
    }

    const [user] = await db
      .select({ twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
    }
    if (!user.twoFactorEnabled) {
      if (failClosed) {
        return c.json(
          {
            error: {
              message:
                "This sensitive action requires 2FA to be enabled on your account. Enable two-factor authentication in Settings, then retry.",
              type: "authentication_error",
              code: "2fa_enrollment_required",
            },
          },
          403,
        );
      }
      // 2FA not enabled — pass through. This middleware is opt-in for users
      // who have 2FA, not a forced upgrade for everyone. Log so sensitive
      // actions by non-2FA accounts leave an audit trail.
      logger.warn({ userId, path: c.req.path }, "[requireFreshTotp] sensitive action by account without 2FA");
      await next();
      return;
    }

    const code = c.req.header("X-2FA-Code");
    if (!code) {
      return c.json(
        {
          error: {
            message: "2FA code required. Pass X-2FA-Code header (TOTP code or backup code).",
            type: "authentication_error",
            code: "2fa_required",
          },
        },
        401,
      );
    }

    try {
      // Try TOTP first (6-digit numeric). Fall back to backup code (10 hex chars)
      // if it doesn't look like a TOTP code. This lets callers pass either form
      // through the same header.
      if (/^\d{6}$/.test(code)) {
        await verifyTotpCode(userId, code);
      } else if (allowBackupCode) {
        await consumeBackupCode(userId, code);
      } else {
        await verifyTotpCode(userId, code);
      }
    } catch (err) {
      if (err instanceof TwoFactorError) {
        return c.json(
          { error: { message: err.message, type: "authentication_error", code: err.code } },
          err.httpStatus,
        );
      }
      logger.error({ err, userId }, "[requireFreshTotp] unexpected error");
      return c.json({ error: { message: "Internal error", type: "internal_error" } }, 500);
    }

    await next();
  };
}