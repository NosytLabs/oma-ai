import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetQuotes,
  mockCreateExchange,
  mockGetOrder,
  mockGetChains,
  mockGetTokens,
  mockGetTokensForChain,
  fakeRedis,
  mockRedisClient
} = vi.hoisted(() => {
  const mockGetQuotes = vi.fn().mockResolvedValue([])
  const mockCreateExchange = vi.fn()
  const mockGetOrder = vi.fn()
  const mockGetChains = vi.fn().mockResolvedValue([])
  const mockGetTokens = vi.fn().mockResolvedValue([])
  const mockGetTokensForChain = vi.fn().mockResolvedValue([])
  const fakeRedis = new Map<string, string>()
  const mockRedisClient = {
    get: vi.fn(async (k) => fakeRedis.get(k) || null),
    set: vi.fn(async (k, v, opts) => {
      if (opts?.NX && fakeRedis.has(k)) return null;
      fakeRedis.set(k, v);
      return 'OK';
    }),
    del: vi.fn(async (keys) => {
      const count = Array.isArray(keys) ? keys.length : 1;
      if (Array.isArray(keys)) {
        keys.forEach(k => fakeRedis.delete(k));
      } else {
        fakeRedis.delete(keys);
      }
      return count;
    }),
    scan: vi.fn(async (cursor, opts) => {
      const allKeys = Array.from(fakeRedis.keys()).filter(k => k.startsWith(opts?.MATCH?.replace('*', '') ?? 'quote:'));
      if (cursor === '0') {
        return { cursor: '1', keys: allKeys.slice(0, 100) };
      }
      return { cursor: '0', keys: [] };
    }),
  }
  return { mockGetQuotes, mockCreateExchange, mockGetOrder, mockGetChains, mockGetTokens, mockGetTokensForChain, fakeRedis, mockRedisClient }
})

vi.mock('../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(mockRedisClient)
}))

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

vi.mock('viem', () => ({
  parseAbi: vi.fn(() => []),
  decodeFunctionData: vi.fn(),
  createPublicClient: vi.fn(),
  formatUnits: vi.fn((v: bigint) => v.toString()),
  http: vi.fn(),
}))

vi.mock('../credits/verify-usdc-on-chain.js', () => ({
  verifyUsdcOnChain: vi.fn().mockResolvedValue({ valid: true, txHash: '0xabc', amount: '10' }),
}))

vi.mock('../db/client.js', () => {
  const mockSelect = vi.fn().mockReturnThis()
  const mockFrom = vi.fn().mockReturnThis()
  const mockWhere = vi.fn().mockReturnThis()
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockInsert = vi.fn().mockReturnThis()
  const mockValues = vi.fn().mockReturnThis()
  const mockReturning = vi.fn().mockResolvedValue([{ id: 'test-user-id' }])
  const mockEq = vi.fn().mockReturnValue('mock-eq')
  
  return {
    db: {
      select: mockSelect,
      from: mockFrom,
      where: mockWhere,
      limit: mockLimit,
      insert: mockInsert,
      values: mockValues,
      returning: mockReturning,
      execute: vi.fn(),
    },
    eq: mockEq,
  }
})

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

vi.mock('../db/client.js', () => {
  const mockSelect = vi.fn().mockReturnThis()
  const mockFrom = vi.fn().mockReturnThis()
  const mockWhere = vi.fn().mockReturnThis()
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockInsert = vi.fn().mockReturnThis()
  const mockValues = vi.fn().mockReturnThis()
  const mockReturning = vi.fn().mockResolvedValue([{ id: 'dep-1' }])
  const mockUpdate = vi.fn().mockReturnThis()
  const mockSet = vi.fn().mockReturnThis()

  const chain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    update: mockUpdate,
    set: mockSet,
  }

  mockSelect.mockReturnValue(chain)
  mockFrom.mockReturnValue(chain)
  mockWhere.mockReturnValue(chain)
  mockLimit.mockResolvedValue([])
  mockInsert.mockReturnValue(chain)
  mockValues.mockReturnValue(chain)
  mockReturning.mockResolvedValue([{ id: 'dep-1' }])
  mockUpdate.mockReturnValue(chain)
  mockSet.mockReturnValue(chain)

  return { db: chain, getDb: () => chain }
})

