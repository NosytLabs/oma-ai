/**
 * Refund endpoints exposed to the dashboard.
 *
 * `/v1/refunds` is the user-facing request endpoint; the admin counterpart
 * lives at `/v1/admin/refunds`. Browser requests go through the same-origin
 * proxy and Better Auth's HttpOnly session cookie.
 */
import { request } from "./client.js";

export type RefundStatus = "pending" | "granted" | "denied";

export interface RefundRecord {
	id: string;
	usageId?: string | null;
	receiptId?: string | null;
	status: RefundStatus;
	reason?: string;
	amountCents?: number | null;
	createdAt: string;
	updatedAt?: string;
}

export interface RefundListResponse {
	items: RefundRecord[];
	nextCursor: string | null;
}

export interface RequestRefundInput {
	usageId: string;
	reason: string;
	amountCents?: number;
}

/**
 * Submit a refund request for one of the signed-in user's usage records.
 * The actual settlement is decided by an operator via `/v1/admin/refunds`.
 */
export const refunds = {
	async create(input: RequestRefundInput): Promise<RefundRecord> {
		return request<RefundRecord>("/v1/refunds", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				usageId: input.usageId,
				reason: input.reason,
				...(input.amountCents !== undefined && {
					amountCents: input.amountCents,
				}),
			}),
		});
	},
	async list(status?: RefundStatus, limit = 50): Promise<RefundListResponse> {
		const qs = new URLSearchParams({ limit: String(limit) });
		if (status) qs.set("status", status);
		return request<RefundListResponse>(`/v1/refunds?${qs.toString()}`);
	},
};
