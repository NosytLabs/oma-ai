/**
	* Public API surface for the oma-ai frontend.
	*
	* Single import point for components/pages:
	*   `import { api, type User, ApiError, BackendUnavailableError } from '@/lib/api';`
	*/
import { request } from "./client.js";
import { balance, models, usage } from "./resources.js";
import { creditHistory } from "./credits.js";
import { deposit } from "./deposit.js";
import { health } from "./inference.js";
import { auth } from "./auth.js";
import { refunds } from "./refunds.js";

export {
	BackendUnavailableError,
	request,
} from "./client.js";

export type {
	CreditTransaction,
} from "./credits.js";
export type {
	RefundRecord,
	RefundListResponse,
	RefundStatus,
	RequestRefundInput,
	AdminRefundRecord,
	AdminRefundListResponse,
	DecideRefundInput,
} from "./refunds.js";

export * from "./types.js";

/**
	* Export namespace — CSV/JSON downloads of usage, deposits.
	* Paths match server/src/routes/export.ts (`/v1/export/*`).
	* Downloads use the same-origin authenticated proxy.
	*/
const exportData = {
		async usageReport(format: "csv" | "json" = "csv", options: { since?: string; until?: string; signal?: AbortSignal } = {}): Promise<{ blob: Blob; rowCount: number | null; truncated: boolean }> {
			const query = new URLSearchParams({ format });
			if (options.since) query.set("since", options.since);
			if (options.until) query.set("until", options.until);
			let rowCount: number | null = null;
			let truncated = false;
			const blob = await request<Blob>(`/v1/export/usage?${query}`, {
				method: "GET", responseType: "blob", signal: options.signal,
				onResponseHeaders: headers => {
					const count = headers.get("X-Export-Row-Count");
					if (count && /^\d+$/.test(count) && Number.isSafeInteger(Number(count))) rowCount = Number(count);
					truncated = headers.get("X-Export-Truncated") === "true";
				},
			});
			return { blob, rowCount, truncated };
		},
		deposits(format: "csv" | "json" = "csv") {
				return request<Blob>(`/v1/export/deposits?format=${format}`, {
						method: "GET",
						responseType: "blob",
				});
		},
		summary(format: "csv" | "json" = "csv") {
				return request<Blob>(`/v1/export/summary?format=${format}`, {
						method: "GET",
						responseType: "blob",
				});
		},
		/**
			* Full GDPR Article 15/20 data-export bundle: profile + API keys
			* (no secrets) + usage records + deposits + credit balance + audit
			* log + active sessions. Always JSON, always triggers a server-side
			* DATA_EXPORT_REQUESTED audit row. Returned as a Blob so the browser
			* triggers a download via anchor.click().
			*/
		accountBundle() {
				return request<Blob>("/v1/export/account", {
						method: "GET",
						responseType: "blob",
				});
		},
};

/**
	* Composite API object.
	* `api.balance.get()`, `api.usage.list()`, `api.models.list()`, etc.
	*/
export const api = {
	auth,
	balance,
	usage,
	models,
	deposit,
	healthPing: health.ping,
	creditHistory,
	refunds,
	exportData,
};
