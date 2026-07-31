/**
 * Better Auth — server-side instance for the Next.js app.
 *
 * The same Better Auth configuration as `server/src/auth.ts`. We point
 * this at the Hono backend (which owns the DB) by using a fetch-style
 * trusted `baseURL` — Next.js server components call `auth.api.getSession`
 * with a forwarded cookie header, and Better Auth validates the same
 * HttpOnly session cookie the Hono handler set.
 *
 * In dev: BASE_URL defaults to the API port so the same Postgres-backed
 * user store is the source of truth across both runtimes.
 */
import { betterAuth } from "better-auth";
import { magicLink, anonymous, siwe } from "better-auth/plugins";
import type { NextRequest } from "next/server";

const BETTER_AUTH_URL =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

const BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ??
  "dev-better-auth-secret-change-me-in-prod-32ch";

export const auth = betterAuth({
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  basePath: "/api/auth",
  emailAndPassword: { enabled: false },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // The Hono server is the canonical sender; this is a fallback
        // for local dev where the Next process needs to log the link
        // directly. In production, the magic link is sent by the API
        // server (server/src/auth.ts -> sendMagicLink).
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log(`[Better Auth/magicLink] (next dev) ${email} -> ${url}`);
        }
      },
      expiresIn: 60 * 5,
    }),
    anonymous({
      emailDomainName: "guest.oma-ai.com",
    }),
    siwe({
      domain: process.env.NEXT_PUBLIC_PRIMARY_DOMAIN ?? "oma-ai.com",
      emailDomainName: "oma-ai.com",
      anonymous: false,
      getNonce: async () => {
        // Delegated to the Hono server. The Next process uses the
        // shared cookie contract; SIWE nonces are issued by /api/auth.
        return "";
      },
      verifyMessage: async ({ message, signature, address }) => {
        try {
          const { verifyMessage: viemVerify } = await import("viem");
          return await viemVerify({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
          });
        } catch {
          return false;
        }
      },
    }),
  ],
});

/**
 * Server-side getSession call that forwards the cookie to the canonical
 * Hono backend. The local Better Auth instance has no DB configured
 * (it's a thin proxy) — going through HTTP keeps DB state in one place.
 *
 * Returns null on any error (treat as not-authed; middleware will
 * redirect to /login?next=…).
 */
export async function getSessionViaBackend(
  request: Request | NextRequest,
): Promise<{ user?: { id?: string; role?: string | null } } | null> {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  // Direct backend call (server-to-server). In dev this hits localhost:3001.
  const target = `${BETTER_AUTH_URL.replace(/\/$/, "")}/api/auth/get-session`;
  try {
    const res = await fetch(target, {
      method: "GET",
      headers,
      cache: "no-store",
      // Avoid hanging if the API is offline — bubble up as null session.
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { id?: string; role?: string | null } } | null;
    return data;
  } catch {
    return null;
  }
}
