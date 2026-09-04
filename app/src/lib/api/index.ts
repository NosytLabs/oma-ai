/**
	* Public API surface for the oma-ai frontend.
	*
	* Single import point for components/pages:
	*   `import { api, type User, ApiError, BackendUnavailableError } from '@/lib/api';`
	*/
import { request } from "./client.js";
import { balance, models, usage } from "./resources.js";
import { credits, creditHistory } from "./credits.js";
import { deposit } from "./deposit.js";
import { health } from "./inference.js";
import { auth } from "./auth.js";

export {
	BackendUnavailableError,
	request,
} from "./client.js";

export type {
		CreditTransaction,
} from "./credits.js";

export * from "./types.js";

/**
	* Export namespace — CSV/JSON downloads of usage, deposits.
	* Paths match server/src/routes/export.ts (`/v1/export/*`).
	* Dashboard ExportDataButton also hits these via same-origin fetch.
	*/
const exportData = {
		usage(format: "csv" | "json" = "csv") {
				return request<Blob>(`/v1/export/usage?format=${format}`, {
						method: "GET",
						responseType: "blob",
				});
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
	credits,
	exportData,
};
