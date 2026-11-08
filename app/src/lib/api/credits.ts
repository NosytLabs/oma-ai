/**
	* Credit-history endpoints exposed to the dashboard.
	*
	* Wraps the server `GET /v1/credits/transactions` endpoint that powers
	* the credit history in `/dashboard?tab=overview`. Browser requests use the
	* same-origin proxy and Better Auth's HttpOnly session cookie; API callers
	* may instead provide an OMA API key.
	*/
import { request } from "./client.js";
import { parseDepositStatus, type DepositStatus } from "./deposit-status.js";
import { parseUsageStatus, type UsageStatus } from "./usage-status.js";

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

/**
 * The status vocabulary a credit row belongs to.
 *
 * The credit feed mixes three kinds of row, and each kind has its own
 * vocabulary: deposits carry deposit statuses, usage and refunds carry
 * usage statuses. The row type decides which one applies.
 */
export type CreditTransactionStatus = DepositStatus | UsageStatus;

/**
 * The row's status, narrowed to the vocabulary its type owns.
 *
 * Returns null when the server sends a status the row type should never
 * carry, so callers render it as unknown instead of quietly treating it as
 * "completed".
 */
export function creditTransactionStatus(
	tx: CreditTransaction,
): CreditTransactionStatus | null {
	return tx.type === "deposit"
		? parseDepositStatus(tx.status)
		: parseUsageStatus(tx.status);
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
