/**
 * Auth namespace: SIWE + account-number login + API key listing.
 */

import { request } from "./client.js";
import type {
	ApiKey,
	ApiKeyWithSecret,
	NonceResponse,
	Session,
	User,
	VerifyResponse,
	WalletResponse,
} from "./types.js";

/**
 * Auth requests must go through the Next.js /api/* proxy in the browser so
 * that cookies (csrf_token, oma_session) live on the same origin as the
 * page. Direct cross-origin calls to the backend would carry cookies under
	 * localhost only, and the auth/CSRF round-trip would fail.
 */
const isBrowser = () => typeof window !== "undefined";

/**
 * Map backend paths through /api/... proxy in browser so cookies live
 * on the same origin (localhost:3399) instead of the backend port (3001).
 */
const p = (path: string) => (isBrowser() ? `/api${path}` : path);

export const auth = {
	getCsrfToken() {
		return request<{ token: string }>(p("/auth/csrf-token"));
	},

	createAccountNumber() {
		return request<{ accountNumber: string }>(p("/auth/account/create"), {
			method: "POST",
		});
	},

	loginWithAccountNumber(accountNumber: string) {
		return request<{ token: string; address: string; hasApiKey: boolean }>(
			p("/auth/account/login"),
			{
				method: "POST",
				body: JSON.stringify({ accountNumber }),
			},
		);
	},

	getNonce(address: string) {
		return request<NonceResponse>(p("/auth/nonce"), {
			method: "POST",
			body: JSON.stringify({ address }),
		});
	},

	verify(message: string, signature: string, type: "siwe") {
		return request<VerifyResponse>(p("/auth/verify"), {
			method: "POST",
			body: JSON.stringify({ message, signature, type }),
		});
	},

	wallet(message: string, signature: string) {
		return request<WalletResponse>(p("/auth/wallet"), {
			method: "POST",
			body: JSON.stringify({ message, signature }),
		});
	},

	logout() {
		return request<void>(p("/auth/logout"), { method: "POST" });
	},

	unlinkWallet(type: "evm") {
		return request<void>(p(`/auth/wallet/${type}`), { method: "DELETE" });
	},

	/**
	 * Returns the signed-in user, or `null` when there is no session.
	 * The Next proxy responds 204 for anonymous callers (avoids console
	 * 401 noise on every public page). The core client maps 204 → undefined.
	 */
	getUser() {
		return request<User | undefined>(p("/user")).then((u) => u ?? null);
	},

	deleteAccount() {
		return request<void>(p("/account"), { method: "DELETE" });
	},

	listKeys() {
		// Server returns `keyPrefix`; UI/types use `prefix`. Normalize here.
		return request<{
			keys: Array<ApiKey & { keyPrefix?: string; active?: boolean }>;
		}>(p("/keys")).then((res) =>
			(res.keys ?? []).map((k) => ({
				id: k.id,
				name: k.name,
				prefix: k.prefix || k.keyPrefix || "",
				createdAt: k.createdAt,
				lastUsedAt: k.lastUsedAt ?? null,
			})),
		);
	},

	listSessions() {
		// Backend multi-session list is not shipped yet. Avoid a guaranteed
		// 404 round-trip that only shows up as console noise; settings builds
		// a "this device" fallback client-side.
		return Promise.resolve([] as Session[]);
	},

	/**
	 * Enter read-only demo mode. There is no backend `/auth/demo` endpoint —
	 * demo is a middleware cookie set when the user lands on a protected path
	 * with `?demo=1` (see `src/middleware.ts`). This helper just navigates.
	 */
	startDemo() {
		if (typeof window !== "undefined") {
			window.location.assign("/dashboard?demo=1");
		}
		return Promise.resolve({ success: true as const, expiresIn: 86_400 });
	},

	createKey(name: string) {
		return request<ApiKeyWithSecret>(p("/keys"), {
			method: "POST",
			body: JSON.stringify({ name }),
		});
	},

	deleteKey(id: string) {
		return request<void>(p(`/keys/${id}`), { method: "DELETE" });
	},

	updateKeyRateLimits(
		id: string,
		limits: { rpm?: number; tpm?: number; expiresAt?: string },
	) {
		return request<void>(p(`/keys/${id}`), {
			method: "PATCH",
			body: JSON.stringify(limits),
		});
	},

	setup2FA() {
		return request<{
			secret: string;
			qrCodeDataUrl: string;
			otpauthUri: string;
			backupCodes: string[];
		}>(p("/auth/2fa/setup"), { method: "POST" });
	},

	verify2FA(code: string) {
		return request<{ success: boolean }>(p("/auth/2fa/verify"), {
			method: "POST",
			body: JSON.stringify({ code }),
		});
	},

	disable2FA(code: string) {
		return request<{ success: boolean }>(p("/auth/2fa/disable"), {
			method: "POST",
			body: JSON.stringify({ code }),
		});
	},

	getBackupCodes() {
		return request<{ backupCodes: string[]; remaining: number }>(
			p("/auth/2fa/backup-codes"),
			{ method: "GET" },
		);
	},
};
