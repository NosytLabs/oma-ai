import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRedisClient: vi.fn(),
  isRedisReady: vi.fn(),
  getOmaPriceChange24h: vi.fn(),
  isOracleFresh: vi.fn(),
  getOmaUsdPrice: vi.fn(),
  isOracleLive: vi.fn(),
}))

vi.mock('../../lib/redis-client.js', () => ({
  getRedisClient: mocks.getRedisClient,
  isRedisReady: mocks.isRedisReady,
}))

vi.mock('../../credits/oracle.js', () => ({
  getOmaPriceChange24h: mocks.getOmaPriceChange24h,
  isOracleFresh: mocks.isOracleFresh,
  getOmaUsdPrice: mocks.getOmaUsdPrice,
  isOracleLive: mocks.isOracleLive,
}))

import { checkCircuitBreaker, checkOracleCircuitBreaker, getCircuitBreakerState, resetCircuitBreakerCache } from '../../credits/price-guard.js'

function setupDefaultMocks(mockRedis = { hGetAll: vi.fn().mockResolvedValue({}), hSet: vi.fn().mockResolvedValue(1) }) {
  mocks.getRedisClient.mockReturnValue(Promise.resolve(mockRedis))
  mocks.isRedisReady.mockReturnValue(true)
  mocks.getOmaPriceChange24h.mockResolvedValue(0)
  mocks.isOracleFresh.mockReturnValue(true)
  mocks.getOmaUsdPrice.mockResolvedValue(100)
  mocks.isOracleLive.mockReturnValue(true)
  return mockRedis
}

describe('price-guard circuit breaker', () => {
  beforeEach(() => {
    resetCircuitBreakerCache()
    setupDefaultMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('checkCircuitBreaker', () => {
    it('returns omaDepositsAllowed=false when oracle not live', async () => {
      mocks.isOracleLive.mockReturnValueOnce(false)

      const result = await checkCircuitBreaker()

      expect(result.omaDepositsAllowed).toBe(false)
      expect(result.reason).toContain('Oracle not live')
    })

    it('halts deposits when OMA price drops >50% in 24h', async () => {
      mocks.isOracleLive.mockReturnValueOnce(true)
      mocks.getOmaPriceChange24h.mockResolvedValueOnce(-51)

      const result = await checkCircuitBreaker()

      expect(result.omaDepositsAllowed).toBe(false)
      expect(result.omaBonusPercent).toBe(0)
      expect(result.reason).toContain('50%')
    })

    it('suspends bonus but allows deposits when price drops >35%', async () => {
      mocks.isOracleLive.mockReturnValueOnce(true)
      mocks.getOmaPriceChange24h.mockResolvedValueOnce(-36)

      const result = await checkCircuitBreaker()

      expect(result.omaDepositsAllowed).toBe(true)
      expect(result.omaBonusPercent).toBe(0)
      expect(result.reason).toContain('35%')
    })

    it('reduces bonus to 2% when price drops >20%', async () => {
      mocks.isOracleLive.mockReturnValueOnce(true)
      mocks.getOmaPriceChange24h.mockResolvedValueOnce(-21)

      const result = await checkCircuitBreaker()

      expect(result.omaBonusPercent).toBe(2)
      expect(result.omaDepositsAllowed).toBe(true)
    })

    it('returns full 5% bonus when price is stable', async () => {
      mocks.isOracleLive.mockReturnValueOnce(true)
      mocks.getOmaPriceChange24h.mockResolvedValueOnce(-10)

      const result = await checkCircuitBreaker()

      expect(result.omaBonusPercent).toBe(5)
      expect(result.omaDepositsAllowed).toBe(true)
    })
  })

  describe('checkOracleCircuitBreaker', () => {
    it('returns true when oracle not fresh', async () => {
      mocks.isOracleFresh.mockReturnValueOnce(false)

      const result = await checkOracleCircuitBreaker()

      expect(result).toBe(true)
    })

    it('returns true when price is zero', async () => {
      mocks.getOmaUsdPrice.mockResolvedValueOnce(0)

      const result = await checkOracleCircuitBreaker()

      expect(result).toBe(true)
    })

    it('returns false when oracle fresh and price non-zero', async () => {
      mocks.isOracleFresh.mockReturnValueOnce(true)
      mocks.getOmaUsdPrice.mockResolvedValueOnce(100)

      const result = await checkOracleCircuitBreaker()

      expect(result).toBe(false)
    })
  })

  describe('Redis persistence', () => {
    it('loads circuit breaker state from Redis on startup', async () => {
      const mockRedis = {
        hGetAll: vi.fn().mockResolvedValue({
          omaBonusPercent: '2',
          omaDepositsAllowed: 'true',
          lastUpdated: String(Date.now()),
        }),
        hSet: vi.fn().mockResolvedValue(1),
      }
      mocks.getRedisClient.mockReturnValue(Promise.resolve(mockRedis))

      const state = await getCircuitBreakerState()

      expect(state).toEqual({
        omaBonusPercent: 2,
        omaDepositsAllowed: true,
      })
    })

    it('persists circuit breaker state to Redis after check', async () => {
      const mockRedis = {
        hGetAll: vi.fn().mockResolvedValue({}),
        hSet: vi.fn().mockResolvedValue(1),
      }
      mocks.getRedisClient.mockReturnValue(Promise.resolve(mockRedis))
      mocks.isOracleLive.mockResolvedValueOnce(true)
      mocks.getOmaPriceChange24h.mockResolvedValueOnce(-21)

      await checkCircuitBreaker()

      expect(mockRedis.hSet).toHaveBeenCalledWith(
        'circuitbreaker:price-guard',
        expect.objectContaining({
          omaBonusPercent: '2',
          omaDepositsAllowed: 'true',
        })
      )
    })

    it('survives server restart - loads persisted state from Redis', async () => {
      resetCircuitBreakerCache()

      const testRedis = {
        hGetAll: vi.fn().mockResolvedValue({
          omaBonusPercent: '0',
          omaDepositsAllowed: 'false',
          lastUpdated: String(Date.now()),
        }),
        hSet: vi.fn().mockResolvedValue(1),
      }

      mocks.getRedisClient.mockReturnValue(Promise.resolve(testRedis))
      mocks.isRedisReady.mockReturnValue(true)

      const state = await getCircuitBreakerState()

      expect(state.omaBonusPercent).toBe(0)
      expect(state.omaDepositsAllowed).toBe(false)
    })
  })
})