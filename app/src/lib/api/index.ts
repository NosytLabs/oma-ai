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
import { admin } from './admin.js';
import { auth } from './auth.js';
import { balance, models, usage } from './resources.js';
import { deposit } from './deposit.js';
import { health } from './inference.js';
import { creditHistory, credits } from './credits.js';
import type {
  ApiKeyWithSecret,
  AutoReloadSettings,
  CreditBatch,
  HoudiniDepositResult,
  PurchaseCreditsResponse,
} from './types.js';
import { request } from './client.js';

export { ApiError, BackendUnavailableError, STALE_TTL } from './client.js';
export {
  getCached,
  invalidateCache,
  request,
  setCache,
} from './client.js';
export * from './types.js';
export type { CreditTransaction, CreditTransactionsResponse } from './credits.js';

/**
 * Export namespace — CSV/JSON downloads of usage, keys, and transactions.
 * The dashboard's export button streams the file via the request helper.
 */
export const exportData = {
  usage(format: 'csv' | 'json' = 'csv') {
    return request<Blob>(`/v1/usage/export?format=${format}`, {
      method: 'GET',
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
  balance: balance.get,
  usage: usage.get,
  models: models.list,
  deposit,
  health: health.get,
  creditHistory,
  credits,
  exportData,

  // Legacy aliases — prefer the namespaced versions above
  oma: {
    health: () => health.get(),
    getBalance: () => balance.get(),
    getApiKeys: () => auth.listKeys(),
    createApiKey: (name: string) =>
      request<ApiKeyWithSecret>('/keys', { method: 'POST', body: JSON.stringify({ name }) }),
    revokeApiKey: (id: string) => request<void>(`/keys/${id}`, { method: 'DELETE' }),
    updateApiKeyRateLimits: (
      id: string,
      limits: { rpm?: number; tpm?: number; expiresAt?: string },
    ) => request<void>(`/keys/${id}`, { method: 'PATCH', body: JSON.stringify(limits) }),
    getUsage: () => usage.get(),
    depositUsdc: (amount: number, txHash: string) => deposit.usdc(amount, txHash),
    depositOma: (amount: number, txHash: string) => deposit.oma(amount, txHash),
    depositHoudini: (
      fromCoin: string,
      amount: string,
      quoteId?: string,
      swapType?: string,
    ) => deposit.houdini(fromCoin, amount, quoteId, swapType) as Promise<HoudiniDepositResult>,
    getDepositStatus: (id: string) => deposit.status(id),
    getSupportedCoins: (blockchain?: string) => deposit.houdiniTokens(blockchain ?? 'base'),
    purchaseCredits: (
      amountCents: number,
      paymentMethod: 'usdc' | 'sol' | 'oma' = 'usdc',
    ) =>
      request<PurchaseCreditsResponse>('/v1/credits/purchase', {
        method: 'POST',
        body: JSON.stringify({ amountCents, paymentMethod }),
      }),
    getCreditBatches: () => request<{ activeBatches: CreditBatch[] }>('/v1/credits/balance'),
    getAutoReload: () => request<AutoReloadSettings>('/v1/credits/auto-reload'),
    updateAutoReload: (settings: Partial<AutoReloadSettings>) =>
      request<AutoReloadSettings>('/v1/credits/auto-reload', {
        method: 'POST',
        body: JSON.stringify(settings),
      }),
  },
};
