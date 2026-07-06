import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
  getRequestListener: vi.fn(() => ({ on: vi.fn(), handle: vi.fn() })),
}))

// Mock the on-chain USDC verifier. The deposit route calls this before
// crediting the user; tests in this file exercise the off-chain deposit
// flow, not the on-chain receipt check, so a pass-through is correct.
vi.mock('../credits/verify-usdc-on-chain.js', () => ({
  verifyUsdcOnChain: vi.fn().mockResolvedValue({ valid: true, txHash: '0xabc', amount: '10' }),
}))

vi.mock('viem', () => ({
  verifyMessage: vi.fn().mockResolvedValue(true),
  // Mock for the on-chain USDC verifier import — tests in this file don't
  // exercise the on-chain path so a stub is enough.
  parseAbi: vi.fn(() => []),
  decodeFunctionData: vi.fn(),
  createPublicClient: vi.fn(),
  formatUnits: vi.fn((v: bigint) => v.toString()),
  http: vi.fn(),
}));

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
  const mockTransaction = vi.fn().mockImplementation(async (callback) => {
    return callback({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      for: vi.fn().mockResolvedValue([{ id: 'dep-1', userId: 'user-1', type: 'houdini_swap', status: 'pending' }]),
      limit: vi.fn().mockResolvedValue([{ id: 'dep-1', userId: 'user-1', type: 'houdini_swap', status: 'pending' }]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue({ creditsCents: 500 }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    })
  })

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
    transaction: mockTransaction,
  }

  mockSelect.mockReturnValue(chain)
  mockFrom.mockReturnValue(chain)
  mockWhere.mockReturnValue(chain)
  mockLimit.mockResolvedValue([])
  mockInsert.mockReturnValue(chain)
  mockValues.mockReturnValue(chain)
  mockReturning.mockResolvedValue([{ id: 'dep-1', userId: 'user-1' }])
  mockUpdate.mockReturnValue(chain)
  mockSet.mockReturnValue(chain)
  mockOrderBy.mockReturnValue(chain)

  return { db: chain, getDb: () => chain }
})

vi.mock('../auth/api-keys.js', () => ({ shouldRecommendRotation: vi.fn().mockReturnValue(false), 
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

vi.mock('../credits/index.js', () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
  preflightDeduction: vi.fn(),
}))

vi.mock('../credits/cctp-client.js', () => ({
  verifyBurnTransaction: vi.fn().mockResolvedValue({ verified: true, sourceChain: 'ethereum', burnTxHash: '0xabc', burnAmount: '10000000', mintRecipient: '0xrecv', messageHash: '0xmsg' }),
  waitForAttestation: vi.fn().mockResolvedValue({ verified: true, sourceChain: 'ethereum', burnTxHash: '0xabc', burnAmount: '10000000', mintRecipient: '0xrecv', messageHash: '0xmsg' }),
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
  // toAmount must be raw 6-decimal USDC (lifi.ts does Number(toAmount) / 1e6)
  getRouteStatus: vi.fn().mockResolvedValue({ status: 'DONE', fromAmount: '1000000000000000000', toAmount: '9950000', toAmountMin: '9900000' }),
  checkPossibleRoutes: vi.fn().mockResolvedValue(true),
  isCctpChain: vi.fn().mockReturnValue(false),
  getLifiSourceChains: vi.fn().mockReturnValue(['ethereum', 'optimism', 'arbitrum', 'polygon']),
  getSupportedChains: vi.fn().mockResolvedValue([]),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
  processOmaDeposit: vi.fn(),
  processCctpDeposit: vi.fn(),
  processLifiDeposit: vi.fn(),
  processPaymentLinkDeposit: vi.fn().mockResolvedValue({ creditsCents: 500 }),
}))

vi.mock('../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    lPush: vi.fn().mockResolvedValue(1),
    lTrim: vi.fn().mockResolvedValue('OK'),
    lRange: vi.fn().mockResolvedValue([]),
    lLen: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(1),
    zAdd: vi.fn().mockResolvedValue(1),
    zRange: vi.fn().mockResolvedValue([]),
    zRem: vi.fn().mockResolvedValue(1),
  }),
}))

vi.mock('../lib/dlq.js', () => ({
  addToDlq: vi.fn().mockResolvedValue(undefined),
 }))



vi.mock('../inference/router.js', () => ({
  handleChatCompletion: vi.fn(),
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
  getSupportedMethods: vi.fn().mockReturnValue(['cctp', 'lifi']),
}))

import app from '../index.js'
import { verifySessionToken } from '../auth/siwe.js'
import { processUsdcDeposit, processCctpDeposit, processLifiDeposit } from '../credits/deposit.js'
import { db } from '../db/client.js'

