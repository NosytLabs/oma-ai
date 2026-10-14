/**
	* Credit-history endpoints exposed to the dashboard.
	*
	* Wraps the server `GET /v1/credits/transactions` endpoint that powers
	* the credit history in `/dashboard?tab=overview`. Browser requests use the
	* same-origin proxy and Better Auth's HttpOnly session cookie; API callers
	* may instead provide an OMA API key.
	*/
import { request } from "./client.js";

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
