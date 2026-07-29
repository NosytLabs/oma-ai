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
import { admin } from "./admin.js";
import { auth } from "./auth.js";

export {
  ApiError,
  BackendUnavailableError,
  request,
  type RequestOptions,
} from "./client.js";

export type {
  CreditTransaction,
  CreditTransactionsResponse,
} from "./credits.js";

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
 * Composite API object.
 * `api.balance.get()`, `api.usage.list()`, `api.models.list()`, etc.
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
};
