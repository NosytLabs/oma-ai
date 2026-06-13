import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ── DB mock (chain pattern) ─────────────────────────────────
const { chain, resetChain, setQueryResult } = vi.hoisted(() => {
  type MockChain = Record<string, Mock> & {
    _resultQueue: unknown[][]
    then: (onfulfilled: (value: unknown[]) => unknown) => Promise<unknown>
  }

  const ch: MockChain = { _resultQueue: [] } as unknown as MockChain

  const METHODS = [
    'select', 'from', 'where', 'limit',
    'insert', 'values', 'returning', 'update', 'set',
    'onConflictDoUpdate',
  ]

  for (const m of METHODS) {
    ch[m] = vi.fn()
  }

  Object.defineProperty(ch, 'then', {
    value: function (this: MockChain, onfulfilled: (value: unknown[]) => unknown) {
      const result = this._resultQueue.length > 0 ? this._resultQueue.shift()! : []
      return Promise.resolve(result).then(onfulfilled)
    },
    writable: true,
    configurable: true,
  })

  function reset() {
    for (const m of METHODS) {
      ;(ch[m] as Mock).mockReturnValue(ch)
    }
    ch._resultQueue = []
  }

  function setQueryResult(result: unknown[]) {
    ch._resultQueue.push(result)
  }

  return { chain: ch, resetChain: reset, setQueryResult }
})

vi.mock('../db/client.js', () => ({ db: chain, getDb: () => chain }))

// ── Redis mock ───────────────────────────────────────────────
const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setEx: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    hGetAll: vi.fn().mockResolvedValue({}),
    hSet: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(mockRedis),
  isRedisReady: vi.fn().mockReturnValue(true),
}))

// ── Logger mock ──────────────────────────────────────────────
vi.mock('../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// ── Config mock ──────────────────────────────────────────────
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars-long!',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost:5432/oma_test',
    REDIS_URL: 'redis://localhost:6379',
    OMA_PRICE_OVERRIDE: undefined as number | undefined,
  },
}))

vi.mock('../config.js', () => ({ config: mockConfig }))

// ── Global fetch mock ────────────────────────────────────────
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// ── Oracle mock (controllable, for price-guard tests) ────────
const oracleMock = vi.hoisted(() => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
  getOmaPriceChange24h: vi.fn().mockResolvedValue(0),
  getTwap30m: vi.fn().mockResolvedValue(0.10),
  isOracleLive: vi.fn().mockReturnValue(true),
  isOracleFresh: vi.fn().mockResolvedValue(true),
}))

vi.mock('../credits/oracle.js', () => oracleMock)

// ── Import AFTER mocks ───────────────────────────────────────
const realOracle = await vi.importActual<typeof import('../credits/oracle.js')>('../credits/oracle.js')

import { getStakingDiscount } from '../credits/staking.js'

