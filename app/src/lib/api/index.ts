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
export * from "./types.js";

/**
 * Export namespace — CSV/JSON downloads of usage, keys, and transactions.
 * The dashboard's export button streams the file via the request helper.
 */
export const exportData = {
	usage(format: "csv" | "json" = "csv") {
		return request<Blob>(`/v1/usage/export?format=${format}`, {
			method: "GET",
		}) as unknown as Promise<Blob>;
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
	creditHistory,
	credits,
	exportData,
};
