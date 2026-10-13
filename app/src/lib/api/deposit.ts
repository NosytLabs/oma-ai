import { request } from "./client.js";

export interface DepositInstructions {
	depositAddress: string;
	network: string;
	chainId: number;
	usdcContract: string;
	minDepositCents: number;
	maxDepositCents: number;
	creditsPerCent: number;
}

export interface UserDeposit {
	id: string;
	status: "pending" | "settling" | "completed" | "failed" | "refunded" | "expired";
	amountUsd: string;
	txHash: string | null;
	depositAddress: string | null;
	createdAt: string;
	completedAt: string | null;
}

export interface DepositSubmission {
	amountUsd: number;
	txHash: string;
	fromAddress: `0x${string}`;
	challengeToken: string;
	signature: string;
}

/**
	* localStorage key holding the user's per-status deposit "seen" timestamps.
	* The server has no per-user notification read state (notifications are
	* derived from deposits on every fetch), so we track read state on the
	* client, scoped by account. The shape is `{ [depositId:status]: ISO8601-seen-at }`.
	*/
const READ_STATE_KEY = "oma.notifications.read";

function readState(userId: string): Record<string, string> {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(`${READ_STATE_KEY}:u:${userId}`);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object") return {};
		return parsed as Record<string, string>;
	} catch {
		return {};
	}
}

function writeState(userId: string, state: Record<string, string>): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(`${READ_STATE_KEY}:u:${userId}`, JSON.stringify(state));
	} catch {
		// Quota / disabled storage — silently degrade to "always unread".
	}
}

export const deposit = {
	async instructions() {
		return request<DepositInstructions>("/v1/deposit/usdc");
	},
	async challenge(fromAddress: `0x${string}`) {
		return request<{ token: string; nonce: string; expiresAt: number }>("/v1/deposit/usdc/challenge", {
			method: "POST", body: JSON.stringify({ fromAddress }),
		});
	},
	/** USDC deposit — submit an on-chain transfer for credit settlement. */
	async usdc(args: DepositSubmission) {
		return request<{ depositId: string; status: UserDeposit["status"]; amountCents: number; txHash: string; network: string; message: string }>("/v1/deposit/usdc", {
			method: "POST",
			body: JSON.stringify({ ...args, network: "base" }),
		});
	},

	/** Recent deposits for the signed-in user. */
	async list() {
		return request<{ deposits: UserDeposit[] }>("/v1/deposit/status");
	},

	/** Notifications derived from recent deposits (status changes). */
	async getNotifications(userId: string, signal?: AbortSignal) {
		const data = await request<{
			deposits: Array<{
				id: string;
				status: string;
				amountUsd: string | null;
				creditsIssued: string | null;
				txHash: string | null;
				createdAt: string;
				completedAt?: string | null;
			}>;
		}>("/v1/deposit/status", { signal });
		const depositsList = data.deposits ?? [];
		const seen = readState(userId);
		return {
			notifications: depositsList.map((d) => ({
				id: `dep-${d.id}:${d.status}`,
				depositId: d.id,
				type: "deposit",
				status: d.status,
				amountUsd: d.amountUsd != null ? String(d.amountUsd) : null,
				creditsIssued: d.creditsIssued != null ? String(d.creditsIssued) : null,
				txHash: d.txHash ?? null,
				method: "usdc",
				createdAt: d.status === "completed" ? d.completedAt ?? d.createdAt : d.createdAt,
				notifiedAt: seen[`${d.id}:${d.status}`] ?? null,
			})),
		};
	},

	/**
	 * Mark a single deposit status as read. Persists the seen
	 * timestamp to localStorage so the unread badge drops immediately on
	 * the next render without a server round-trip.
	 */
	async markNotificationRead(notificationId: string, userId: string): Promise<{ success: boolean }> {
		// Keep the status in the key so a later completion remains unread.
		const statusKey = notificationId.startsWith("dep-")
			? notificationId.slice(4)
			: notificationId;
		const state = readState(userId);
		state[statusKey] = new Date().toISOString();
		writeState(userId, state);
		return { success: true };
	},
};
