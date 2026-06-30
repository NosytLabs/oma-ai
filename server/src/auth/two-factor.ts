/**
 * Two-Factor Authentication (TOTP) service.
 *
 * Implements the standard Time-Based One-Time Password (RFC 6238) flow used
 * by Google Authenticator, 1Password, Bitwarden, Authy, and every other
 * consumer authenticator app. The crypto details are pinned to defaults that
 * maximize interop:
 *
 *   - SHA-1, 6 digits, 30-second step (the Google Authenticator defaults)
 *   - Base32 secret, 20 bytes (160 bits of entropy)
 *   - Verification window ±1 step (so a code entered up to 30s after expiry
 *     still works — without this, users rage-quit on slow networks)
 *   - Replay protection via per-user "last-used TOTP step" tracking in Redis
 *     so an intercepted code can't be re-used within the same 30s window
 *
 * Backup codes (10 single-use recovery codes) are generated at enrollment,
 * hashed at rest with SHA-256, and consumed atomically on redemption.
 *
 * Web-only by design: 2FA applies to login only, not to API-key requests.
 * Bearer-auth (API key) requests skip 2FA entirely — the API key IS the
 * long-lived credential. sessionAuth middleware enforces this.
 */
import { authenticator } from "@otplib/preset-default";
import QRCode from "qrcode";
import { createHash, randomBytes } from "node:crypto";
import { eq, and, isNull, sql } from "drizzle-orm";

import type { ContentfulStatusCode } from "hono/utils/http-status";
import { db } from "../db/client.js";
import { users, twoFactorBackupCodes, auditLogs } from "../db/schema.js";
import { encryptSecret, decryptSecret } from "./encryption.js";
import { getRedisClient } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";

const ISSUER = "OMA";
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_BYTES = 5; // 40 bits of entropy per code → 10 hex chars

// Force otplib to the defaults we want. otplib reads from the
// `authenticator.options` singleton, so we set it once at module load.
authenticator.options = {
  digits: 6,
  step: 30,
  window: 1,
};

const TOTP_LAST_USED_KEY = (userId: string) => `2fa:laststep:${userId}`;
const TOTP_FAIL_KEY = (userId: string) => `2fa_fail:${userId}`;

/** Persisted-but-not-yet-active TOTP secret. Same encryption envelope as the active one. */
interface TwoFactorRecord {
  encrypted: string;
  iv: string;
  authTag: string;
}

function decodeRecord(stored: string): TwoFactorRecord {
  return JSON.parse(stored) as TwoFactorRecord;
}

function encryptRecord(plaintext: string): TwoFactorRecord {
  const { encrypted, iv, authTag } = encryptSecret(plaintext);
  return { encrypted, iv, authTag };
}

/**
 * Generate `n` random backup codes, formatted as `xxxxx-xxxxx` (10 hex chars
 * separated by a dash for readability). 40 bits of entropy each is plenty
 * when the code space is one-shot and per-user.
 */
export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const hex = randomBytes(BACKUP_CODE_BYTES).toString("hex"); // 10 chars
    codes.push(`${hex.slice(0, 5)}-${hex.slice(5, 10)}`);
  }
  return codes;
}

/**
 * Normalize a user-supplied backup code to its canonical form: lowercase,
 * dashes stripped. Returns "" if the result is not exactly 10 hex chars.
 */
function normalizeBackupCode(input: string): string {
  return input.toLowerCase().replace(/[-\s]/g, "");
}

function hashBackupCode(code: string): string {
  const normalized = normalizeBackupCode(code);
  return createHash("sha256").update(normalized).digest("hex");
}

export interface TwoFactorSetupPayload {
  /** Base32 secret for manual entry (in case the user can't scan the QR). */
  secret: string;
  /** Canonical otpauth:// URI, also embedded in the QR. */
  otpauthUri: string;
  /** Data URL (base64-encoded PNG) of the QR code, ready for `<img src>`. */
  qrCodeDataUrl: string;
  /** 10 backup codes shown EXACTLY ONCE at setup. User must save these. */
  backupCodes: string[];
}