describe('Deposit Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /v1/deposit/usdc', () => {
    const testNonce = 'test-nonce-' + Date.now()
    const testWalletAddress = '0x1234567890123456789012345678901234567890'
    
    const validDepositBody = {
      amount: 10,
      txHash: '0x' + 'a'.repeat(64),
      signature: '0x' + 'a'.repeat(130),
      nonce: testNonce,
      walletAddress: testWalletAddress,
      chainId: 8453,
    }

    it('processes USDC deposit with valid auth and body', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
      vi.mocked(processUsdcDeposit).mockResolvedValueOnce({ creditsCents: 1000, depositId: 'dep-1' })
       
      const nonceRes = await app.request('/v1/deposit/usdc/nonce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 10, walletAddress: testWalletAddress, chainId: 8453 }),
      })
      expect(nonceRes.status).toBe(200)
      const { nonce } = await nonceRes.json()

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
        body: JSON.stringify({ ...validDepositBody, nonce }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.credits).toBe(1000)
      expect(body.depositId).toBe('dep-1')
    })

    it('rejects USDC deposit without valid signature proof', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'b'.repeat(64) }),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBeDefined()
    })

    it('returns 409 for duplicate txHash in DB', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
        
      const nonceRes = await app.request('/v1/deposit/usdc/nonce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 10, walletAddress: testWalletAddress, chainId: 8453 }),
      })
      expect(nonceRes.status).toBe(200)
      const { nonce } = await nonceRes.json()

      // 1st db.select: sessionAuth middleware checks 2FA (returns user without 2FA enabled)
      const authChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ twoFactorEnabled: false }]) }
      vi.mocked(db.select).mockReturnValueOnce(authChain)
      // 2nd db.select: route duplicate check returns existing deposit → 409
      const dupChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 'existing-dep' }]) }
      vi.mocked(db.select).mockReturnValueOnce(dupChain)

      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ ...validDepositBody, nonce }),
      })
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.type).toBe('duplicate')
    })
  })

  describe('POST /v1/deposit/cctp', () => {
    it('processes CCTP deposit with valid auth and body', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
      vi.mocked(processCctpDeposit).mockResolvedValueOnce({ creditsCents: 1000, depositId: 'cctp-dep-1', method: 'cctp' })
       
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

    it('returns 409 for duplicate txHash in DB', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
       
      // 1st db.select: sessionAuth middleware checks 2FA (returns user without 2FA enabled)
      const authChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ twoFactorEnabled: false }]) }
      vi.mocked(db.select).mockReturnValueOnce(authChain)
      // 2nd db.select: route duplicate check returns existing deposit → 409
      const dupChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 'existing-dep' }]) }
      vi.mocked(db.select).mockReturnValueOnce(dupChain)

      const res = await app.request('/v1/deposit/cctp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer session-token' },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'd'.repeat(64), sourceChain: 'ethereum' }),
      })
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.type).toBe('duplicate')
    })

    it('returns 500 when processCctpDeposit throws', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
      vi.mocked(processCctpDeposit).mockRejectedValueOnce(new Error('Internal deposit error'))
       
      // 1st db.select: sessionAuth middleware checks 2FA
      const authChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ twoFactorEnabled: false }]) }
      vi.mocked(db.select).mockReturnValueOnce(authChain)
      // 2nd db.select: route duplicate check returns [] (no duplicate)
      const dupChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }
      vi.mocked(db.select).mockReturnValueOnce(dupChain)

      // burnAmount mock is now 10000000 (raw 6-decimal) → onChain $10, so amount:10 passes validation
      const res = await app.request('/v1/deposit/cctp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer session-token' },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'e'.repeat(64), sourceChain: 'ethereum' }),
      })
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.type).toBe('deposit_error')
    })
  })

  describe('POST /v1/deposit/lifi', () => {
    it('processes LI.FI deposit with valid auth and body', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
      vi.mocked(processLifiDeposit).mockResolvedValueOnce({ creditsCents: 995, depositId: 'lifi-dep-1', method: 'lifi' })
        
      // 1st db.select: sessionAuth middleware checks 2FA (returns user without 2FA enabled)
      const authChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ twoFactorEnabled: false }]) }
      vi.mocked(db.select).mockReturnValueOnce(authChain)
      // 2nd db.select: route duplicate check returns empty → no duplicate
      const dupChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }
      vi.mocked(db.select).mockReturnValueOnce(dupChain)

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
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })

      // 1st db.select: sessionAuth middleware checks 2FA
      const authChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ twoFactorEnabled: false }]) }
      vi.mocked(db.select).mockReturnValueOnce(authChain)
      // 2nd db.select: route duplicate check returns empty → no duplicate
      const dupChain: any = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }
      vi.mocked(db.select).mockReturnValueOnce(dupChain)

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
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })

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
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })

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
