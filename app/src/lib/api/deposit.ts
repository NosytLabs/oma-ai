import { request } from "./client.js";

export const deposit = {
	/** USDC deposit — submit an on-chain transfer for credit settlement. */
	async usdc(amount: number, txHash: string) {
		return request("/v1/deposit/usdc", {
			method: "POST",
			body: JSON.stringify({ amount, txHash }),
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
				notifiedAt: null,
			})),
		};
	},
};
