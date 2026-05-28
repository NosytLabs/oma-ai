import { getSessionToken } from './cookies';

// API client with optimized caching and request deduplication

const API = typeof window !== 'undefined' 
  ? '/api' 
  : (process.env.NEXT_PUBLIC_API_URL || process.env.OPENAI_BASE_URL || 'http://localhost:3001');

// Request deduplication - prevents duplicate concurrent requests
const pendingRequests = new Map<string, Promise<unknown>>();

// Generic response cache with TTL support
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 60000; // 60 seconds default cache TTL
const STALE_TTL = 300000;  // 5 minutes for stale-while-revalidate

// Custom error class for API errors with proper typing
export class ApiError extends Error {
  status: number;
  body: unknown;
  isNetworkError: boolean;

  constructor(status: number, message: string, body?: unknown, isNetworkError = false) {
    super(`[${status}] ${message}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.isNetworkError = isNetworkError;
  }
}

export class BackendUnavailableError extends Error {
  constructor() {
    super('Backend server is not running. Please ensure the API server is started on port 3001.');
    this.name = 'BackendUnavailableError';
  }
}

/**
 * Get cached data by key with TTL validation.
 * Returns null if entry doesn't exist or is expired.
 */
function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Set cache entry with optional custom TTL.
 */
function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  cache.set(key, { 
    data, 
    timestamp: Date.now(), 
    ttl 
  });
}

/**
 * Invalidate cache entries by pattern or completely clear.
 */
function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

/**
 * Get session token from cookies with SSR safety.
 */
function getSessionTokenFromCookies(): string | null {
  if (typeof window === 'undefined') return null;
  return getSessionToken();
}

/**
 * Core request function with:
 * - Request deduplication (prevents duplicate concurrent requests)
 * - Abort controller with configurable timeout
 * - Proper error handling with typed ApiError
 * - Automatic cleanup of pending requests
 */
async function request<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  // Create unique request key for deduplication
  const requestKey = `${opts.method || 'GET'}:${path}`;
  
  // Return existing pending request if available (deduplication)
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey) as Promise<T>;
  }
  
  const token = getSessionTokenFromCookies();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };

  // Add auth header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Abort controller for request timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const fetchPromise = (async () => {
    try {
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
        } catch {
          // Response body is not JSON, use status text
        }
        throw new ApiError(res.status, message, body);
      }

      if (res.status === 204) return undefined as T;
      
      const data = await res.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new BackendUnavailableError();
      }
      if (error instanceof ApiError) throw error;
      throw error;
    }
  })();

  pendingRequests.set(requestKey, fetchPromise);
  
  try {
    return await fetchPromise;
  } finally {
    pendingRequests.delete(requestKey);
  }
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

export interface CreditBatch {
  id: string;
  amountCents: string;
  remainingCents: string;
  expiresAt: string;
  paymentMethod: string | null;
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
  version: string;
  service: string;
  uptime: number;
  correlationId: string;
  checks: {
    redis?: { status: string; latency?: number };
    database?: { status: string; latency?: number };
    venice?: { status: string; latency?: number };
  };
}

export interface X402VerifyResponse {
  valid: boolean;
  address?: string;
  error?: string;
}

export interface X402SettleResponse {
  settled: boolean;
  receipt?: string;
  error?: string;
}

export interface ChatCompletionsResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

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

    solana: {
      getChallenge(address: string) {
        return request<{ message: string }>('/auth/solana/challenge', {
          method: 'POST',
          body: JSON.stringify({ address }),
        });
      },
      verify(address: string, message: string, signature: string) {
        return request<{ token: string }>('/auth/solana/verify', {
          method: 'POST',
          body: JSON.stringify({ address, message, signature }),
        });
      },
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

    getCsrfToken() {
      return request<{ token: string }>('/auth/csrf-token');
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
      setCache(cacheKey, data, 120000);
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

    getStatus() {
      return request<{
        deposits: Array<{
          id: string;
          type: string;
          status: string;
          amountUsd: string;
          creditsIssued: string;
          txHash: string | null;
          createdAt: string;
          completedAt: string | null;
        }>;
      }>('/v1/deposit/status');
    },

    getById(depositId: string) {
      return request<{
        deposit: {
          id: string;
          type: string;
          status: string;
          amountUsd: string;
          creditsIssued: string;
          txHash: string | null;
          houdiniId: string | null;
          createdAt: string;
          completedAt: string | null;
        };
        retryStatus: {
          attempts: number;
          canRetry: boolean;
          nextRetryAt: string | null;
          status: string;
        } | null;
      }>(`/v1/deposit/${depositId}`);
    },

    retry(depositId: string) {
      return request<{ success: boolean; message: string }>(
        `/v1/deposit/${depositId}/retry`,
        { method: 'POST' }
      );
    },

    getNotifications() {
      return request<{
        notifications: Array<{
          id: string;
          depositId: string;
          type: string;
          status: string;
          amountUsd: string | null;
          creditsIssued: string | null;
          txHash: string | null;
          method: string | null;
          createdAt: string;
          notifiedAt: string | null;
        }>;
      }>('/v1/notifications');
    },
  },

  inference: {
    chatCompletions(body: unknown) {
      return request<ChatCompletionsResponse>('/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  },

  x402: {
    verify() {
      return request<X402VerifyResponse>('/x402/verify', { method: 'POST' });
    },

    settle() {
      return request<X402SettleResponse>('/x402/settle', { method: 'POST' });
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
    getCreditBatches: () => request<{ activeBatches: CreditBatch[] }>('/v1/credits/balance'),
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

  webhooks: {
    list() {
      return request<{
        subscriptions: Array<{
          id: string;
          url: string;
          event: string;
          events: string[];
          active: boolean;
          lastNotificationAt: string | null;
          lastNotificationStatus: string | null;
          notificationCount: number;
          createdAt: string;
        }>;
      }>('/v1/webhooks');
    },

    create(data: { url: string; events?: string[]; secret?: string }) {
      return request<{ id: string; success: boolean }>('/v1/webhooks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    delete(subscriptionId: string) {
      return request<{ success: boolean }>(
        `/v1/webhooks/${subscriptionId}`,
        { method: 'DELETE' }
      );
    },
  },

  recoveries: {
    list() {
      return request<{
        recoveries: Array<{
          id: string;
          originalTxHash: string;
          recoveryTxHash: string | null;
          amountUsd: string;
          status: string;
          rejectionReason: string | null;
          createdAt: string;
          completedAt: string | null;
        }>;
      }>('/v1/recoveries');
    },

    initiate(data: { wrongNetworkTxHash: string; recoveryTxHash: string }) {
      return request<{
        success: boolean;
        recoveryId: string;
        creditsRecovered: number;
      }>('/v1/recoveries', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    scan(address: string) {
      return request<{
        deposits: Array<{
          txHash: string;
          amount: string;
          fromAddress: string;
          toAddress: string;
          blockNumber: string;
          timestamp: string;
        }>;
      }>(`/v1/recoveries/scan?address=${address}`);
    },
  },
};