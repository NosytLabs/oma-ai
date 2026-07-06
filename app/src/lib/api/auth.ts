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

	getUser() {
		return request<User>(p("/user"));
	},

	deleteAccount() {
		return request<void>(p("/account"), { method: "DELETE" });
	},

	listKeys() {
		return request<{ keys: ApiKey[] }>(p("/keys")).then((res) => res.keys);
	},

	listSessions() {
		return request<{ sessions: Session[] }>(p("/auth/sessions")).then(
			(res) => res.sessions,
		);
	},

	startDemo() {
		return request<{ success: boolean; expiresIn: number }>(p("/auth/demo"), {
			method: "POST",
		});
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
