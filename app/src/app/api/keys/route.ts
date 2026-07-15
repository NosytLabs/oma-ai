import { type NextRequest } from "next/server";
import { proxyRequest } from "@/lib/api/proxy";
import { readSessionToken } from "@/lib/cookies";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

/**
 * /api/keys — API key management.
 *
 * GET — List current user's API keys (with masked prefixes, never the secret).
 * POST — Create a new API key. Returns the plaintext secret exactly once.
 *
 * Both methods require an authenticated session. The session HttpOnly cookie
 * is translated into a Bearer token by `proxyRequest` before forwarding to
 * the Hono backend at /v1/keys. Unauthenticated callers get 401 — the
 * dashboard renders the "Sign in to manage keys" empty state on top of that.
 *
 * Defects this handler fixes (audit 2026-07-15):
 *   - /dashboard/api-keys was stuck on its loading skeleton because the
 *     client api.auth.listKeys() was calling /api/keys, which 404'd.
 *     The dashboard page deferred rendering until the useQuery resolved,
 *     and it never did. Adding this route unblocks the dashboard for both
 *     demo-mode (which short-circuits the query via DEMO_API_KEYS) and
 *     real-authed users.
 */
export const runtime = "nodejs";

const proxy = (request: NextRequest) =>
  proxyRequest(request, { backendPath: "/v1/keys", timeoutMs: 10_000 });

export const GET = withRateLimit(
  async (request: NextRequest) => {
    const session = await readSessionToken();
    if (!session) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return proxy(request);
  },
  { limiter: generalLimiter, route: "/api/keys" },
);

export const POST = withRateLimit(
  async (request: NextRequest) => {
    const session = await readSessionToken();
    if (!session) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return proxy(request);
  },
  { limiter: generalLimiter, route: "/api/keys" },
);
