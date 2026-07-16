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
export const credits = {
	getBatches() {
		// Batches live on GET /v1/credits/balance (there is no /v1/credits/batches).
		return request<{
			activeBatches?: Array<{
				id: string;
				amountCents: string;
				remainingCents: string;
				expiresAt: string;
				paymentMethod: string | null;
			}>;
		}>("/v1/credits/balance").then((data) => ({
			activeBatches: data.activeBatches ?? [],
		}));
	},

	/**
	 * Create a pending deposit intent. Credits are NOT issued until on-chain
	 * USDC confirmation — real funding is via `/deposit` (USDC on Base).
	 * Prefer routing users to `/deposit` instead of relying on this for UX.
	 */
	purchase(amountCents: number, paymentMethod: "usdc" = "usdc") {
		return request<{
			success: boolean;
			depositId: string;
			status: string;
			amountCents: number;
			paymentMethod: string;
			message?: string;
		}>("/v1/credits/purchase", {
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
