/**
 * Public API surface for the oma-ai frontend.
 *
 * Single import point for components/pages:
 *   `import { api, type User, ApiError, BackendUnavailableError } from '@/lib/api';`
 *
 * Internally split into per-resource modules under `./api/*` for maintainability.
 * This barrel re-exports `api` (the object surface), all response types, and
 * the two error classes. Adding a new endpoint means: add it to the relevant
 * `api/*.ts` module, then add the namespace here.
 */
import { admin } from "./admin.js";
import { auth } from "./auth.js";
import { request } from "./client.js";
import { creditHistory, credits } from "./credits.js";
import { deposit } from "./deposit.js";
import { health } from "./inference.js";
import { polar } from "./polar.js";
import { balance, models, usage } from "./resources.js";

export {
	ApiError,
	BackendUnavailableError,
	getAuthToken,
	setAuthToken,
} from "./client.js";
export type {
	CreditTransaction,
	CreditTransactionsResponse,
} from "./credits.js";
export {
	PolarNotConfiguredError,
	polar,
	type PolarOrder,
	type PolarOrdersResponse,
	type PolarPlan,
	type PolarPlansResponse,
	type PolarSubscription,
	type PolarSubscriptionResponse,
} from "./polar.js";
export * from "./types.js";

/**
 * Export namespace — CSV/JSON downloads of usage, deposits.
 * Paths match server/src/routes/export.ts (`/v1/export/*`).
 * Dashboard ExportDataButton also hits these via same-origin fetch.
 */
export const exportData = {
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
};

/**
 * Composite API object. Mirrors the old monolith shape so existing
 * `api.auth.foo()`, `api.deposit.bar()` call sites keep working.
 */
export const api = {
	admin,
	auth,
	balance,
	usage,
	models,
	deposit,
	health: health.get,
	healthPing: health.ping,
	creditHistory,
	credits,
	exportData,
	polar,
};