vi.mock('../auth/api-keys.js', () => ({ shouldRecommendRotation: vi.fn().mockReturnValue(false), 
  validateApiKey: vi.fn().mockResolvedValue({
    id: 'key-1',
    userId: 'user-1',
    keyPrefix: 'oma_sk_',
    keyHash: 'hash',
    name: 'test',
    active: true,
    createdAt: new Date(),
  }),
  createApiKey: vi.fn(),
  listApiKeys: vi.fn().mockResolvedValue([]),
  revokeApiKey: vi.fn(),
}))

vi.mock('../auth/siwe.js', () => ({
  verifySiweMessage: vi.fn(),
  getOrCreateUser: vi.fn(),
  getNonce: vi.fn().mockResolvedValue('nonce_abc123'),
  generateSessionToken: vi.fn(),
  verifySessionToken: vi.fn(),
}))

vi.mock('../credits/index.js', () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
  preflightDeduction: vi.fn(),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
  processHoudiniDeposit: vi.fn(),
  completeHoudiniDeposit: vi.fn(),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../inference/circuit-breaker.js', () => ({
  checkCircuitBreaker: vi.fn().mockResolvedValue({ omaDepositsAllowed: true, omaBonusPercent: 5, reason: null }),
  checkOracleCircuitBreaker: vi.fn().mockResolvedValue(false),
}))

vi.mock('../routes/auth.js', () => ({
  authRoutes: new (require('hono').Hono)(),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../inference/circuit-breaker.js', () => ({
  checkCircuitBreaker: vi.fn().mockResolvedValue({ omaDepositsAllowed: true, omaBonusPercent: 5, reason: null }),
  checkOracleCircuitBreaker: vi.fn().mockResolvedValue(false),
}))

vi.mock('../credits/houdini-client.js', () => ({
  houdiniClient: {
    getTokens: mockGetTokens,
    getTokensForChain: mockGetTokensForChain,
    getChains: mockGetChains,
    getQuotes: mockGetQuotes,
    createExchange: mockCreateExchange,
    getOrder: mockGetOrder,
    getDepositStatus: mockGetOrder,
    createDeposit: vi.fn(),
  },
  SwapType: { PRIVATE: 'private', STANDARD: 'standard', DEX: 'dex' },
  OrderStatus: {
    NEW: 'NEW', WAITING: 'WAITING', CONFIRMING: 'CONFIRMING',
    EXCHANGING: 'EXCHANGING', ANONYMIZING: 'ANONYMIZING',
    FINISHED: 'FINISHED', FAILED: 'FAILED', REFUNDED: 'REFUNDED', EXPIRED: 'EXPIRED',
  },
}))

vi.mock('../inference/router.js', () => ({
  handleChatCompletion: vi.fn(),
  getModelPricing: vi.fn().mockReturnValue({
    inputPer1k: 0.001,
    outputPer1k: 0.002,
    markup: 5,
  }),
}))

vi.mock('../inference/models.js', () => ({
  getModel: vi.fn().mockReturnValue({
    id: 'llama-3.3-70b',
    provider: 'both',
    primaryProvider: 'venice',
    maxTokens: 128000,
    inputPricePer1M: 1.0,
    outputPricePer1M: 2.0,
    markupPercent: 5,
    category: 'mid',
    supportsStreaming: true,
    displayName: 'Llama 3.3 70B',
    capabilities: ['chat', 'streaming'],
    description: 'Test model',
  }),
  MODEL_CATALOG: {},
  reloadModelCatalog: vi.fn().mockResolvedValue(undefined),
  calculateCost: vi.fn().mockReturnValue({ inputCost: 0.001, outputCost: 0.002, totalCost: 0.003 }),
  estimateTokens: vi.fn().mockReturnValue(100),
  listModels: vi.fn().mockReturnValue([]),
  ensureCatalogLoaded: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../inference/venice.js', () => ({
  veniceChatCompletion: vi.fn(),
}))



vi.mock('../inference/provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
  stopBackgroundDbSync: vi.fn(),
  stopBackgroundProbing: vi.fn(),
  stopCacheCleanup: vi.fn(),
}))

vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
  tokenBucket: () => async (_c: unknown, next: () => void) => next(),
  modelRateLimit: () => async (_c: unknown, next: () => void) => next(),
  burstRateLimit: () => async (_c: unknown, next: () => void) => next(),
  expressiveRateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

