/**
 * `api.oma` namespace — convenience facade for the dashboard pages.
 *
 * These methods are thin wrappers over the auth, credits, and usage routes.
 * The dashboard call sites were written against an `api.oma.*` shape; this
 * module materializes that shape so the rest of the public API surface
 * (auth / balance / usage / etc.) stays unchanged.
 *
 * Every method is a 1:1 mapping to a real backend endpoint — no client-side
 * fan-out or caching beyond the TTL the underlying namespace already has.
 */
import { request } from './client.js';
import type {
  ApiKey,
  ApiKeyWithSecret,
  AutoReloadSettings,
  BalanceResponse,
  CreditBatch,
  PurchaseCreditsResponse,
  UsageRecord,
} from './types.js';

interface BalanceEnvelope extends BalanceResponse {
  activeBatches?: CreditBatch[];
}

interface RecentUsageEnvelope {
  records: UsageRecord[];
  count: number;
}

interface RateLimitUpdate {
  rpm?: number;
  tpm?: number;
  expiresAt?: string;
}

export const oma = {
  // ── API keys ──────────────────────────────────────────────────────────────
  async getApiKeys(): Promise<ApiKey[]> {
    const res = await request<{ keys: ApiKey[] }>('/keys');
    return res.keys;
  },

  async createApiKey(name: string): Promise<ApiKeyWithSecret> {
    return request<ApiKeyWithSecret>('/keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async revokeApiKey(keyId: string): Promise<void> {
    await request<{ success: boolean }>(`/keys/${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
    });
  },

  async updateApiKeyRateLimits(keyId: string, limits: RateLimitUpdate): Promise<void> {
    await request<{ success: boolean }>(`/keys/${encodeURIComponent(keyId)}`, {
      method: 'PATCH',
      body: JSON.stringify(limits),
    });
  },

  // ── Credits / Balance ─────────────────────────────────────────────────────
  async getBalance(): Promise<BalanceResponse> {
    const res = await request<BalanceEnvelope>('/v1/credits/balance');
    // activeBatches is returned alongside; strip it so callers see the strict
    // BalanceResponse shape. Use getCreditBatches() for the batch list.
    const { activeBatches: _ignored, ...rest } = res;
    return rest;
  },

  async getCreditBatches(): Promise<{ activeBatches: CreditBatch[] }> {
    const res = await request<BalanceEnvelope>('/v1/credits/balance');
    return { activeBatches: res.activeBatches ?? [] };
  },

  // ── Usage ─────────────────────────────────────────────────────────────────
  async getUsage(): Promise<{ usage: UsageRecord[] }> {
    const res = await request<RecentUsageEnvelope>('/v1/usage/recent');
    return { usage: res.records };
  },

  // ── Purchase / Auto-reload ────────────────────────────────────────────────
  async purchaseCredits(
    amountCents: number,
    paymentMethod: 'usdc' | 'oma' = 'usdc',
  ): Promise<PurchaseCreditsResponse> {
    // The /v1/credits/purchase endpoint creates a deposit row and returns
    // its id; the deposit then settles asynchronously via the USDC webhook.
    // We surface the depositId as `depositId` and `creditsIssued` cents as
    // `creditsAdded` (cents → whole credits, matching the dashboard UI).
    const res = await request<{
      success: boolean;
      depositId: string;
      amountCents: number;
      creditsIssued: number;
      expiresAt: string;
      paymentMethod: string;
      autoReloadEnabled: boolean;
      message: string;
    }>('/v1/credits/purchase', {
      method: 'POST',
      body: JSON.stringify({ amountCents, paymentMethod }),
    });
    return {
      success: res.success,
      depositId: res.depositId,
      creditsAdded: Math.floor(res.creditsIssued / 100),
      expiresAt: res.expiresAt,
      paymentMethod: res.paymentMethod,
      autoReloadEnabled: res.autoReloadEnabled,
    };
  },

  async updateAutoReload(
    settings: Partial<AutoReloadSettings> & { enabled: boolean },
  ): Promise<AutoReloadSettings> {
    return request<AutoReloadSettings>('/v1/credits/auto-reload', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },
};
