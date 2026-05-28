import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Context, Next } from "hono"
import type { OmaEnv } from "../../types.js"

const mockRedisClient = {
  eval: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  zadd: vi.fn(),
  zremrangebyscore: vi.fn(),
  zcard: vi.fn(),
  zrange: vi.fn(),
  hmget: vi.fn(),
  hmset: vi.fn(),
}

vi.mock('../../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockImplementation(() => Promise.resolve(mockRedisClient)),
  isRedisReady: vi.fn().mockReturnValue(true),
}))

import { checkTokenBucket, checkRpmLimit, tokenBucket, modelRateLimit, rateLimit, MODEL_LIMITS } from '../rate-limit.js'

describe('rate-limit middleware', () => {
  let mockContext: any
  let mockNext: Next

  beforeEach(() => {
    vi.clearAllMocks()
    mockNext = vi.fn().mockResolvedValue(undefined)
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === 'apiKey') return null
        if (key === 'userId') return null
        return undefined
      }),
      req: {
        header: vi.fn().mockReturnValue(undefined),
        method: 'POST',
        json: vi.fn().mockResolvedValue({ model: 'test-model' }),
      },
      header: vi.fn(),
      set: vi.fn(),
      json: vi.fn().mockReturnThis(),
    }
  })

  describe('MODEL_LIMITS', () => {
    it('should have correct structure for known models', () => {
      expect(MODEL_LIMITS['claude-opus-4-7']).toEqual({ rpm: 30, tpm: 60000 })
      expect(MODEL_LIMITS['deepseek-r1']).toEqual({ rpm: 60, tpm: 120000 })
      expect(MODEL_LIMITS['gpt-4o-mini']).toEqual({ rpm: 120, tpm: 240000 })
    })

    it('should have reasonable limits for different model tiers', () => {
      const frontierModels = ['claude-opus-4-7', 'gpt-5.5', 'o3']
      const standardModels = ['deepseek-r1', 'gpt-4o']
      const fastModels = ['gpt-4o-mini', 'phi-4-mini']

      frontierModels.forEach(model => {
        expect(MODEL_LIMITS[model].rpm).toBeLessThanOrEqual(30)
      })

      standardModels.forEach(model => {
        expect(MODEL_LIMITS[model].rpm).toBeGreaterThan(30)
        expect(MODEL_LIMITS[model].rpm).toBeLessThanOrEqual(60)
      })

      fastModels.forEach(model => {
        expect(MODEL_LIMITS[model].rpm).toBeGreaterThan(60)
      })
    })
  })

  describe('checkTokenBucket', () => {
    it('should return allowed result when tokens are available', async () => {
      mockRedisClient.eval.mockResolvedValueOnce([1, 50, 0])

      const result = await checkTokenBucket(mockRedisClient as any, 'test-key', {
        bucketSize: 60,
        refillRate: 20,
      })

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(50)
      expect(result.resetMs).toBe(0)
      expect(result.limit).toBe(60)
    })

    it('should return not allowed result when tokens are depleted', async () => {
      mockRedisClient.eval.mockResolvedValueOnce([0, 0, 5000])

      const result = await checkTokenBucket(mockRedisClient as any, 'test-key', {
        bucketSize: 60,
        refillRate: 20,
      })

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.resetMs).toBe(5000)
    })

    it('should pass correct arguments to Redis eval', async () => {
      mockRedisClient.eval.mockResolvedValueOnce([1, 59, 0])

      await checkTokenBucket(mockRedisClient as any, 'tb:user:123', {
        bucketSize: 60,
        refillRate: 20,
      }, 1)

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'tb:user:123',
        60,
        20,
        1
      )
    })

    it('should throw on Redis error', async () => {
      mockRedisClient.eval.mockRejectedValueOnce(new Error('Redis connection failed'))

      await expect(
        checkTokenBucket(mockRedisClient as any, 'test-key', { bucketSize: 60, refillRate: 20 })
      ).rejects.toThrow('Redis connection failed')
    })
  })

  describe('checkRpmLimit', () => {
    it('should return allowed when under RPM limit', async () => {
      mockRedisClient.eval.mockResolvedValueOnce([1, 10, 0])

      const result = await checkRpmLimit(mockRedisClient as any, 'rpm:test', 60, 60)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(50)
      expect(result.resetMs).toBe(0)
    })

    it('should return not allowed when RPM limit exceeded', async () => {
      mockRedisClient.eval.mockResolvedValueOnce([0, 60, 30000])

      const result = await checkRpmLimit(mockRedisClient as any, 'rpm:test', 60, 60)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('tokenBucket middleware', () => {
    it('should allow request when under rate limit', async () => {
      mockRedisClient.eval.mockResolvedValue([1, 50, 0])

      const middleware = tokenBucket()
      await middleware(mockContext as Context<OmaEnv>, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String))
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String))
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
    })

    it('should return 429 when rate limit exceeded', async () => {
      mockRedisClient.eval.mockResolvedValue([0, 0, 5000])

      const middleware = tokenBucket()
      await middleware(mockContext as Context<OmaEnv>, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'rate_limit_exceeded',
          }),
        }),
        429
      )
    })

    it('should use apiKey for rate limit key when available', async () => {
      mockRedisClient.eval.mockResolvedValue([1, 50, 0])
      mockContext.get = vi.fn().mockImplementation((key: string) => {
        if (key === 'apiKey') return { id: 'key-123' }
        return null
      })

      const middleware = tokenBucket()
      await middleware(mockContext as Context<OmaEnv>, mockNext)

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        "tb:key-123",
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      );
    })

    it('should use userId for rate limit key when no apiKey', async () => {
      mockRedisClient.eval.mockResolvedValue([1, 50, 0])
      mockContext.get = vi.fn().mockImplementation((key: string) => {
        if (key === 'userId') return 'user-456'
        return null
      })

      const middleware = tokenBucket()
      await middleware(mockContext as Context<OmaEnv>, mockNext)

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        "tb:user-456",
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should use IP for rate limit key when no apiKey or userId', async () => {
      mockRedisClient.eval.mockResolvedValue([1, 50, 0])
      mockContext.get = vi.fn().mockReturnValue(null)
      ;(mockContext.req as any).header = vi.fn().mockImplementation((name: string) => {
        if (name === 'x-forwarded-for') return '1.2.3.4, 5.6.7.8'
        if (name === 'x-real-ip') return '1.2.3.4'
        return undefined
      })

      const middleware = tokenBucket()
      await middleware(mockContext as Context<OmaEnv>, mockNext)

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        "tb:ip:1.2.3.4",
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should calculate correct retryAfter on rate limit exceeded', async () => {
      const resetMs = 6000 // 6 seconds in milliseconds
      mockRedisClient.eval.mockResolvedValue([0, 0, resetMs])

      const middleware = tokenBucket()
      await middleware(mockContext as Context<OmaEnv>, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            retryAfter: 6,
          }),
        }),
        429
      )
    })

    it('should set minimum retryAfter of 1 second', async () => {
      mockRedisClient.eval.mockResolvedValue([0, 0, 100])

      const middleware = tokenBucket()
      await middleware(mockContext as Context<OmaEnv>, mockNext)

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            retryAfter: 1,
          }),
        }),
        429
      )
    })
  })

  describe('modelRateLimit middleware', () => {
    it('should skip rate limiting for GET requests', async () => {
      ;(mockContext.req as any).method = 'GET'

      const middleware = modelRateLimit()
      await middleware(mockContext as Context<OmaEnv>, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRedisClient.eval).not.toHaveBeenCalled()
    })

    it('should use default limits when model not in MODEL_LIMITS', async () => {
      mockRedisClient.eval.mockResolvedValue([1, 50, 0])
      ;(mockContext.req as any).json = vi.fn().mockResolvedValue({ model: 'unknown-model' })

      const middleware = modelRateLimit()
      await middleware(mockContext as Context<OmaEnv>, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('rateLimit middleware (fixed window)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should allow request when under limit', async () => {
      mockRedisClient.incr.mockResolvedValue(1)
      mockRedisClient.ttl.mockResolvedValue(59)

      const middleware = rateLimit({ windowMs: 60000, maxRequests: 60 })
      await middleware(mockContext as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '60')
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '59')
    })

    it('should reject when over limit', async () => {
      mockRedisClient.incr.mockResolvedValue(61)
      mockRedisClient.ttl.mockResolvedValue(45)

      const middleware = rateLimit({ windowMs: 60000, maxRequests: 60 })
      await middleware(mockContext as any, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'rate_limit_exceeded',
          }),
        }),
        429
      )
    })
  })
})