// ================================================================
// ORACLE TESTS (real module, single persistent fake timer context)
// ================================================================
describe('Oracle', () => {
  // Single fake timer context for ALL oracle subtests.
  // Each beforeEach advances time by 120s to force cache expiry,
  // working WITH the module's shared mutable state.
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    fetchMock.mockReset()
    mockConfig.OMA_PRICE_OVERRIDE = undefined
    vi.advanceTimersByTime(120_000)
  })

  describe('getOmaUsdPrice', () => {
    it('fetches price from CoinGecko successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'oma-2': { usd: 0.15, usd_24h_change: 5.2 },
        }),
      })

      const price = await realOracle.getOmaUsdPrice()
      expect(price).toBe(0.15)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('coingecko.com'),
        expect.any(Object),
      )
    })

    it('returns cached price within TTL window', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'oma-2': { usd: 0.20, usd_24h_change: 1.0 },
        }),
      })
      await realOracle.getOmaUsdPrice()

      // Call again immediately — should use cache (no fetch)
      fetchMock.mockClear()
      const price = await realOracle.getOmaUsdPrice()
      expect(price).toBe(0.20)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('falls back to OMA_PRICE_OVERRIDE when CoinGecko fails', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
      mockConfig.OMA_PRICE_OVERRIDE = 0.25

      const price = await realOracle.getOmaUsdPrice()
      expect(price).toBe(0.25)
    })

    it('falls back to $0.10 when CoinGecko fails and no override', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })

      const price = await realOracle.getOmaUsdPrice()
      expect(price).toBe(0.10)
    })

    it('falls back to $0.10 when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network error'))

      const price = await realOracle.getOmaUsdPrice()
      expect(price).toBe(0.10)
    })

    it('falls back to $0.10 when response has no oma-2 entry', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const price = await realOracle.getOmaUsdPrice()
      expect(price).toBe(0.10)
    })
  })

  describe('getOmaPriceChange24h', () => {
    it('returns 24h change from CoinGecko', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'oma-2': { usd: 0.10, usd_24h_change: -12.5 },
        }),
      })

      const change = await realOracle.getOmaPriceChange24h()
      expect(change).toBe(-12.5)
    })

    it('returns 0 when CoinGecko does not provide change', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'oma-2': { usd: 0.10 },
        }),
      })

      const change = await realOracle.getOmaPriceChange24h()
      expect(change).toBe(0)
    })

    it('returns 0 on fetch failure', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })

      const change = await realOracle.getOmaPriceChange24h()
      expect(change).toBe(0)
    })
  })

  describe('getTwap30m', () => {
    beforeEach(() => {
      // Advance >30min to expire any TWAP samples from previous tests
      vi.advanceTimersByTime(31 * 60_000)
    })

    it('returns average of samples within 30min window', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'oma-2': { usd: 0.10, usd_24h_change: 0 } }),
      })
      await realOracle.getTwap30m()

      vi.advanceTimersByTime(61_000)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'oma-2': { usd: 0.20, usd_24h_change: 0 } }),
      })
      await realOracle.getTwap30m()

      const twap = await realOracle.getTwap30m()
      expect(twap).toBeCloseTo(0.15, 2)
    })

    it('returns current price when no recent samples in window', async () => {
      vi.advanceTimersByTime(31 * 60_000)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'oma-2': { usd: 0.30, usd_24h_change: 0 } }),
      })

      const twap = await realOracle.getTwap30m()
      expect(twap).toBe(0.30)
    })

    it('excludes samples older than 30 minutes', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'oma-2': { usd: 0.10, usd_24h_change: 0 } }),
      })
      await realOracle.getTwap30m()

      vi.advanceTimersByTime(31 * 60_000)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'oma-2': { usd: 0.40, usd_24h_change: 0 } }),
      })
      await realOracle.getTwap30m()

      const twap = await realOracle.getTwap30m()
      expect(twap).toBe(0.40)
    })
  })

  describe('isOracleLive / isOracleFresh', () => {
    it('isOracleLive returns true when CoinGecko works', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'oma-2': { usd: 0.10, usd_24h_change: 0 } }),
      })
      await realOracle.getOmaUsdPrice()

      expect(realOracle.isOracleLive()).toBe(true)
    })

    it('isOracleLive returns true when OMA_PRICE_OVERRIDE is set', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
      mockConfig.OMA_PRICE_OVERRIDE = 0.25
      await realOracle.getOmaUsdPrice()

      expect(realOracle.isOracleLive()).toBe(true)
    })

    it('isOracleFresh is an alias for isOracleLive', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'oma-2': { usd: 0.10, usd_24h_change: 0 } }),
      })
      await realOracle.getOmaUsdPrice()

      const live = realOracle.isOracleLive()
      const fresh = await realOracle.isOracleFresh()
      expect(fresh).toBe(live)
    })
  })
})

// ================================================================
// STAKING TESTS
// ================================================================
describe('Staking – getStakingDiscount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.setEx.mockResolvedValue('OK')
  })

  it('returns discount from DB when no cache', async () => {
    setQueryResult([{ discountPercent: 10 }])

    const discount = await getStakingDiscount('user-1')
    expect(discount).toBe(10)
    expect(chain.select).toHaveBeenCalled()
  })

  it('returns 0 when user has no staking tier', async () => {
    setQueryResult([])

    const discount = await getStakingDiscount('user-no-stake')
    expect(discount).toBe(0)
  })

  it('returns cached discount from Redis', async () => {
    mockRedis.get.mockResolvedValueOnce('15')

    const discount = await getStakingDiscount('user-cached')
    expect(discount).toBe(15)
    expect(chain.select).not.toHaveBeenCalled()
  })

  it('caches DB result in Redis', async () => {
    setQueryResult([{ discountPercent: 20 }])

    await getStakingDiscount('user-cache-write')

    expect(mockRedis.setEx).toHaveBeenCalledWith(
      'staking:discount:user-cache-write',
      300,
      '20',
    )
  })

  it('returns 0 on DB error', async () => {
    chain.select.mockImplementationOnce(() => {
      throw new Error('DB connection lost')
    })

    const discount = await getStakingDiscount('user-db-error')
    expect(discount).toBe(0)
  })

  it('falls back to DB when Redis read fails', async () => {
    mockRedis.get.mockRejectedValueOnce(new Error('Redis down'))
    setQueryResult([{ discountPercent: 5 }])

    const discount = await getStakingDiscount('user-redis-error')
    expect(discount).toBe(5)
  })

  it('returns 0 when Redis is null', async () => {
    const { getRedisClient } = await import('../lib/redis-client.js')
    ;(getRedisClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    setQueryResult([])

    const discount = await getStakingDiscount('user-no-redis')
    expect(discount).toBe(0)
  })
})
