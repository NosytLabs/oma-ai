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
  processHoudiniDeposit: vi.fn(),
  completeHoudiniDeposit: vi.fn(),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../credits/price-guard.js', () => ({
  checkCircuitBreaker: vi.fn().mockResolvedValue({ omaDepositsAllowed: true, omaBonusPercent: 5, reason: null }),
  checkOracleCircuitBreaker: vi.fn().mockResolvedValue(false),
}))

vi.mock('../credits/houdini-client.js', () => ({
  houdiniClient: {
    getTokens: vi.fn().mockResolvedValue([]),
    getDepositStatus: vi.fn(),
    createDeposit: vi.fn(),
  },
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

vi.mock('../inference/provider-health.js', () => ({
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

vi.mock('../routes/auth.js', () => ({
  authRoutes: new (require('hono').Hono)(),
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
    FACILITATOR_MODE: 'mock',
    CHAIN_RPC_URL: 'https://mainnet.base.org',
    RECEIPT_HMAC_SECRET: 'test-receipt-secret-at-least-32-chars!',
  },
}))

import app from '../index.js'
import { verifySessionToken } from '../auth/siwe.js'

describe('x402 Facilitator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /x402/verify', () => {
    it('returns 200 with valid receipt', async () => {
      const paymentSig = {
        x402Version: '1',
        signature: 'test-sig',
        authorization: 'test-auth',
        payload: {
          x402Version: '1',
          scheme: 'evm',
          networkId: 'base',
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: '1.00',
          payee: '0xPayee',
          payFrom: '0xPayer',
          maxAmountRequired: '1.00',
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          validAfter: Math.floor(Date.now() / 1000) - 3600,
        },
      }

      const res = await app.request('/x402/verify', {
        method: 'POST',
        headers: {
          'PAYMENT-SIGNATURE': JSON.stringify(paymentSig),
        },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.valid).toBe(true)
    })

    it('returns 400 with invalid receipt', async () => {
      const res = await app.request('/x402/verify', {
        method: 'POST',
        headers: {},
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.type).toBe('payment_error')
    })
  })

  describe('POST /x402/settle', () => {
    it('returns 200 with valid payload', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const res = await app.request('/x402/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({
          txHash: '0x' + 'c'.repeat(64),
          amount: '1.00',
          networkId: 'base',
          payee: '0xPayee',
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.settled).toBe(true)
      expect(body).toHaveProperty('receipt')
    })

    it('returns 400 with missing fields', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const res = await app.request('/x402/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ txHash: '0xabc' }),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.type).toBe('payment_error')
    })
  })

  describe('x402 Payment Middleware', () => {
    it('mock mode accepts any well-formed payment regardless of payFrom/payee', async () => {
      const paymentSig = {
        x402Version: '1',
        signature: 'test-sig-mismatch',
        authorization: 'test-auth',
        payload: {
          x402Version: '1',
          scheme: 'evm',
          networkId: 'base',
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: '1.00',
          payee: '0xDifferentPayee',
          payFrom: '0xDifferentPayer',
          maxAmountRequired: '1.00',
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          validAfter: Math.floor(Date.now() / 1000) - 3600,
        },
      }

      const res = await app.request('/x402/verify', {
        method: 'POST',
        headers: {
          'PAYMENT-SIGNATURE': JSON.stringify(paymentSig),
        },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.valid).toBe(true)
    })

    it('rejects missing PAYMENT-SIGNATURE header', async () => {
      const res = await app.request('/x402/verify', {
        method: 'POST',
        headers: {},
      })
      expect(res.status).toBe(400)
    })

    it('rejects invalid JSON in PAYMENT-SIGNATURE', async () => {
      const res = await app.request('/x402/verify', {
        method: 'POST',
        headers: {
          'PAYMENT-SIGNATURE': 'not-json',
        },
      })
      expect(res.status).toBe(400)
    })
  })
})
