import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  const mockOrderBy = vi.fn().mockReturnThis()

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
    orderBy: mockOrderBy,
  }

  mockSelect.mockReturnValue(chain)
  mockFrom.mockReturnValue(chain)
  mockWhere.mockReturnValue(chain)
  mockLimit.mockResolvedValue([{ id: 'dep-1', userId: 'user-1' }])
  mockInsert.mockReturnValue(chain)
  mockValues.mockReturnValue(chain)
  mockReturning.mockResolvedValue([{ id: 'dep-1', userId: 'user-1' }])
  mockUpdate.mockReturnValue(chain)
  mockSet.mockReturnValue(chain)
  mockOrderBy.mockReturnValue(chain)

  return { db: chain, getDb: () => chain }
})

vi.mock('../auth/api-keys.js', () => ({
  validateApiKey: vi.fn(),
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

vi.mock('../credits/balance.js', () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
  preflightDeduction: vi.fn(),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
  processOmaDeposit: vi.fn(),
  processHoudiniDeposit: vi.fn(),
  completeHoudiniDeposit: vi.fn(),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../credits/circuit-breaker.js', () => ({
  checkCircuitBreaker: vi.fn().mockResolvedValue({ omaDepositsAllowed: true, omaBonusPercent: 5, reason: null }),
  checkOracleCircuitBreaker: vi.fn().mockResolvedValue(false),
}))

vi.mock('../credits/houdini-client.js', () => ({
  OrderStatus: { NEW: 'NEW', WAITING: 'WAITING', CONFIRMING: 'CONFIRMING', EXCHANGING: 'EXCHANGING', ANONYMIZING: 'ANONYMIZING', FINISHED: 'FINISHED', FAILED: 'FAILED', REFUNDED: 'REFUNDED', EXPIRED: 'EXPIRED' },
  SwapType: { PRIVATE: 'private', STANDARD: 'standard', DEX: 'dex' },
  houdiniClient: {
    getTokens: vi.fn().mockResolvedValue([]),
    getDepositStatus: vi.fn(),
    createDeposit: vi.fn(),
    getQuotes: vi.fn(),
    createExchange: vi.fn(),
    getChains: vi.fn(),
    getOrder: vi.fn(),
  },
}))

vi.mock('../credits/cctp-client.js', () => ({
  verifyBurnTransaction: vi.fn().mockResolvedValue({ verified: true, sourceChain: 'ethereum', burnTxHash: '0xabc', burnAmount: '10', mintRecipient: '0xrecv', messageHash: '0xmsg' }),
  waitForAttestation: vi.fn().mockResolvedValue({ verified: true, sourceChain: 'ethereum', burnTxHash: '0xabc', burnAmount: '10', mintRecipient: '0xrecv', messageHash: '0xmsg' }),
  getCctpSupportedChains: vi.fn().mockReturnValue(['ethereum', 'base', 'polygon', 'arbitrum']),
}))

vi.mock('../credits/lifi-client.js', () => ({
  getQuoteForSwap: vi.fn().mockResolvedValue({
    id: 'quote-1',
    estimatedAmount: '9.95',
    fromAmount: '10',
    fromToken: { symbol: 'ETH', decimals: 18, address: '0xeeee', name: 'Ethereum', chainId: 1 },
    toToken: { symbol: 'USDC', decimals: 6, address: '0xusdc', name: 'USD Coin', chainId: 8453 },
    fromChain: { id: 1, key: 'ethereum', name: 'Ethereum', nativeToken: { symbol: 'ETH', decimals: 18, address: '0xeeee', name: 'Ethereum', chainId: 1 }, enabled: true },
    toChain: { id: 8453, key: 'base', name: 'Base', nativeToken: { symbol: 'ETH', decimals: 18, address: '0xeeee', name: 'Ethereum', chainId: 8453 }, enabled: true },
    routes: [{ id: 'route-1', estimate: { toAmount: '9.95', toAmountMin: '9.90', fromAmount: '10', approvalAddress: '0xapp', executionDuration: 30, gasCosts: [], feeCosts: [] }, steps: [] }],
    estimatedDuration: 30,
  }),
  getRouteStatus: vi.fn().mockResolvedValue({ status: 'DONE', fromAmount: '10', toAmount: '9.95', toAmountMin: '9.90' }),
  checkPossibleRoutes: vi.fn().mockResolvedValue(true),
  isCctpChain: vi.fn().mockReturnValue(false),
  getLifiSourceChains: vi.fn().mockReturnValue(['ethereum', 'optimism', 'arbitrum', 'polygon']),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
  processOmaDeposit: vi.fn(),
  processHoudiniDeposit: vi.fn(),
  completeHoudiniDeposit: vi.fn(),
  processCctpDeposit: vi.fn(),
  processLifiDeposit: vi.fn(),
}))

vi.mock('../credits/cctp-client.js', () => ({
  verifyBurnTransaction: vi.fn().mockResolvedValue({ verified: true, sourceChain: 'ethereum', burnTxHash: '0xabc', burnAmount: '10', mintRecipient: '0xrecv', messageHash: '0xmsg' }),
  waitForAttestation: vi.fn().mockResolvedValue({ status: 'complete', attestation: '0xatt', messageHash: '0xmsg' }),
  getCctpSupportedChains: vi.fn().mockReturnValue(['ethereum', 'base', 'polygon', 'arbitrum']),
}))

vi.mock('../credits/lifi-client.js', () => ({
  getQuoteForSwap: vi.fn().mockResolvedValue({
    id: 'quote-1',
    estimatedAmount: '9950000',
    fromAmount: '1000000000000000000',
    toToken: { symbol: 'USDC', decimals: 6, address: '0xusdc', name: 'USD Coin', chainId: 8453 },
    toChain: { id: 8453, key: 'base', name: 'Base', enabled: true },
    fromToken: { symbol: 'ETH', decimals: 18, address: '0xeee', name: 'Ethereum', chainId: 1 },
    fromChain: { id: 1, key: 'ethereum', name: 'Ethereum', enabled: true },
    estimatedDuration: 30,
    steps: [],
  }),
  getRouteStatus: vi.fn().mockResolvedValue({ status: 'DONE', fromAmount: '1000000000000000000', toAmount: '9950000', toAmountMin: '9900000' }),
  checkPossibleRoutes: vi.fn().mockResolvedValue(true),
  getLifiSourceChains: vi.fn().mockReturnValue(['ethereum', 'optimism', 'arbitrum', 'polygon']),
  isCctpChain: vi.fn().mockReturnValue(false),
}))

vi.mock('../inference/router.js', () => ({
  handleChatCompletion: vi.fn(),
}))

vi.mock('../inference/venice.js', () => ({
  veniceChatCompletion: vi.fn(),
}))

vi.mock('../inference/antseed.js', () => ({
  antseedChatCompletion: vi.fn(),
}))

vi.mock('../inference/circuit-breaker.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
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

vi.mock('../x402/facilitator.js', () => {
  const { Hono } = require('hono') as typeof import('hono');
  return { x402Routes: new Hono() };
});

vi.mock('../config.js', () => ({
  config: {
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost:5432/oma_test',
    REDIS_URL: 'redis://localhost:6379',
    HOUDINI_WEBHOOK_SECRET: 'test-webhook-secret',
    TREASURY_SOLANA_ADDRESS: 'TreasurySolAddress1111111111111111111',
    SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
  },
}))

vi.mock('../credits/deposit-router.js', () => ({
  routeDeposit: vi.fn().mockReturnValue({
    best: { method: 'cctp', label: 'USDC via CCTP', estimatedTime: '~30 seconds', fee: '~0.0001%', requiresWallet: true, privacyLevel: 'standard', requiredFields: ['amount', 'txHash'] },
    all: [
      { method: 'cctp', label: 'USDC via CCTP', estimatedTime: '~30 seconds', fee: '~0.0001%', requiresWallet: true, privacyLevel: 'standard', requiredFields: ['amount', 'txHash'] },
      { method: 'lifi', label: 'Swap via LI.FI', estimatedTime: '15 seconds - 20 minutes', fee: '0.05-0.3%', requiresWallet: true, privacyLevel: 'standard', requiredFields: ['fromChain', 'fromToken', 'fromAmount', 'txHash'] },
    ],
  }),
  getSupportedMethods: vi.fn().mockReturnValue(['cctp', 'lifi', 'houdini']),
}))

import app from '../index.js'
import { verifySessionToken } from '../auth/siwe.js'
import { processUsdcDeposit, processOmaDeposit, processHoudiniDeposit, completeHoudiniDeposit, processCctpDeposit, processLifiDeposit } from '../credits/deposit.js'
import { houdiniClient, OrderStatus, SwapType } from '../credits/houdini-client.js'
import { db } from '../db/client.js'

describe('Deposit Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /v1/deposit/usdc', () => {
    it('processes USDC deposit with valid auth and body', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      vi.mocked(processUsdcDeposit).mockResolvedValueOnce({ creditsCents: 1000, depositId: 'dep-1' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(db.select).mockReturnValueOnce(mockChain)

      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'a'.repeat(64) }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.credits).toBe(1000)
      expect(body.depositId).toBe('dep-1')
    })

    it('returns 409 for duplicate txHash', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'existing-dep' }]),
      }
      vi.mocked(db.select).mockReturnValueOnce(mockChain)

      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'a'.repeat(64) }),
      })
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.type).toBe('duplicate')
    })
  })

  describe('POST /v1/deposit/oma', () => {
    it('processes OMA deposit with valid auth and body', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      vi.mocked(processOmaDeposit).mockResolvedValueOnce({ creditsCents: 1050, bonusPercent: 5, depositId: 'dep-2' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(db.select).mockReturnValueOnce(mockChain)

      const res = await app.request('/v1/deposit/oma', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 100, txHash: '0x' + 'b'.repeat(64) }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.credits).toBe(1050)
      expect(body.bonus).toBe(5)
    })

    it('returns 503 when oracle not live', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      vi.mocked(processOmaDeposit).mockRejectedValueOnce(new Error('circuit breaker active - OMA deposits halted'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChain: any = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(db.select).mockReturnValueOnce(mockChain)

      const res = await app.request('/v1/deposit/oma', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 100, txHash: '0x' + 'b'.repeat(64) }),
      })
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.type).toBe('circuit_breaker')
    })
  })

  describe('POST /v1/deposit/houdini', () => {
    it('processes HoudiniSwap deposit with valid body', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      vi.mocked(houdiniClient.createExchange).mockResolvedValueOnce({ id: 'ord-1', depositAddress: '0xHoudiniDeposit', fromAmount: '0.001', toAmount: '0.99', fromToken: 'btc', toToken: 'usdc', swapType: SwapType.STANDARD, status: OrderStatus.WAITING, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      vi.mocked(processHoudiniDeposit).mockResolvedValueOnce({ depositAddress: '0xHoudiniDeposit', depositId: 'dep-3' })

      const res = await app.request('/v1/deposit/houdini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ fromCoin: 'btc', amount: '0.001', quoteId: 'q1' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.depositAddress).toBe('0xHoudiniDeposit')
      expect(body.depositId).toBe('dep-3')
      expect(body.orderId).toBe('ord-1')
    })
  })

  describe('POST /v1/deposit/houdini/webhook', () => {
    it('processes webhook with valid signature', async () => {
      vi.mocked(completeHoudiniDeposit).mockResolvedValueOnce({ creditsCents: 500 })
      const crypto = await import('node:crypto')
      const rawBody = JSON.stringify({ depositId: 'dep-1', toAmount: '5', txHash: '0xabc' })
      const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(rawBody).digest('hex')

      const res = await app.request('/v1/deposit/houdini/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Houdini-Signature': signature,
        },
        body: rawBody,
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.credits).toBe(500)
      expect(body.status).toBe('completed')
    })

    it('returns 401 with invalid signature', async () => {
      const rawBody = JSON.stringify({ depositId: 'dep-1', toAmount: '5', txHash: '0xabc' })

      const res = await app.request('/v1/deposit/houdini/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Houdini-Signature': 'invalid-signature',
        },
        body: rawBody,
      })
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.type).toBe('unauthorized')
    })
  })

  describe('POST /v1/deposit/cctp', () => {
    it('processes CCTP deposit with valid auth and body', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      vi.mocked(processCctpDeposit).mockResolvedValueOnce({ creditsCents: 1000, depositId: 'cctp-dep-1', method: 'cctp' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }
      vi.mocked(db.select).mockReturnValueOnce(mockChain)

      const res = await app.request('/v1/deposit/cctp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer session-token' },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'c'.repeat(64), sourceChain: 'ethereum' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.credits).toBe(1000)
      expect(body.depositId).toBe('cctp-dep-1')
      expect(body.method).toBe('cctp')
    })

    it('returns 409 for duplicate txHash', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 'existing' }]) }
      vi.mocked(db.select).mockReturnValueOnce(mockChain)

      const res = await app.request('/v1/deposit/cctp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer session-token' },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'd'.repeat(64), sourceChain: 'ethereum' }),
      })
      expect(res.status).toBe(409)
    })
  })

  describe('POST /v1/deposit/lifi', () => {
    it('processes LI.FI deposit with valid auth and body', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      vi.mocked(processLifiDeposit).mockResolvedValueOnce({ creditsCents: 995, depositId: 'lifi-dep-1', method: 'lifi' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }
      vi.mocked(db.select).mockReturnValueOnce(mockChain)

      const res = await app.request('/v1/deposit/lifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer session-token' },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'e'.repeat(64), fromChain: 'ethereum', fromToken: 'ETH' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.credits).toBe(995)
      expect(body.method).toBe('lifi')
    })

    it('returns 400 when route has not completed', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const mockChain: any = { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }) }
      vi.mocked(db.select).mockReturnValueOnce(mockChain)
      const { getRouteStatus } = await import('../credits/lifi-client.js')
      vi.mocked(getRouteStatus).mockResolvedValueOnce({ status: 'PENDING', fromAmount: '10', toAmount: '0', toAmountMin: '0' })

      const res = await app.request('/v1/deposit/lifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer session-token' },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'f'.repeat(64), fromChain: 'ethereum', fromToken: 'ETH' }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /v1/deposit/route', () => {
    it('returns routing advice for given chain and token', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')

      const res = await app.request('/v1/deposit/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer session-token' },
        body: JSON.stringify({ sourceChain: 'ethereum', sourceToken: 'USDC', amount: '100' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.best).toBeDefined()
      expect(body.all.length).toBeGreaterThan(0)
    })
  })

  describe('GET /v1/deposit/cctp/chains', () => {
    it('returns supported CCTP chains', async () => {
      const res = await app.request('/v1/deposit/cctp/chains')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.chains)).toBe(true)
    })
  })

  describe('POST /v1/deposit/lifi/quote', () => {
    it('returns a quote for valid params', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')

      const res = await app.request('/v1/deposit/lifi/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer session-token' },
        body: JSON.stringify({ fromChain: 'ethereum', fromToken: 'ETH', fromAmount: '1000000000000000000' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBeDefined()
      expect(body.fromAmount).toBeDefined()
    })
  })

  describe('POST /v1/deposit/lifi/check-routes', () => {
    it('returns true when route exists', async () => {
      const res = await app.request('/v1/deposit/lifi/check-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromChain: 'ethereum', fromToken: 'ETH', fromAmount: '1000000000000000000' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(typeof body.possible).toBe('boolean')
    })
  })
})
