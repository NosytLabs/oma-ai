import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

const { mockSelect, mockFrom, mockWhere, mockLimit, mockInsert, mockValues, mockOnConflictDoUpdate, mockUpdate, mockSet } = vi.hoisted(() => ({
  mockSelect: vi.fn().mockReturnThis(),
  mockFrom: vi.fn().mockReturnThis(),
  mockWhere: vi.fn().mockReturnThis(),
  mockLimit: vi.fn(),
  mockInsert: vi.fn().mockReturnThis(),
  mockValues: vi.fn().mockReturnThis(),
  mockOnConflictDoUpdate: vi.fn().mockReturnThis(),
  mockUpdate: vi.fn().mockReturnThis(),
  mockSet: vi.fn().mockReturnThis(),
}))

vi.mock('../db/client.js', () => {
  const chain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    insert: mockInsert,
    values: mockValues,
    onConflictDoUpdate: mockOnConflictDoUpdate,
    update: mockUpdate,
    set: mockSet,
  }
  return { db: chain, getDb: () => chain }
})

vi.mock('../auth/siwe.js', () => ({
  verifySessionToken: vi.fn(),
}))

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars',
    NODE_ENV: 'test' as const,
    FACILITATOR_MODE: 'mock' as 'mock' | 'live',
    OMA_TOKEN_ADDRESS: '0x1111111111111111111111111111111111111111',
    TREASURY_BASE_ADDRESS: '0x3333333333333333333333333333333333333333',
    CHAIN_RPC_URL: 'https://mainnet.base.org',
  }
}))

vi.mock('../config.js', () => ({
  config: mockConfig,
}))

// Mock viem public client functions
const { mockGetTransactionReceipt, mockGetTransaction } = vi.hoisted(() => ({
  mockGetTransactionReceipt: vi.fn(),
  mockGetTransaction: vi.fn(),
}))

vi.mock('viem', async (importOriginal) => {
  const original = await importOriginal<typeof import('viem')>()
  return {
    ...original,
    createPublicClient: vi.fn(() => ({
      getTransactionReceipt: mockGetTransactionReceipt,
      getTransaction: mockGetTransaction,
    })),
  }
})

import app from '../index.js'
import { verifySessionToken } from '../auth/siwe.js'