vi.mock('../middleware/spend-limit.js', () => ({
  spendLimit: () => async (_c: unknown, next: () => void) => next(),
  trackSpend: vi.fn(),
}))

vi.mock('../config.js', () => ({
  config: {
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost:5432/oma_test',
    REDIS_URL: 'redis://localhost:6379',
    HOUDINI_WEBHOOK_SECRET: 'test-webhook-secret',
    HOUDINI_ADDRESS_TO: '0x1234567890abcdef1234567890abcdef12345678',
    FACILITATOR_MODE: 'mock',
    CHAIN_RPC_URL: 'https://base-rpc.publicnode.com',
    RECEIPT_HMAC_SECRET: 'test-receipt-secret-at-least-32-chars!',
    CROSSCHAIN_BLOCK_CONFIRMATIONS: 6,
    // M5: new x402 config fields
    X402_FACILITATOR_MARGIN_PERCENT: 1.5,
    X402_QUOTE_TTL_SECONDS: 60,
    X402_QUOTE_LOCK_TTL_SECONDS: 10,
    X402_MAX_QUOTE_CACHE_SIZE: 1000,
  },
}))

vi.mock('viem', () => ({
  createPublicClient: vi.fn().mockReturnValue({
    getBlockNumber: vi.fn().mockResolvedValue(200n),
    getTransactionReceipt: vi.fn().mockResolvedValue({
      blockNumber: 194n,
    }),
  }),
  http: vi.fn(),
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
}))

vi.mock('../x402/facilitator.js', async (importOriginal) => {
  const actual = await importOriginal() as { x402Routes: unknown }
  return {
    x402Routes: actual.x402Routes,
    settlePayment: vi.fn().mockReturnValue({
      settled: true,
      receipt: { id: 'mock-receipt', timestamp: Date.now() },
    }),
    verifyPayment: vi.fn().mockResolvedValue({
      valid: true,
      txHash: '0xabc123',
      amount: '15.00',
      networkId: 'base',
    }),
    getSettlementReceipt: vi.fn().mockReturnValue(null),
  }
})

import app from '../index.js'

