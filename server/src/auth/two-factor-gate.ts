/**
 * Centralized 2FA gate.
 *
 * Pulls the 2FA-decrypt, TOTP-verify, fail-counter, and replay-window
 * logic out of `auth/middleware.ts` (where it was a ~50-line inline block)
 * and out of `auth/two-factor.ts` (where it lives for /auth/2fa/* routes
 * and the per-route `requireFreshTotp` middleware). Both call sites
 * need exactly the same primitives:
 *
 *   1. Decrypt the user's stored TOTP secret.
 *   2. Verify a candidate TOTP code against the secret.
 *   3. Reject code-replay within the 30-second step window.
 *   4. Rate-limit failed attempts (5 per 5 minutes, atomic).
 *
 * Putting them here gives the middleware and the route layer a single
 * place to evolve, and a single place to unit-test the rate-limit /
 * replay-window logic. Importantly, this also fixes the gap where
 * `auth/middleware.ts#sessionAuth` did NOT enforce the replay window
 * (the inline path used `authenticator.verify` with no follow-up
 * `lastUsedStep` check), even though the standalone `verifyTotpCode`
 * helper did. The middleware would happily accept a code that had
 * been used in the last 30 seconds if it was still within the otplib
 * `window: 1` tolerance.
 */
import { authenticator } from "@otplib/preset-default";
import { getRedisClient } from "../lib/redis-client.js";
import { decryptSecret } from "./encryption.js";
import { logger } from "../lib/logger.js";

const FAIL_KEY = (userId: string) => `2fa_fail:${userId}`;
const LAST_STEP_KEY = (userId: string) => `2fa:laststep:${userId}`;

const FAIL_LIMIT = 5;
const FAIL_TTL_SECONDS = 300;
const STEP_TTL_SECONDS = 120;

export function decryptTwoFactorSecret(stored: string | null | undefined): string {
  if (!stored) {
    throw new Error("missing secret");
  }
  const record = JSON.parse(stored) as { encrypted: string; iv: string; authTag: string };
  return decryptSecret(record.encrypted, record.iv, record.authTag);
}

export function isValidTOTPWindow(code: string, secret: string): boolean {
  return authenticator.verify({ token: code, secret });
}

export function currentTOTPStep(): number {
  return Math.floor(Date.now() / 1000 / 30);
}

export async function readLastUsedTOTPStep(userId: string): Promise<number | null> {
  const redis = await getRedisClient();
  if (!redis) return null;
  const raw = await redis.get(LAST_STEP_KEY(userId));
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function markTwoFactorStep(userId: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;
  const step = currentTOTPStep();
  const last = await readLastUsedTOTPStep(userId);
  if (last !== null && step <= last) {
    return false;
  }
  await redis.setEx(LAST_STEP_KEY(userId), STEP_TTL_SECONDS, String(step));
  return true;
}

/**
 * Atomically check the 2FA fail counter for the user and bump it on
 * a new attempt. Returns the post-bump count. Returns `null` if Redis
 * is unreachable — callers should fail closed (treat as auth failure).
 */
export async function bumpTwoFactorFailCount(userId: string): Promise<number | null> {
  const redis = await getRedisClient();
  if (!redis) return null;
  const key = FAIL_KEY(userId);
  const nx = await redis.set(key, "1", { NX: true, EX: FAIL_TTL_SECONDS });
  if (nx === "OK") return 1;
  return redis.incr(key);
}

export async function clearTwoFactorFailCount(userId: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  await redis.del(FAIL_KEY(userId));
}

export const TWO_FA_FAIL_LIMIT = FAIL_LIMIT;
export const TWO_FA_FAIL_TTL_SECONDS = FAIL_TTL_SECONDS;

/**
 * Result envelope for {@link enforceTwoFactor}. The caller turns this
 * into a Hono JSON response with the appropriate status code.
 */
export type TwoFactorGateResult =
  | { ok: true }
  | { ok: false; status: 401 | 429 | 500 | 503; message: string; code?: string };

/**
 * Full 2FA gate: rate limit, decrypt, TOTP verify, replay protection.
 * Resets the fail counter on success. Returns a structured result so
 * the calling middleware can build the HTTP response without having to
 * reproduce the rate-limit / replay / decrypt plumbing.
 */
export async function enforceTwoFactor(
  userId: string,
  twoFactorSecret: string | null | undefined,
  providedCode: string | undefined,
): Promise<TwoFactorGateResult> {
  if (!providedCode) {
    return { ok: false, status: 401, message: "2FA code required", code: "2fa_required" };
  }
  if (!twoFactorSecret) {
    return { ok: false, status: 500, message: "Failed to decrypt 2FA secret" };
  }

  const count = await bumpTwoFactorFailCount(userId);
  if (count === null) {
    return { ok: false, status: 503, message: "Authentication service unavailable" };
  }
  if (count > FAIL_LIMIT) {
    return { ok: false, status: 429, message: "Too many 2FA attempts", code: "2fa_brute_force" };
  }

  let secret: string;
  try {
    secret = decryptTwoFactorSecret(twoFactorSecret);
  } catch (err) {
    logger.error({ err, userId }, "[two-factor-gate] decrypt failed");
    return { ok: false, status: 500, message: "Failed to decrypt 2FA secret" };
  }

  if (!isValidTOTPWindow(providedCode, secret)) {
    return { ok: false, status: 401, message: "Invalid 2FA code" };
  }

  if (!(await markTwoFactorStep(userId))) {
    return { ok: false, status: 401, message: "Code already used. Wait for the next 30-second window.", code: "2fa_replay" };
  }

  await clearTwoFactorFailCount(userId);
  return { ok: true };
}
