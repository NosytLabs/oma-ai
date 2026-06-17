/**
 * Neon Auth client (managed Better Auth service).
 *
 * Thin `fetch`-based wrapper over the Neon Auth REST API. We deliberately
 * do NOT depend on the `better-auth` npm package — every endpoint we use
 * is a vanilla JSON POST against `${NEON_AUTH_URL}/sign-in/...` etc. The
 * HTTP shape is stable (Better Auth REST), the dependencies stay small,
 * and we avoid pulling `better-auth` (which has a large transitive
 * surface and a hard React peer dep) into the frontend bundle.
 *
 * The session token returned from these calls is a JWT signed by the
 * remote JWKS at `${NEON_AUTH_URL}/.well-known/jwks.json`. The backend
 * verifies it via `server/src/auth/neon-auth.ts` using `jose`.
 *
 * Provisioning: Neon Auth is provisioned via the Neon MCP
 * (`mcp__neon__provision_neon_auth`) and the URL captured from
 * `mcp__neon__get_neon_auth_config → base_url`.
 *
 * Configuration: set `NEXT_PUBLIC_NEON_AUTH_URL` in `app/.env.local`.
 * When unset, `isNeonAuthConfigured()` returns false and every method
 * throws a `NeonAuthUnavailableError` — the existing SIWE / Solana /
 * account-number flows are unaffected.
 */
const NEON_AUTH_URL = process.env.NEXT_PUBLIC_NEON_AUTH_URL?.replace(/\/+$/, "") ?? "";

export class NeonAuthUnavailableError extends Error {
  constructor() {
    super("Neon Auth is not configured. Set NEXT_PUBLIC_NEON_AUTH_URL in app/.env.local.");
    this.name = "NeonAuthUnavailableError";
  }
}

export class NeonAuthError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(`[neon-auth ${status}] ${message}`);
    this.name = "NeonAuthError";
    this.status = status;
    this.body = body;
  }
}

export function isNeonAuthConfigured(): boolean {
  return Boolean(NEON_AUTH_URL);
}

export type NeonAuthSession = {
  token: string;
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
  expiresAt?: string;
};

async function neonAuthFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isNeonAuthConfigured()) throw new NeonAuthUnavailableError();
  const url = `${NEON_AUTH_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
    credentials: "include",
  });
  if (!res.ok) {
    let body: unknown = null;
    let message = res.statusText;
    try {
      body = await res.json();
      if (body && typeof body === "object") {
        const b = body as { message?: unknown; error?: unknown };
        if (typeof b.message === "string") message = b.message;
        else if (typeof b.error === "string") message = b.error;
        else if (b.error && typeof b.error === "object" && typeof (b.error as { message?: unknown }).message === "string") {
          message = (b.error as { message: string }).message;
        }
      }
    } catch {
      // Non-JSON body — keep statusText
    }
    throw new NeonAuthError(res.status, message, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type RawNeonAuthSession = {
  token?: string;
  access_token?: string;
  session?: { token?: string; access_token?: string; expires_at?: string };
  user?: { id?: string; email?: string; name?: string; image?: string };
};

function normalizeSession(raw: RawNeonAuthSession): NeonAuthSession {
  const token = raw.token ?? raw.access_token ?? raw.session?.token ?? raw.session?.access_token;
  if (!token) {
    throw new NeonAuthError(500, "Neon Auth response did not include a session token");
  }
  return {
    token,
    user: {
      id: raw.user?.id ?? "",
      email: raw.user?.email,
      name: raw.user?.name,
      image: raw.user?.image,
    },
    expiresAt: raw.session?.expires_at,
  };
}

export const neonAuth = {
  isConfigured: isNeonAuthConfigured,

  /** Email + password sign-up. Returns the issued session + user. */
  async signUpEmailPassword(input: { email: string; password: string; name?: string }): Promise<NeonAuthSession> {
    const raw = await neonAuthFetch<RawNeonAuthSession>("/sign-up/email", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return normalizeSession(raw);
  },

  /** Email + password sign-in. Returns the issued session + user. */
  async signInEmailPassword(input: { email: string; password: string }): Promise<NeonAuthSession> {
    const raw = await neonAuthFetch<RawNeonAuthSession>("/sign-in/email", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return normalizeSession(raw);
  },

  /** Sign out. Invalidates the current session on the Neon Auth side. */
  async signOut(token: string): Promise<void> {
    await neonAuthFetch<void>("/sign-out", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  /**
   * Wallet sign-in via SIWE-style message. The Neon Auth host (Better
   * Auth compatible) accepts a SIWE message + signature and returns a
   * session token. This is the wallet-→-Neon-Auth half of the wallet
   * path; the existing SIWE flow in `wallet-provider.tsx` continues to
   * call the local `/auth/verify` endpoint and is unaffected.
   */
  async signInWithWallet(input: {
    message: string;
    signature: string;
    walletAddress: string;
    chainId?: number;
  }): Promise<NeonAuthSession> {
    const raw = await neonAuthFetch<RawNeonAuthSession>("/sign-in/wallet", {
      method: "POST",
      body: JSON.stringify({
        message: input.message,
        signature: input.signature,
        address: input.walletAddress,
        chainId: input.chainId,
      }),
    });
    return normalizeSession(raw);
  },

  /**
   * Probe the JWKS endpoint. Returns `true` when the Neon Auth host
   * responds with a valid JWKS document. Used by the login UI to decide
   * whether to surface the "Sign in with Neon" option.
   */
  async ping(): Promise<boolean> {
    if (!isNeonAuthConfigured()) return false;
    try {
      const res = await fetch(`${NEON_AUTH_URL}/.well-known/jwks.json`, {
        method: "GET",
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

export type { NeonAuthSession as NeonAuthSessionExport };