describe('Cross-Chain x402', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeRedis.clear()
  })

  describe('POST /v1/x402/quote', () => {
    it('returns a quote for a valid model and token', async () => {
      mockGetQuotes.mockResolvedValueOnce([{
        id: 'hq-1',
        fromToken: 'btc_bitcoin',
        toToken: 'usdc_base',
        amount: '0.0001',
        estimatedAmount: '10.00',
        swapType: 'standard',
        rate: '100000',
        fee: '0.50',
      }])

      const res = await app.request('/v1/x402/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          inputTokens: 100,
          fromToken: 'btc_bitcoin',
          fromChain: 'bitcoin',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('quoteId')
      expect(body.fromToken).toBe('btc_bitcoin')
      expect(body).toHaveProperty('fromAmount')
      expect(body).toHaveProperty('totalCostUsd')
      expect(body).toHaveProperty('expiresIn')
    })

    it('returns 404 for unknown model (no HoudiniSwap route)', async () => {
      const res = await app.request('/v1/x402/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nonexistent-model',
          inputTokens: 100,
          fromToken: 'btc_bitcoin',
          fromChain: 'bitcoin',
        }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 404 when no HoudiniSwap route exists', async () => {
      mockGetQuotes.mockResolvedValueOnce([])

      const res = await app.request('/v1/x402/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          inputTokens: 100,
          fromToken: 'obscure_token',
          fromChain: 'obscure_chain',
        }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 for missing required fields', async () => {
      const res = await app.request('/v1/x402/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /v1/x402/deposit', () => {
    it('creates a deposit from a valid quote', async () => {
      mockGetQuotes.mockResolvedValueOnce([{
        id: 'hq-dep-1',
        fromToken: 'eth_ethereum',
        toToken: 'usdc_base',
        amount: '0.005',
        estimatedAmount: '15.00',
        swapType: 'standard',
        rate: '3000',
        fee: '0.30',
      }])

      const quoteRes = await app.request('/v1/x402/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          inputTokens: 100,
          fromToken: 'eth_ethereum',
          fromChain: 'ethereum',
        }),
      })
      const quoteBody = await quoteRes.json()
      const quoteId = quoteBody.quoteId

      mockCreateExchange.mockResolvedValueOnce({
        id: 'order-1',
        status: 'NEW',
        depositAddress: '0xDepositAddress',
        fromToken: 'eth_ethereum',
        toToken: 'usdc_base',
        fromAmount: '0.005',
        toAmount: '15.00',
        swapType: 'standard',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const depositRes = await app.request('/v1/x402/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      })

      expect(depositRes.status).toBe(200)
      const depositBody = await depositRes.json()
      expect(depositBody.orderId).toBe('order-1')
      expect(depositBody.depositAddress).toBe('0xDepositAddress')
    })

    it('returns 404 for unknown quoteId', async () => {
      const res = await app.request('/v1/x402/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: 'nonexistent' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 410 for expired quote', async () => {
      mockGetQuotes.mockResolvedValueOnce([{
        id: 'hq-exp-1',
        fromToken: 'eth_ethereum',
        toToken: 'usdc_base',
        amount: '0.005',
        estimatedAmount: '15.00',
        swapType: 'standard',
        rate: '3000',
        fee: '0.30',
      }])

      const quoteRes = await app.request('/v1/x402/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          inputTokens: 100,
          fromToken: 'eth_ethereum',
          fromChain: 'ethereum',
        }),
      })
      const quoteBody = await quoteRes.json()
      const quoteId = quoteBody.quoteId

      vi.useFakeTimers()
      vi.advanceTimersByTime(120_000)

      const depositRes = await app.request('/v1/x402/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      })

      vi.useRealTimers()
      expect(depositRes.status).toBe(410)
    })
  })

  describe('GET /v1/x402/deposit/:orderId/status', () => {
    it('returns settling status for pending order', async () => {
      mockGetOrder.mockResolvedValueOnce({
        id: 'order-pending',
        status: 'EXCHANGING',
        fromAmount: '0.005',
        toAmount: '15.00',
        transactionHash: null,
      })

      const res = await app.request('/v1/x402/deposit/order-pending/status')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('settling')
      expect(body.houdiniStatus).toBe('EXCHANGING')
    })

    it('returns completed status with receipt for finished order', async () => {
      mockGetOrder.mockResolvedValueOnce({
        id: 'order-done',
        status: 'FINISHED',
        fromAmount: '0.005',
        toAmount: '15.00',
        transactionHash: '0xabc123',
      })

      const res = await app.request('/v1/x402/deposit/order-done/status')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('completed')
      expect(body).toHaveProperty('receipt')
      expect(body.creditsIssued).toBe('15.00')
    })

    it('returns failed status for expired order', async () => {
      mockGetOrder.mockResolvedValueOnce({
        id: 'order-expired',
        status: 'EXPIRED',
        fromAmount: '0.005',
        toAmount: '0',
        transactionHash: null,
      })

      const res = await app.request('/v1/x402/deposit/order-expired/status')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('failed')
    })
  })

  describe('GET /v1/x402/chains', () => {
    it('returns available chains', async () => {
      mockGetChains.mockResolvedValueOnce([
        { id: 'bitcoin', name: 'Bitcoin', blockchain: 'bitcoin' },
        { id: 'ethereum', name: 'Ethereum', blockchain: 'ethereum' },
      ])

      const res = await app.request('/v1/x402/chains')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.chains).toHaveLength(2)
    })
  })

  describe('GET /v1/x402/tokens', () => {
    it('returns tokens for a chain', async () => {
      mockGetTokensForChain.mockResolvedValueOnce([
        { id: 'btc', symbol: 'BTC', name: 'Bitcoin', blockchain: 'bitcoin', decimals: 8 },
      ])

      const res = await app.request('/v1/x402/tokens?blockchain=bitcoin')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.tokens).toHaveLength(1)
    })
  })

  // POST /v1/x402/proxy/chat/completions is stubbed in facilitator.ts (returns 501).
  // The full implementation (Flow 2 in ARCHITECTURE.md §x402 & Cross-Chain Payments)
  // is deferred to Phase 2 (EIP-3009 settlement). The 402-with-payment_pending
  // contract is documented in API-DOCUMENTATION.md §6.6 and docs/page.tsx but
  // not yet wired.
})
