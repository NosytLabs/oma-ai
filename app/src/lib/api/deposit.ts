import { request } from "./client.js";

/**
	* localStorage key holding the user's per-deposit "seen" timestamps.
	* The server has no per-user notification read state (notifications are
	* derived from deposits on every fetch), so we track read state on the
	* client. The shape is `{ [depositId]: ISO8601-seen-at }`.
	*/
const READ_STATE_KEY = "oma.notifications.read";

function readState(): Record<string, string> {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(READ_STATE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object") return {};
		return parsed as Record<string, string>;
	} catch {
		return {};
	}
}

function writeState(state: Record<string, string>): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(READ_STATE_KEY, JSON.stringify(state));
	} catch {
		// Quota / disabled storage — silently degrade to "always unread".
	}
}

export const deposit = {
	/** USDC deposit — submit an on-chain transfer for credit settlement. */
	async usdc(amountUsd: number, txHash: string) {
		return request("/v1/deposit/usdc", {
			method: "POST",
			body: JSON.stringify({ amountUsd, txHash, network: "base" }),
		});
	},

	/** Recent deposits for the signed-in user. */
	async list() {
		return request<{ deposits: unknown[] }>("/v1/deposit/status");
	},

	/** Notifications derived from recent deposits (status changes). */
	async getNotifications() {
		const data = await request<{
			deposits: Array<{
				id: string;
				status: string;
				amountUsd: string | null;
				creditsIssued: string | null;
				txHash: string | null;
				createdAt: string;
			}>;
		}>("/v1/deposit/status");
		const depositsList = data.deposits ?? [];
		const seen = readState();
		return {
			notifications: depositsList.map((d) => ({
				id: `dep-${d.id}`,
				depositId: d.id,
				type: "deposit",
				status: d.status,
				amountUsd: d.amountUsd != null ? String(d.amountUsd) : null,
				creditsIssued: d.creditsIssued != null ? String(d.creditsIssued) : null,
				txHash: d.txHash ?? null,
				method: "usdc",
				createdAt: d.createdAt,
				notifiedAt: seen[d.id] ?? null,
			})),
		};
	},

	/**
	 * Mark a single notification (deposit) as read. Persists the seen
	 * timestamp to localStorage so the unread badge drops immediately on
	 * the next render without a server round-trip.
	 */
	async markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
		// The notification id is `dep-<depositId>`; strip the prefix so the
		// key in localStorage matches the deposit id returned by the API.
		const depositId = notificationId.startsWith("dep-")
			? notificationId.slice(4)
			: notificationId;
		const state = readState();
		state[depositId] = new Date().toISOString();
		writeState(state);
		return { success: true };
	},
};
