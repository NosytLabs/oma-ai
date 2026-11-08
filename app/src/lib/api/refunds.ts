/**
 * Refund endpoints exposed to the dashboard.
 *
 *   /v1/refunds           — user-facing list + create (session cookie)
 *
 * Browser requests go through the same-origin proxy and Better Auth's
 * HttpOnly session cookie.
 */
import { request } from "./client.js";
import { parseRefundStatus, type RefundStatus } from "./refund-status.js";

export type { RefundStatus } from "./refund-status.js";

export interface RefundRecord {
	id: string;
	usageId?: string | null;
	receiptId?: string | null;
	/** null = the server sent a refund status this client does not know. */
	status: RefundStatus | null;
	reason?: string;
	amountCents?: number | null;
	createdAt: string;
	updatedAt?: string;
	adminNote?: string | null;
}

export interface RefundListResponse {
	items: RefundRecord[];
	nextCursor: string | null;
	creditRefundsAvailable?: boolean;
}

export interface RequestRefundInput {
	usageId: string;
	reason: string;
	amountCents?: number;
}

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
		const response = await request<{ data: RefundRecord[]; creditRefundsAvailable?: unknown }>(`/v1/refunds?${qs.toString()}`);
		return {
			items: (response.data ?? []).map((item) => ({
				...item,
				// Unknown statuses stay unknown: a refund must never look
				// granted (or pending) because the server sent something new.
				status: parseRefundStatus(item.status),
			})),
			nextCursor: null,
			creditRefundsAvailable: response.creditRefundsAvailable === true,
		};
	},
};
