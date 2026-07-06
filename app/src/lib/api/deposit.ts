import { request } from "./client.js";

export const deposit = {
	/** USDC deposit — fetch deposit address for a given amount. */
	async usdc(amount: number, txHash: string) {
		return request("/v1/deposit/usdc", {
			method: "POST",
			body: JSON.stringify({ amount, txHash }),
		});
	},

	/** OMA token deposit. */
	async oma(amount: number, txHash: string) {
		return request("/v1/deposit/oma", {
			method: "POST",
			body: JSON.stringify({ amount, txHash }),
		});
	},

	/** Deposit status by ID. */
	async status(id: string) {
		return request(`/v1/deposit/status?id=${id}`);
	},

	/** Notifications related to deposits. */
	async getNotifications() {
		return request("/v1/deposit/notifications");
	},
};
