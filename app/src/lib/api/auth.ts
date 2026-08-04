/**
 * Auth + API-key CRUD for the dashboard.
 *
 * Most auth flows (sign-in, sign-out, magic-link, anonymous, SIWE,
 * session, list-sessions, delete-account) are handled by the Better
 * Auth client — see `app/src/lib/auth-client.ts`. This module is
 * reserved for the OMA-specific server endpoints that aren't covered
 * by Better Auth: API-key CRUD + the HttpOnly `oma_api_key` cookie
 * installer that powers browser-direct SSE chat.
 */
import { request } from "./client.js";
import type { ApiKey, ApiKeyWithSecret, Session, User } from "./types.js";

export interface AuthSessionResponse {
  user: User;
}

/**
 * Fetch the current user via Better Auth's session lookup.
 * Endpoint: GET /user (server validates the Better Auth session cookie).
 */
async function getCurrentUser(): Promise<User | null> {
  try {
    return await request<User>("/user");
  } catch {
    return null;
  }
}

export const auth = {
  getUser: () => getCurrentUser(),

  listSessions(): Promise<{ sessions: Session[] }> {
    return request<{ sessions: Session[] }>("/sessions");
  },

  /** Revoke a remote session (not the current browser session). */
  revokeSession(id: string): Promise<{ success: boolean; id: string }> {
    return request<{ success: boolean; id: string }>(`/sessions/${id}`, {
      method: "DELETE",
    });
  },

  /** Revoke every other active session; keep the current device signed in. */
  revokeOtherSessions(): Promise<{ success: boolean; revokedCount: number }> {
    return request<{ success: boolean; revokedCount: number }>("/sessions", {
      method: "DELETE",
    });
  },

  listKeys(): Promise<{ keys: ApiKey[] }> {
    return request<{ keys: ApiKey[] }>("/v1/keys");
  },

  createKey(name: string): Promise<ApiKeyWithSecret> {
    return request<ApiKeyWithSecret>("/v1/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  deleteKey(id: string): Promise<{ success: boolean; id: string }> {
    return request<{ success: boolean; id: string }>(`/v1/keys/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Install the raw API key as an HttpOnly cookie so browser-direct
   * SSE chat can authenticate against the backend. The key never
   * leaves the browser except in the Set-Cookie header.
   */
  installKeyCookie(key: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>("/v1/keys/install", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
  },

  /**
   * Clear the HttpOnly API key cookie (forget the key on the
   * browser without invalidating it server-side).
   */
  logoutKeyCookie(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>("/v1/keys/logout", {
      method: "POST",
    });
  },

  /**
   * Delete the current account. The Better Auth user + all API keys
   * + credit balances are removed by the server in a single cascade.
   */
  deleteAccount(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>("/account", {
      method: "DELETE",
    });
  },

  /**
   * Wipe usage history + audit trail WITHOUT deleting the account.
   * GDPR right-to-forget for telemetry; balance and keys stay intact.
   */
  clearHistory(): Promise<{
    success: boolean;
    deleted: { usageRecords: number; auditLogs: number };
  }> {
    return request("/v1/history", { method: "DELETE" });
  },
};