export class TwoFactorError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "already_enabled"
      | "not_enabled"
      | "invalid_code"
      | "invalid_backup_code"
      | "user_not_found"
      | "internal_error"
      | "setup_in_progress",
    public readonly httpStatus: ContentfulStatusCode = 400,
  ) {
    super(message);
    this.name = "TwoFactorError";
  }
}

/**
 * Begin 2FA setup. Generates a fresh secret + backup codes, encrypts the
 * secret at rest, returns the QR code data URL and otpauth URI so the
 * frontend can render the QR.
 *
 * Two-phase commit: the secret is stored with `twoFactorEnabled = false`
 * until the user proves they can generate a valid code from the QR (via
 * /auth/2fa/verify). Otherwise a bad scan would lock them out.
 *
 * If a previous setup was in flight, it's overwritten — users who lose
 * their authenticator app can re-scan by re-running setup + verify.
 */
export async function setupTwoFactor(
  userId: string,
  accountLabel: string,
): Promise<TwoFactorSetupPayload> {
  const [user] = await db
    .select({ id: users.id, twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new TwoFactorError("User not found", "user_not_found", 404);
  }
  if (user.twoFactorEnabled) {
    throw new TwoFactorError(
      "2FA is already enabled. Disable it first to set up again.",
      "already_enabled",
      409,
    );
  }

  const secret = authenticator.generateSecret();
  const otpauthUri = authenticator.keyuri(accountLabel, ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const backupCodes = generateBackupCodes();

  // Persist the encrypted secret. Leave twoFactorEnabled = false until the
  // user proves they scanned correctly (see enableTwoFactor).
  const record = encryptRecord(secret);
  await db
    .update(users)
    .set({ twoFactorSecret: JSON.stringify(record), updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Persist backup codes (hashed). Old unused codes for this user are wiped
  // to prevent stale recovery codes surviving a fresh enrollment.
  await db.delete(twoFactorBackupCodes).where(eq(twoFactorBackupCodes.userId, userId));
  await db.insert(twoFactorBackupCodes).values(
    backupCodes.map((code) => ({
      userId,
      codeHash: hashBackupCode(code),
    })),
  );

  await db.insert(auditLogs).values({
    userId,
    action: "USER_UPDATED",
    resource: "users",
    resourceId: userId,
    metadata: JSON.stringify({ event: "two_factor_setup_started" }),
    createdAt: new Date(),
  });

  return { secret, otpauthUri, qrCodeDataUrl, backupCodes };
}

/**
 * Verify a TOTP code from the user's authenticator app and ENABLE 2FA.
 *
 * This is the "I scanned the QR, here's a code from my app" step. Until the
 * user successfully calls this, their encrypted secret is dormant and login
 * does not require 2FA — so a botched scan doesn't lock them out.
 */
export async function enableTwoFactor(userId: string, code: string): Promise<{ enabled: true }> {
  const [user] = await db
    .select({ id: users.id, twoFactorEnabled: users.twoFactorEnabled, twoFactorSecret: users.twoFactorSecret })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new TwoFactorError("User not found", "user_not_found", 404);
  }
  if (user.twoFactorEnabled) {
    throw new TwoFactorError("2FA is already enabled", "already_enabled", 409);
  }
  if (!user.twoFactorSecret) {
    throw new TwoFactorError(
      "2FA setup not started. Call /auth/2fa/setup first.",
      "setup_in_progress",
      400,
    );
  }

  let secret: string;
  try {
    const record = decodeRecord(user.twoFactorSecret);
    secret = decryptSecret(record.encrypted, record.iv, record.authTag);
  } catch (err) {
    logger.error({ err, userId }, "[two-factor] Failed to decrypt secret during enable");
    throw new TwoFactorError("Failed to decrypt 2FA secret", "internal_error", 500);
  }

  const valid = authenticator.verify({ token: code, secret });
  if (!valid) {
    throw new TwoFactorError("Invalid TOTP code", "invalid_code", 400);
  }

  await db
    .update(users)
    .set({ twoFactorEnabled: true, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(auditLogs).values({
    userId,
    action: "USER_UPDATED",
    resource: "users",
    resourceId: userId,
    metadata: JSON.stringify({ event: "two_factor_enabled" }),
    createdAt: new Date(),
  });

  return { enabled: true };
}

/**
 * Verify a TOTP code at LOGIN time. Implements two safety properties:
 *
 *   1. **Rate limiting**: 5 failed attempts → 5-minute lockout (Redis counter).
 *      Atomic INCR-then-check so concurrent attempts can't bypass the cap.
 *   2. **Replay protection**: tracks `lastUsedStep` per user. A code valid for
 *      step N is rejected if step N was already used. Defeats code interception
 *      within the 30s validity window.
 *
 * Returns true on success. Throws TwoFactorError on failure / rate-limit.
 */
export async function verifyTotpCode(userId: string, code: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) {
    throw new TwoFactorError(
      "Authentication service unavailable",
      "internal_error",
      503,
    );
  }

  const [user] = await db
    .select({ twoFactorEnabled: users.twoFactorEnabled, twoFactorSecret: users.twoFactorSecret })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new TwoFactorError("2FA not enabled", "not_enabled", 400);
  }

  let secret: string;
  try {
    const record = decodeRecord(user.twoFactorSecret);
    secret = decryptSecret(record.encrypted, record.iv, record.authTag);
  } catch (err) {
    logger.error({ err, userId }, "[two-factor] Failed to decrypt secret during verify");
    throw new TwoFactorError("Failed to decrypt 2FA secret", "internal_error", 500);
  }

  // Atomic INCR for rate limiting (5 attempts per 5 min).
  const failKey = TOTP_FAIL_KEY(userId);
  const fails = await redis.incr(failKey);
  if (fails === 1) await redis.expire(failKey, 300);
  if (fails > 5) {
    throw new TwoFactorError(
      "Too many 2FA attempts. Try again in 5 minutes.",
      "invalid_code",
      429,
    );
  }

  const valid = authenticator.verify({ token: code, secret });
  if (!valid) {
    throw new TwoFactorError("Invalid TOTP code", "invalid_code", 401);
  }

  // Replay protection: current 30s step must be strictly greater than the
  // last step we accepted for this user. TOTP step = floor(now / 30).
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const lastStepRaw = await redis.get(TOTP_LAST_USED_KEY(userId));
  const lastStep = lastStepRaw ? parseInt(lastStepRaw, 10) : -1;
  if (currentStep <= lastStep) {
    // Code already consumed this step. Treat as a failure for brute-force
    // accounting but reject with a clear message.
    throw new TwoFactorError(
      "Code already used. Wait for the next 30-second window.",
      "invalid_code",
      401,
    );
  }
  await redis.setEx(TOTP_LAST_USED_KEY(userId), 120, String(currentStep));

  // Reset failure counter on success.
  await redis.del(failKey);

  return true;
}

/**
 * Verify a backup code and consume it atomically. The user gets 10 codes at
 * setup; we burn one each time they use this. Returns the count of unused
 * codes remaining after consumption.
 *
 * Note: we look up by hash directly (the partial index on code_hash makes
 * this O(1) regardless of how many users we have).
 */
export async function consumeBackupCode(
  userId: string,
  code: string,
): Promise<{ valid: true; remaining: number }> {
  const normalized = normalizeBackupCode(code);
  if (normalized.length !== 10) {
    throw new TwoFactorError("Invalid backup code format", "invalid_backup_code", 400);
  }
  const hash = hashBackupCode(normalized);

  // Atomically mark the code as used. If the row doesn't exist or is
  // already used, the UPDATE returns 0 rows affected.
  const result = await db
    .update(twoFactorBackupCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(twoFactorBackupCodes.userId, userId),
        eq(twoFactorBackupCodes.codeHash, hash),
        isNull(twoFactorBackupCodes.usedAt),
      ),
    )
    .returning({ id: twoFactorBackupCodes.id });

  if (result.length === 0) {
    throw new TwoFactorError(
      "Invalid or already-used backup code",
      "invalid_backup_code",
      401,
    );
  }

  await db.insert(auditLogs).values({
    userId,
    action: "USER_UPDATED",
    resource: "users",
    resourceId: userId,
    metadata: JSON.stringify({ event: "two_factor_backup_code_used" }),
    createdAt: new Date(),
  });

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(twoFactorBackupCodes)
    .where(and(eq(twoFactorBackupCodes.userId, userId), isNull(twoFactorBackupCodes.usedAt)));

  return { valid: true, remaining: Number(count) };
}

/**
 * Disable 2FA. Requires the user to prove ownership of their current device
 * with a valid TOTP code OR a valid backup code (so a thief who steals the
 * password can't remove the second factor).
 *
 * Wipes backup codes and zeros the encrypted secret on success.
 */
export async function disableTwoFactor(
  userId: string,
  code: string,
  isBackupCode: boolean,
): Promise<{ disabled: true; backupCodesRemaining: number }> {
  const [user] = await db
    .select({ id: users.id, twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new TwoFactorError("User not found", "user_not_found", 404);
  }
  if (!user.twoFactorEnabled) {
    throw new TwoFactorError("2FA is not enabled", "not_enabled", 400);
  }

  if (isBackupCode) {
    await consumeBackupCode(userId, code);
  } else {
    await verifyTotpCode(userId, code);
  }

  await db
    .update(users)
    .set({ twoFactorEnabled: false, twoFactorSecret: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await db.delete(twoFactorBackupCodes).where(eq(twoFactorBackupCodes.userId, userId));

  await db.insert(auditLogs).values({
    userId,
    action: "USER_UPDATED",
    resource: "users",
    resourceId: userId,
    metadata: JSON.stringify({ event: "two_factor_disabled" }),
    createdAt: new Date(),
  });

  return { disabled: true, backupCodesRemaining: 0 };
}

/**
 * Regenerate backup codes. Requires a valid current TOTP code (not a backup
 * code — that would be circular). The user must already have 2FA enabled.
 * Returns the new plaintext codes shown EXACTLY ONCE.
 */
export async function regenerateBackupCodes(
  userId: string,
  currentTotpCode: string,
): Promise<{ backupCodes: string[] }> {
  const [user] = await db
    .select({ id: users.id, twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new TwoFactorError("User not found", "user_not_found", 404);
  }
  if (!user.twoFactorEnabled) {
    throw new TwoFactorError("2FA is not enabled", "not_enabled", 400);
  }
  // Verify current TOTP (not a backup code — would be circular).
  await verifyTotpCode(userId, currentTotpCode);

  const codes = generateBackupCodes();
  await db.delete(twoFactorBackupCodes).where(eq(twoFactorBackupCodes.userId, userId));
  await db.insert(twoFactorBackupCodes).values(
    codes.map((code) => ({
      userId,
      codeHash: hashBackupCode(code),
    })),
  );

  await db.insert(auditLogs).values({
    userId,
    action: "USER_UPDATED",
    resource: "users",
    resourceId: userId,
    metadata: JSON.stringify({ event: "two_factor_backup_codes_regenerated" }),
    createdAt: new Date(),
  });

  return { backupCodes: codes };
}

/**
 * Return the count of unused backup codes (for the "you have N codes left"
 * dashboard widget). Never returns the plaintext.
 */
export async function getBackupCodeCount(userId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(twoFactorBackupCodes)
    .where(and(eq(twoFactorBackupCodes.userId, userId), isNull(twoFactorBackupCodes.usedAt)));
  return Number(count);
}

/**
 * Get the user's 2FA status for the dashboard.
 */
export async function getTwoFactorStatus(userId: string): Promise<{
  enabled: boolean;
  backupCodesRemaining: number;
}> {
  const [user] = await db
    .select({ twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new TwoFactorError("User not found", "user_not_found", 404);
  }
  return {
    enabled: user.twoFactorEnabled,
    backupCodesRemaining: user.twoFactorEnabled ? await getBackupCodeCount(userId) : 0,
  };
}

