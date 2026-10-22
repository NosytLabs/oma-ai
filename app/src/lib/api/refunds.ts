/**
 * Refund endpoints exposed to the dashboard.
 *
 *   /v1/refunds           — user-facing list + create (session cookie)
 *   /v1/admin/refunds     — admin-only list + decide (session cookie or
 *                            admin API key via requireAdmin() server-side)
 *
 * Browser requests go through the same-origin proxy and Better Auth's
 * HttpOnly session cookie.
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
	adminNote?: string | null;
}

export interface RefundListResponse {
	items: RefundRecord[];
	nextCursor: string | null;
}

/**
 * Server's `GET /v1/admin/refunds` returns the unwrapped
 * `{ data: AdminRefundRecord[] }` envelope; define the admin-specific
 * shape here so the wrapper stays a single source of truth.
 */
export interface AdminRefundRecord {
	id: string;
	userId: string | null;
	usageId: string | null;
	amountCents: number;
	status: RefundStatus;
	reason: string | null;
	adminNote: string | null;
	decidedBy: string | null;
	decidedAt: string | null;
	createdAt: string;
}

export interface AdminRefundListResponse {
	data: AdminRefundRecord[];
}

export interface RequestRefundInput {
	usageId: string;
	reason: string;
	amountCents?: number;
}

export interface DecideRefundInput {
	id: string;
	decision: "granted" | "denied";
	adminNote?: string;
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
		const response = await request<{ data: RefundRecord[] }>(`/v1/refunds?${qs.toString()}`);
		return { items: response.data, nextCursor: null };
	},

	admin: {
		async list(
			status?: RefundStatus,
			limit = 100,
		): Promise<AdminRefundListResponse> {
			const qs = new URLSearchParams({ limit: String(limit) });
			if (status) qs.set("status", status);
			return request<AdminRefundListResponse>(
				`/v1/admin/refunds?${qs.toString()}`,
			);
		},
		async decide(
			input: DecideRefundInput,
		): Promise<{ ok: true; id: string; status: RefundStatus }> {
			return request<{ ok: true; id: string; status: RefundStatus }>(
				"/v1/admin/refunds",
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						id: input.id,
						decision: input.decision,
						...(input.adminNote !== undefined && {
							adminNote: input.adminNote,
						}),
					}),
				},
			);
		},
	},
};
