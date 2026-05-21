import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

const { chain, resetChain, setQueryResult } = vi.hoisted(() => {
  type MockChain = Record<string, Mock> & {
    _resultQueue: unknown[][]
    _queryResult: unknown
    then: (onfulfilled: (value: unknown[]) => unknown) => Promise<unknown>
    transaction: Mock
    for: Mock
  }

  const ch: MockChain = {
    _resultQueue: [],
  } as unknown as MockChain

  const METHODS = [
    'select', 'from', 'where', 'limit', 'orderBy',
    'insert', 'values', 'returning', 'update', 'set',
    'for', 'onConflictDoUpdate',
  ]

  for (const m of METHODS) {
    ch[m] = vi.fn()
  }

  ch.transaction = vi.fn()

  // Make the chain thenable so `await chain` dequeues from _resultQueue
  Object.defineProperty(ch, 'then', {
    value: function (this: MockChain, onfulfilled: (value: unknown[]) => unknown) {
      const result = this._resultQueue.length > 0
        ? this._resultQueue.shift()!
        : []
      return Promise.resolve(result).then(onfulfilled)
    },
    writable: true,
    configurable: true,
  })

  function reset() {
    for (const m of METHODS) {
      ;(ch[m] as Mock).mockReturnValue(ch)
    }
    ch.transaction.mockImplementation(async (fn: (tx: typeof ch) => Promise<void>) => {
      await fn(ch)
    })
    ch._resultQueue = []
  }

  function setQueryResult(result: unknown[]) {
    ch._resultQueue.push(result)
  }

  return { chain: ch, resetChain: reset, setQueryResult }
})

vi.mock('../db/client.js', () => ({
  db: chain,
  getDb: () => chain,
}))

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

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
  processOmaDeposit: vi.fn(),
  processHoudiniDeposit: vi.fn(),
  completeHoudiniDeposit: vi.fn(),
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
})

vi.mock('../config.js', () => ({
  config: {
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost:5432/oma_test',
    REDIS_URL: 'redis://localhost:6379',
    HOUDINI_WEBHOOK_SECRET: 'test-webhook-secret',
    TREASURY_SOLANA_ADDRESS: '',
    SOLANA_RPC_URL: '',
  },
}))

import { getBalance, addCredits, preflightDeduction, refundCredits } from '../credits/balance.js'

describe('Credit Batch System (90-Day Expiry)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  describe('getBalance', () => {
    it('returns zero for user with no batches or balance row', async () => {
      const balance = await getBalance('user-1')
      expect(balance.balanceCents).toBe('0')
    })

    it('returns sum of remaining cents from active batches', async () => {
      setQueryResult([{ total: '2500' }])

      const balance = await getBalance('user-1')
      expect(balance.balanceCents).toBe('2500')
    })

    it('includes totalDepositedCents and totalUsedCents from balance row', async () => {
      setQueryResult([{ total: '5000' }])
      setQueryResult([{ userId: 'user-1', balanceCents: '5000', totalDepositedCents: '10000', totalUsedCents: '5000', lastActivityAt: new Date('2026-05-15') }])

      const balance = await getBalance('user-1')
      expect(balance.balanceCents).toBe('5000')
      expect(balance.totalDepositedCents).toBe('10000')
      expect(balance.totalUsedCents).toBe('5000')
    })
  })

  describe('addCredits', () => {
    it('creates a batch and updates cached balance within a transaction', async () => {
      await addCredits('user-1', 1000)

      expect(chain.transaction).toHaveBeenCalled()
      expect(chain.insert).toHaveBeenCalled()
      expect(chain.onConflictDoUpdate).toHaveBeenCalled()
    })
  })

  describe('preflightDeduction', () => {
    it('returns true when sufficient credits exist', async () => {
      const activeBatches = [
        { id: 'b1', userId: 'user-1', amountCents: '5000', remainingCents: '5000', expiresAt: new Date(Date.now() + 86400000) },
      ]

      chain.transaction.mockImplementationOnce(async (fn: (tx: typeof chain) => Promise<void>) => {
        // Inside the tx, for() returns active batches
        chain.for.mockResolvedValueOnce(activeBatches)
        // Balance sum query returns remaining
        chain._queryResult = [{ total: '2000' }]
        await fn(chain)
      })

      const result = await preflightDeduction('user-1', '500')
      expect(result).toBe(true)
    })

    it('returns false when user has no active batches', async () => {
      chain.transaction.mockImplementationOnce(async (fn: (tx: typeof chain) => Promise<void>) => {
        chain.for.mockResolvedValueOnce([])
        await fn(chain)
      })

      const result = await preflightDeduction('user-1', '500')
      expect(result).toBe(false)
    })

    it('returns false when balance is insufficient', async () => {
      const lowBatches = [
        { id: 'b1', userId: 'user-1', amountCents: '1000', remainingCents: '100', expiresAt: new Date(Date.now() + 86400000) },
      ]

      chain.transaction.mockImplementationOnce(async (fn: (tx: typeof chain) => Promise<void>) => {
        chain.for.mockResolvedValueOnce(lowBatches)
        await fn(chain)
      })

      const result = await preflightDeduction('user-1', '500')
      expect(result).toBe(false)
    })
  })

  describe('refundCredits', () => {
    it('creates a new batch for refunded credits', async () => {
      chain.transaction.mockImplementationOnce(async (fn: (tx: typeof chain) => Promise<void>) => {
        chain._queryResult = [{ total: '5200' }]
        await fn(chain)
      })

      await refundCredits('user-1', '200')
      expect(chain.transaction).toHaveBeenCalled()
      expect(chain.insert).toHaveBeenCalled()
    })
  })
})
