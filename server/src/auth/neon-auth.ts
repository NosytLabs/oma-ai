/**
 * Neon Auth JWT verification.
 *
 * Neon Auth is a managed Better Auth service attached to the Neon project
 * (provisioned via the Neon MCP: mcp__neon__provision_neon_auth). It
 * exposes a Better Auth compatible REST API and issues RS256 JWTs signed
 * by a key published at `${NEON_AUTH_URL}/.well-known/jwks.json`.
 *
 * This module verifies those tokens using `jose.createRemoteJWKSet`, which
 * fetches and caches the JWKS lazily on the first verification. Verification
 * is gated on `config.NEON_AUTH_URL` / `config.NEON_AUTH_JWKS_URL` being
 * set — when they are not configured, `verifyNeonAuthToken()` returns
 * `null` and the caller falls back to the existing HS256 path.
 *
 * IMPORTANT: this module is purely additive. It does NOT change how the
 * server's own HS256 session tokens (siwe/account-number/sso) are
 * issued or verified. The two paths run in parallel:
 *
 *   sessionAuth() → verifySessionToken (HS256, jose) → verifyNeonAuthToken
 *                  (RS256, jose remote JWKS) → 401
 *
 * Tokens issued by Neon Auth use the standard OIDC subject claim
 * (`payload.sub`) to identify the user. We expose that as `neonAuthUserId`
 * in the session context so downstream middleware / routes can distinguish
 * a Neon-Auth-authenticated request from a SIWE/Solana one.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export type NeonAuthSession = {
  /** Neon Auth user id (Better Auth user.id / OIDC `sub`). */
  neonAuthUserId: string;
  /** Email if the user signed in with email/password, undefined otherwise. */
  email: string | undefined;
};

const ISSUER_CANDIDATES = [
  () => config.NEON_AUTH_URL,
  () => {
    if (!config.NEON_AUTH_URL) return undefined;
    try {
      return new URL(config.NEON_AUTH_URL).origin + "/neondb/auth";
    } catch {
      return undefined;
    }
  },
];

let cachedJWKS: JWTVerifyGetKey | null = null;
let cachedJWKSUrl: string | null = null;

function getJWKS(): JWTVerifyGetKey | null {
  if (!config.NEON_AUTH_ENABLED) return null;
  if (!config.NEON_AUTH_JWKS_URL) return null;

  if (cachedJWKS && cachedJWKSUrl === config.NEON_AUTH_JWKS_URL) {
    return cachedJWKS;
  }

  try {
    cachedJWKS = createRemoteJWKSet(new URL(config.NEON_AUTH_JWKS_URL), {
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
    });
    cachedJWKSUrl = config.NEON_AUTH_JWKS_URL;
    return cachedJWKS;
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "[neon-auth] failed to construct JWKS",
    );
    return null;
  }
}

function pickIssuer(): string | undefined {
  for (const candidate of ISSUER_CANDIDATES) {
    const v = candidate();
    if (v) return v;
  }
  return undefined;
}

/**
 * Returns true when the Neon Auth path is configured. Use this to skip
 * importing/initializing Neon Auth machinery in tests or environments
 * that don't have the env vars set.
 */
export function isNeonAuthConfigured(): boolean {
  return Boolean(config.NEON_AUTH_ENABLED && config.NEON_AUTH_URL && config.NEON_AUTH_JWKS_URL);
}

/**
 * Verify a Neon Auth JWT. Returns the decoded session on success, `null`
 * on any verification failure. Never throws.
 *
 * Token shape (Better Auth / OIDC):
 *   {
 *     sub: string,            // user id
 *     iss: string,            // matches NEON_AUTH_URL (or origin/neondb/auth)
 *     aud: string,            // typically the project id
 *     exp: number,            // unix seconds
 *     iat: number,            // unix seconds
 *     email?: string,
 *   }
 */
export async function verifyNeonAuthToken(token: string): Promise<NeonAuthSession | null> {
  const jwks = getJWKS();
  if (!jwks) return null;

  const issuer = pickIssuer();

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, jwks, {
      ...(issuer ? { issuer } : {}),
      algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384"],
      clockTolerance: 5,
    });
    payload = verified.payload;
  } catch (err) {
    logger.debug(
      { err: err instanceof Error ? err.message : String(err) },
      "[neon-auth] jwt verification failed",
    );
    return null;
  }

  if (!payload.sub) return null;

  return {
    neonAuthUserId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}


