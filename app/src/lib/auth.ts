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
        // eslint-disable-next-line no-console
        console.log(`[Better Auth/magicLink] (next dev) ${email} -> ${url}`);
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
