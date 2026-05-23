const API = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
const DEFAULT_TTL = 60000;
const STALE_TTL = 300000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.timestamp + entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttl = DEFAULT_TTL) {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

function invalidateCache(pattern?: string) {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(`[${status}] ${message}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('oma_session');
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!res.ok) {
    let message = res.statusText;
    let body: unknown;
    try {
      body = await res.json();
      if (body && typeof body === 'object' && 'error' in body) {
        message = (body as { error: string }).error;
      }
    } catch {}
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface NonceResponse {
  nonce: string;
}

export interface User {
  id: string;
  address: string;
  solanaAddress: string | null;
  accountNumber: string | null;
  createdAt: string;
}

export interface VerifyResponse {
  token: string;
  user: User;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

export interface BalanceResponse {
  balanceCents: string;
  totalDepositedCents: string;
  totalUsedCents: string;
  lastActivityAt: string | null;
}

export interface UsageRecord {
  id: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costCents: string;
  createdAt: string;
}

export interface UsageResponse {
  usage: UsageRecord[];
}

export interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

export interface ModelsResponse {
  object: 'list';
  data: Model[];
}

export interface DepositStatus {
  id: string;
  type?: string;
  status: 'pending' | 'settling' | 'completed' | 'failed' | 'refunded' | 'expired';
  amountUsd?: string;
  creditsIssued?: string;
  amountCents?: string;
  createdAt: string;
  settledAt?: string | null;
  txHash?: string | null;
  fromAmount?: string;
  toAmount?: string;
  houdiniStatus?: string;
  pollError?: string;
}

export interface HoudiniDepositResult {
  depositAddress: string;
  depositId: string;
  orderId: string;
}

export interface HoudiniExchangeResult {
  depositId: string;
  depositAddress: string;
  orderId: string;
  fromAmount: string;
  toAmount: string;
  status: string;
  expiresAt: string;
}

export interface PendingDeposit {
  id: string;
  type: 'usdc' | 'oma' | 'houdini';
  amountCents: string;
  status: string;
  createdAt: string;
}

export interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  blockchain: string;
  network?: string;
  logoUrl?: string;
}

export type SupportedCoin = Token;

export interface Chain {
  id: string;
  name: string;
  symbol: string;
  blockchain: string;
}

export interface Quote {
  quoteId: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  estimatedTime: number;
  swapType: string;
  slippage: number;
}

export interface Order {
  orderId: string;
  quoteId: string;
  status: OrderStatus;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  depositAddress: string;
  expiresAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'deposit_received'
  | 'swapping'
  | 'settling'
  | 'completed'
  | 'expired'
  | 'failed';

export interface HealthResponse {
  status: string;
  uptime: number;
}

export { ApiError };

export interface WalletResponse {
  address: string;
  balanceCents: number;
  totalDeposited: number;
  totalUsed: number;
  sessionLimit: number;
  sessionUsed: number;
  promoBalanceCents: number;
}

export interface PurchaseCreditsResponse {
  success: boolean;
  creditsAdded: number;
  expiresAt: string;
  depositId: string;
  paymentMethod: string;
  autoReloadEnabled: boolean;
}

export interface AutoReloadSettings {
  enabled: boolean;
  thresholdCents: number;
  reloadAmountCents: number;
  spendLimitCents: number;
  paymentMethod: string;
}

export interface Session {
  id: string;
  device: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

export const api = {
  auth: {
    getNonce(address: string) {
      return request<NonceResponse>('/auth/nonce', {
        method: 'POST',
        body: JSON.stringify({ address }),
      });
    },

    verify(message: string, signature: string, type: 'siwe') {
      return request<VerifyResponse>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ message, signature, type }),
      });
    },

    wallet(message: string, signature: string) {
      return request<WalletResponse>('/auth/wallet', {
        method: 'POST',
        body: JSON.stringify({ message, signature }),
      });
    },

    logout() {
      return request<void>('/auth/logout', { method: 'POST' });
    },

    unlinkWallet(type: 'evm') {
      return request<void>(`/auth/wallet/${type}`, { method: 'DELETE' });
    },

    getUser() {
      return request<User>('/user');
    },

    deleteAccount() {
      return request<void>('/account', { method: 'DELETE' });
    },

    createAccountNumber() {
      return request<{ accountNumber: string }>('/auth/account/create', { method: 'POST' });
    },

    loginWithAccountNumber(accountNumber: string) {
      return request<{ token: string; address: string; hasApiKey: boolean }>('/auth/account/login', {
        method: 'POST',
        body: JSON.stringify({ accountNumber }),
      });
    },

    listKeys() {
      return request<{ keys: ApiKey[] }>('/keys').then(res => res.keys);
    },
  },

  balance() {
    const cacheKey = '/v1/balance';
    const cached = getCached<BalanceResponse>(cacheKey);
    if (cached) return Promise.resolve(cached);
    return request<BalanceResponse>('/v1/balance').then(data => {
      setCache(cacheKey, data, 30000);
      return data;
    });
  },

  usage() {
    return request<UsageResponse>('/v1/usage');
  },

  models() {
    const cacheKey = '/v1/models';
    const cached = getCached<ModelsResponse>(cacheKey);
    if (cached) return Promise.resolve(cached);
    return request<ModelsResponse>('/v1/models').then(data => {
      setCache(cacheKey, data, STALE_TTL);
      return data;
    });
  },

  deposit: {
    usdc(amount: number, txHash: string) {
      invalidateCache('/v1/balance');
      return request<DepositStatus>('/v1/deposit/usdc', {
        method: 'POST',
        body: JSON.stringify({ amount, txHash }),
      });
    },

    oma(amount: number, txHash: string) {
      invalidateCache('/v1/balance');
      return request<DepositStatus>('/v1/deposit/oma', {
        method: 'POST',
        body: JSON.stringify({ amount, txHash }),
      });
    },

    houdini(fromCoin: string, amount: string, quoteId?: string, swapType?: string) {
      return request<HoudiniDepositResult>('/v1/deposit/houdini', {
        method: 'POST',
        body: JSON.stringify({ fromCoin, amount, quoteId, swapType }),
      });
    },

    status(id: string) {
      return request<DepositStatus>(`/v1/deposit/status/${id}`);
    },

    pending() {
      return request<PendingDeposit[]>('/v1/deposit/pending');
    },

    houdiniTokens(blockchain: string = 'BASE') {
      return request<Token[]>(`/v1/deposit/houdini/tokens?blockchain=${blockchain}`);
    },

    houdiniChains() {
      return request<Chain[]>('/v1/deposit/houdini/chains');
    },

    houdiniQuote(fromToken: string, toToken: string, amount: string, swapType?: string) {
      return request<Quote[]>('/v1/deposit/houdini/quote', {
        method: 'POST',
        body: JSON.stringify({ fromToken, toToken, amount, swapType }),
      });
    },

    houdiniExchange(quoteId: string, fromCoin: string, fromAmount: string, refundAddress?: string) {
      return request<HoudiniExchangeResult>('/v1/deposit/houdini/exchange', {
        method: 'POST',
        body: JSON.stringify({ quoteId, fromCoin, fromAmount, refundAddress }),
      });
    },
  },

  inference: {
    chatCompletions(body: unknown) {
      return request<unknown>('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  },

  x402: {
    verify() {
      return request<unknown>('/x402/verify', { method: 'POST' });
    },

    settle() {
      return request<unknown>('/x402/settle', { method: 'POST' });
    },
  },

  health() {
    return request<HealthResponse>('/health');
  },

  oma: {
    health: () => api.health(),
    getBalance: () => api.balance(),
    getApiKeys: () => api.auth.listKeys(),
    createApiKey: (name: string) => request<ApiKeyWithSecret>('/keys', { method: 'POST', body: JSON.stringify({ name }) }),
    revokeApiKey: (id: string) => request<void>(`/keys/${id}`, { method: 'DELETE' }),
    getUsage: () => api.usage(),
    depositUsdc: (amount: number, txHash: string) => api.deposit.usdc(amount, txHash),
    depositOma: (amount: number, txHash: string) => api.deposit.oma(amount, txHash),
    depositHoudini: (fromCoin: string, amount: string, quoteId?: string, swapType?: string) => api.deposit.houdini(fromCoin, amount, quoteId, swapType) as Promise<HoudiniDepositResult>,
    getDepositStatus: (id: string) => api.deposit.status(id),
    getSupportedCoins: (blockchain?: string) => api.deposit.houdiniTokens(blockchain),
    purchaseCredits: (amountCents: number, paymentMethod: 'usdc' | 'sol' | 'oma' = 'usdc') =>
      request<PurchaseCreditsResponse>('/v1/credits/purchase', {
        method: 'POST',
        body: JSON.stringify({ amountCents, paymentMethod }),
      }),
    getAutoReload: () => request<AutoReloadSettings>('/v1/credits/auto-reload'),
    updateAutoReload: (settings: Partial<AutoReloadSettings>) =>
      request<AutoReloadSettings>('/v1/credits/auto-reload', {
        method: 'POST',
        body: JSON.stringify(settings),
      }),
  },

  admin: {
    getStats: () => request<{
      totalUsers: number;
      totalApiKeys: number;
      totalCreditsPurchased: number;
      totalUsageThisMonth: number;
      revenue: number;
      activeUsersLast24h: number;
      providerCosts: { venice: number; openrouter: number };
    }>('/admin/stats'),

    getUsers: (page = 1, limit = 50) =>
      request<{
        users: Array<{
          id: string;
          address: string;
          solanaAddress: string | null;
          accountNumber: string | null;
          createdAt: string;
          lastActivityAt: string | null;
          balanceCredits: number;
          totalDeposited: number;
          totalUsed: number;
          totalRequests: number;
        }>;
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/admin/users?page=${page}&limit=${limit}`),

    getUserDetail: (id: string) =>
      request<{
        user: { id: string; address: string; solanaAddress: string | null; accountNumber: string | null; createdAt: string };
        balance: { balanceCredits: number; totalDeposited: number; totalUsed: number };
        apiKeys: Array<{ id: string; keyPrefix: string; name: string; active: boolean; createdAt: string; totalRequests: number; totalSpend: number }>;
        recentUsage: Array<{ id: string; model: string; provider: string; inputTokens: number; outputTokens: number; cost: number; createdAt: string }>;
        recentDeposits: Array<{ id: string; type: string; amount: number; credits: number; status: string; txHash: string | null; createdAt: string }>;
      }>(`/admin/users/${id}`),

    getUsage: (period = '30d') =>
      request<{
        period: string;
        summary: { totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number; totalCost: number; grossProfit: number; margin: string };
        byProvider: Array<{ provider: string; totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number; totalCost: number; profit: number }>;
        byModel: Array<{ model: string; provider: string; totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number }>;
        dailyUsage: Array<{ date: string; totalRequests: number; totalRevenue: number }>;
      }>(`/admin/usage?period=${period}`),

    getRevenue: (period = '30d') =>
      request<{
        period: string;
        summary: { totalRevenue: number; totalCost: number; grossProfit: number; totalDeposits: number; depositCount: number; newUsers: number };
        monthlyRevenue: Array<{ month: string; totalRevenue: number; depositCount: number }>;
      }>(`/admin/revenue?period=${period}`),

    getKeys: (page = 1, limit = 100) =>
      request<{
        keys: Array<{
          id: string;
          userId: string;
          userAddress: string;
          keyPrefix: string;
          name: string;
          active: boolean;
          createdAt: string;
          totalRequests: number;
          totalSpend: number;
          lastUsedAt: string | null;
        }>;
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/admin/keys?page=${page}&limit=${limit}`),
  },
};