/**
 * Credit-history endpoints exposed to the dashboard.
 *
 * Wraps the server `GET /v1/credits/transactions` endpoint that powers
 * the Credit History table on `/dashboard/credits`. The endpoint requires
 * a bearer session token; the request helper injects it from the
 * `oma_session` cookie automatically.
 */
import { request } from "./client.js";
import type { AutoReloadSettings } from "./types.js";

export interface CreditTransaction {
	id: string;
	type: "deposit" | "usage" | "refund";
	amountCents: number;
	creditsIssued?: number;
	status: string;
	createdAt: string;
	txHash?: string | null;
	model?: string;
}

export interface CreditTransactionsResponse {
	transactions: CreditTransaction[];
}

export const creditHistory = {
	list(limit = 50) {
		return request<CreditTransactionsResponse>(
			`/v1/credits/transactions?limit=${limit}`,
		);
	},
};

/**
 * Credits namespace — credit batches (active/expired) and balance helpers.
 * The legacy `oma.getCreditBatches()` alias still works through the
 * composite `api` object in `./index.ts`.
 */
export interface PurchaseCreditsResponse {
	creditsAdded: number;
	balanceCents: string;
}

export const credits = {
	getBatches() {
		return request<{
			activeBatches: Array<{
				id: string;
				amountCents: string;
				remainingCents: string;
				expiresAt: string;
				paymentMethod: string | null;
			}>;
		}>("/v1/credits/balance");
	},

	purchase(
		amountCents: number,
		paymentMethod: "usdc" | "sol" | "oma" = "usdc",
	) {
		return request<PurchaseCreditsResponse>("/v1/credits/purchase", {
			method: "POST",
			body: JSON.stringify({ amountCents, paymentMethod }),
		});
	},

	getAutoReload() {
		return request<AutoReloadSettings>("/v1/credits/auto-reload");
	},

	updateAutoReload(settings: Partial<AutoReloadSettings>) {
		return request<AutoReloadSettings>("/v1/credits/auto-reload", {
			method: "POST",
			body: JSON.stringify(settings),
		});
	},
};
