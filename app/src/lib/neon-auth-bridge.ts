/**
 * Neon Auth → OMA local session bridge.
 *
 * Stores the Neon Auth JWT in the same `oma_session` cookie the local
 * SIWE / account-number flows use, sets the matching `oma_session_meta`
 * marker with `authMethod: 'neon-auth'`, and exposes helpers for the
 * existing UI surfaces (account-login-modal, wallet-provider) to plug
 * into the parallel Neon Auth path.
 *
 * The bridge is intentionally minimal: the goal is for downstream
 * consumers (`api.auth.getUser`, route guards, the wallet provider) to
 * keep working unchanged. The cookie shape, the meta payload, and the
 * `getStoredSession()` JSON contract are all preserved.
 */
import {
  isNeonAuthConfigured,
  neonAuth,
  NeonAuthError,
  NeonAuthUnavailableError,
  type NeonAuthSession,
} from "./auth-client";
import { setSessionCookie, setSessionMetaCookie, deleteSessionCookie } from "./cookies";

const NEON_AUTH_META_METHOD = "neon-auth" as const;

export type BridgeResult =
  | { ok: true; session: NeonAuthSession }
  | { ok: false; error: string; code: "unconfigured" | "auth_failed" | "network" };

function persistNeonAuthSession(session: NeonAuthSession): void {
  setSessionCookie(session.token, 7);
  setSessionMetaCookie({ authMethod: NEON_AUTH_META_METHOD });
}

export const neonAuthBridge = {
  isAvailable: isNeonAuthConfigured,

  async signInWithEmailPassword(email: string, password: string): Promise<BridgeResult> {
    if (!isNeonAuthConfigured()) {
      return { ok: false, error: "Neon Auth is not configured", code: "unconfigured" };
    }
    try {
      const session = await neonAuth.signInEmailPassword({ email, password });
      persistNeonAuthSession(session);
      return { ok: true, session };
    } catch (err) {
      if (err instanceof NeonAuthUnavailableError) {
        return { ok: false, error: err.message, code: "unconfigured" };
      }
      if (err instanceof NeonAuthError) {
        return { ok: false, error: err.message, code: "auth_failed" };
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err), code: "network" };
    }
  },

  async signUpWithEmailPassword(email: string, password: string, name?: string): Promise<BridgeResult> {
    if (!isNeonAuthConfigured()) {
      return { ok: false, error: "Neon Auth is not configured", code: "unconfigured" };
    }
    try {
      const session = await neonAuth.signUpEmailPassword({ email, password, name });
      persistNeonAuthSession(session);
      return { ok: true, session };
    } catch (err) {
      if (err instanceof NeonAuthUnavailableError) {
        return { ok: false, error: err.message, code: "unconfigured" };
      }
      if (err instanceof NeonAuthError) {
        return { ok: false, error: err.message, code: "auth_failed" };
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err), code: "network" };
    }
  },

  async signInWithWallet(input: { message: string; signature: string; walletAddress: string; chainId?: number }): Promise<BridgeResult> {
    if (!isNeonAuthConfigured()) {
      return { ok: false, error: "Neon Auth is not configured", code: "unconfigured" };
    }
    try {
      const session = await neonAuth.signInWithWallet(input);
      persistNeonAuthSession(session);
      return { ok: true, session };
    } catch (err) {
      if (err instanceof NeonAuthUnavailableError) {
        return { ok: false, error: err.message, code: "unconfigured" };
      }
      if (err instanceof NeonAuthError) {
        return { ok: false, error: err.message, code: "auth_failed" };
      }
      return { ok: false, error: err instanceof Error ? err.message : String(err), code: "network" };
    }
  },

  async signOut(): Promise<void> {
    deleteSessionCookie();
  },
};

export { NEON_AUTH_META_METHOD };
