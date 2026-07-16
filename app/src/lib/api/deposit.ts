import { request } from "./client.js";

export const deposit = {
	/** USDC deposit — submit an on-chain transfer for credit settlement. */
	async usdc(amount: number, txHash: string) {
		return request("/v1/deposit/usdc", {
			method: "POST",
			body: JSON.stringify({ amount, txHash }),
		});
	},

	/** Deposit status by ID — path param (query `?id=` is ignored by the server). */
	async status(id: string) {
		return request(`/v1/deposit/status/${id}`);
	},

	/** Recent deposits for the signed-in user. */
	async list() {
		return request<{ deposits: unknown[] }>("/v1/deposit/status");
	},

	/** Notifications related to deposits. */
	async getNotifications() {
		return request("/v1/deposit/notifications");
	},
};