describe('Staking Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.FACILITATOR_MODE = 'mock'
    // Explicitly reset mockLimit queue between tests to prevent leaks
    mockLimit.mockReset()
    mockLimit.mockResolvedValue([])
  })

  describe('GET /v1/stake/info', () => {
    it('returns default staking info when user has no staked record', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      mockLimit.mockResolvedValueOnce([])

      const res = await app.request('/v1/stake/info', {
        headers: {
          'Authorization': 'Bearer session-token',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        stakedAmount: '0',
        discountPercent: 0,
        cooldownUntil: null,
      })
    })

    it('returns stored staking info when user has staked record', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const cooldownDate = new Date(Date.now() + 1000 * 60 * 60)
      mockLimit.mockResolvedValueOnce([
        {
          userId: 'user-1',
          omaStaked: '15000',
          discountPercent: 6,
          cooldownUntil: cooldownDate,
        },
      ])

      const res = await app.request('/v1/stake/info', {
        headers: {
          'Authorization': 'Bearer session-token',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        stakedAmount: '15000',
        discountPercent: 6,
        cooldownUntil: cooldownDate.toISOString(),
      })
    })
  })

  describe('POST /v1/stake', () => {
    it('returns 400 for invalid request parameters', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const res = await app.request('/v1/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: -100, txHash: 'invalid-hash' }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.type).toBe('validation_error')
    })

    it('returns 409 for duplicate transaction hash', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      // Duplicate check: deposits row found
      mockLimit.mockResolvedValueOnce([{ id: 'dep-1' }])

      const res = await app.request('/v1/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 1000, txHash: '0x' + 'a'.repeat(64) }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.type).toBe('duplicate')
    })

    it('successfully stakes OMA under mock mode and calculates correct discount tier', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      // Duplicate check: returns empty
      mockLimit.mockResolvedValueOnce([])
      // StakingTiers lookup: returns empty (first stake)
      mockLimit.mockResolvedValueOnce([])

      // Mock insert chain
      mockInsert.mockReturnThis()
      mockValues.mockReturnThis()
      mockOnConflictDoUpdate.mockResolvedValueOnce([{ userId: 'user-1', omaStaked: '10000', discountPercent: 6 }])

      const res = await app.request('/v1/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 10000, txHash: '0x' + 'a'.repeat(64) }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        stakedAmount: '10000',
        discountPercent: 6,
      })
    })

    it('successfully stakes additional OMA and increases discount tier', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      // Duplicate check: returns empty
      mockLimit.mockResolvedValueOnce([])
      // StakingTiers lookup: returns existing staked balance
      mockLimit.mockResolvedValueOnce([{ userId: 'user-1', omaStaked: '1000', discountPercent: 3 }])

      mockInsert.mockReturnThis()
      mockValues.mockReturnThis()
      mockOnConflictDoUpdate.mockResolvedValueOnce([{ userId: 'user-1', omaStaked: '11000', discountPercent: 6 }])

      const res = await app.request('/v1/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 10000, txHash: '0x' + 'a'.repeat(64) }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        stakedAmount: '11000',
        discountPercent: 6,
      })
    })

    it('runs on-chain EVM verification under live mode', async () => {
      mockConfig.FACILITATOR_MODE = 'live'
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      
      // Duplicate check: returns empty
      mockLimit.mockResolvedValueOnce([])
      
      // Setup successful viem returns
      mockGetTransactionReceipt.mockResolvedValueOnce({ status: 'success' })
      mockGetTransaction.mockResolvedValueOnce({
        to: mockConfig.OMA_TOKEN_ADDRESS,
        // erc20 transfer method input: transfer(recipient, 1000 * 10^18)
        input: '0xa9059cbb' + 
               '000000000000000000000000' + mockConfig.TREASURY_BASE_ADDRESS.replace('0x', '').toLowerCase() + 
               '00000000000000000000000000000000000000000000003635c9adc5dea00000',
      })

      // StakingTiers lookup: returns empty
      mockLimit.mockResolvedValueOnce([])

      const res = await app.request('/v1/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 1000, txHash: '0x' + 'b'.repeat(64) }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        stakedAmount: '1000',
        discountPercent: 3,
      })
    })

    it('fails when on-chain EVM transaction fails', async () => {
      mockConfig.FACILITATOR_MODE = 'live'
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      
      // Duplicate check: returns empty
      mockLimit.mockResolvedValueOnce([])
      
      // Transaction failed
      mockGetTransactionReceipt.mockResolvedValueOnce({ status: 'reverted' })

      const res = await app.request('/v1/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 1000, txHash: '0x' + 'b'.repeat(64) }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('Transaction failed on-chain')
    })
  })

  describe('POST /v1/unstake', () => {
    it('returns 400 when user has no active stake', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      mockLimit.mockResolvedValueOnce([]) // No staking tier row found

      const res = await app.request('/v1/unstake', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer session-token',
        },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('No active OMA stake found to unstake')
    })

    it('successfully initiates unstaking cooldown and drops discount immediately', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      mockLimit.mockResolvedValueOnce([{ userId: 'user-1', omaStaked: '50000', discountPercent: 10 }])

      mockUpdate.mockReturnThis()
      mockSet.mockReturnThis()

      const res = await app.request('/v1/unstake', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer session-token',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.stakedAmount).toBe('50000')
      expect(body.discountPercent).toBe(0)
      expect(body.cooldownUntil).toBeDefined()
    })
  })

  describe('POST /v1/stake/withdraw', () => {
    it('returns 400 if user has no tokens staked', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      mockLimit.mockResolvedValueOnce([])

      const res = await app.request('/v1/stake/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer session-token',
        },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('No OMA tokens available for withdrawal')
    })

    it('returns 400 if cooldown has not expired yet', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      // Staking tier has active cooldown in future
      const futureCooldown = new Date(Date.now() + 1000 * 60 * 60)
      mockLimit.mockResolvedValueOnce([{ userId: 'user-1', omaStaked: '5000', discountPercent: 0, cooldownUntil: futureCooldown }])

      const res = await app.request('/v1/stake/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer session-token',
        },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('Staking cooldown has not expired yet')
    })

    it('successfully withdraws tokens if cooldown is expired', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      // Staking tier has expired cooldown in past
      const pastCooldown = new Date(Date.now() - 1000 * 60 * 60)
      mockLimit.mockResolvedValueOnce([{ userId: 'user-1', omaStaked: '5000', discountPercent: 0, cooldownUntil: pastCooldown }])

      mockUpdate.mockReturnThis()
      mockSet.mockReturnThis()

      const res = await app.request('/v1/stake/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer session-token',
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        success: true,
        amountWithdrawn: '5000',
        message: 'Withdrawal completed successfully',
      })
    })
  })
})
