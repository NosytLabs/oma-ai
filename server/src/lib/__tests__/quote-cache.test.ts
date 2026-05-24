import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QuoteCache } from '../quote-cache.js'

const mockRedisClient = vi.hoisted(() => ({
  setEx: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  set: vi.fn(),
  eval: vi.fn(),
  lPush: vi.fn(),
  ping: vi.fn(),
}))

vi.mock('../redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(mockRedisClient),
}))

describe('QuoteCache', () => {
  let cache: QuoteCache

  beforeEach(() => {
    vi.clearAllMocks()
    cache = new QuoteCache({
      ttlMs: 86_400_000,
      lockTtlMs: 30_000,
    })
  })

  describe('set', () => {
    it('stores session with TTL and returns true', async () => {
      mockRedisClient.setEx.mockResolvedValue('OK')

      const session = {
        id: 'session-123',
        userId: 'user-456',
        amountUsd: 100,
        creditsCents: 9700,
        fiatFeeCents: 290,
        status: 'pending' as const,
        createdAt: Date.now(),
      }

      const result = await cache.set(session)

      expect(result).toBe(true)
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'quote:session:session-123',
        86400,
        expect.any(String)
      )
    })

    it('returns false when Redis operation fails', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'))

      const session = {
        id: 'session-123',
        userId: 'user-456',
        amountUsd: 100,
        creditsCents: 9700,
        fiatFeeCents: 290,
        status: 'pending' as const,
        createdAt: Date.now(),
      }

      const result = await cache.set(session)

      expect(result).toBe(false)
    })
  })

  describe('get', () => {
    it('retrieves session by id', async () => {
      const session = {
        id: 'session-123',
        userId: 'user-456',
        amountUsd: 100,
        creditsCents: 9700,
        fiatFeeCents: 290,
        status: 'pending' as const,
        createdAt: Date.now(),
      }

      mockRedisClient.get.mockResolvedValue(JSON.stringify(session))

      const result = await cache.get('session-123')

      expect(result).toEqual(session)
      expect(mockRedisClient.get).toHaveBeenCalledWith('quote:session:session-123')
    })

    it('returns null when session not found', async () => {
      mockRedisClient.get.mockResolvedValue(null)

      const result = await cache.get('nonexistent')

      expect(result).toBeNull()
    })

    it('returns null when Redis error occurs', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'))

      const result = await cache.get('session-123')

      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('removes session by id', async () => {
      mockRedisClient.del.mockResolvedValue(1)

      const result = await cache.delete('session-123')

      expect(result).toBe(true)
      expect(mockRedisClient.del).toHaveBeenCalledWith('quote:session:session-123')
    })

    it('returns false when Redis error occurs', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'))

      const result = await cache.delete('session-123')

      expect(result).toBe(false)
    })
  })

  describe('acquireLock', () => {
    it('acquires lock using SETNX pattern', async () => {
      mockRedisClient.set.mockResolvedValue('OK')

      const result = await cache.acquireLock('session-123', 'worker-1')

      expect(result).toBe(true)
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'quote:lock:session-123',
        'worker-1',
        { EX: 30, NX: true }
      )
    })

    it('returns false when lock already held', async () => {
      mockRedisClient.set.mockResolvedValue(null)

      const result = await cache.acquireLock('session-123', 'worker-1')

      expect(result).toBe(false)
    })

    it('returns false when Redis error occurs', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'))

      const result = await cache.acquireLock('session-123', 'worker-1')

      expect(result).toBe(false)
    })
  })

  describe('releaseLock', () => {
    it('releases lock using Lua script for atomicity', async () => {
      mockRedisClient.eval.mockResolvedValue(1)

      const result = await cache.releaseLock('session-123', 'worker-1')

      expect(result).toBe(true)
      expect(mockRedisClient.eval).toHaveBeenCalled()
    })

    it('returns false when Redis error occurs', async () => {
      mockRedisClient.eval.mockRejectedValue(new Error('Redis error'))

      const result = await cache.releaseLock('session-123', 'worker-1')

      expect(result).toBe(false)
    })
  })

  describe('updateStatus', () => {
    it('updates session status atomically', async () => {
      const session = {
        id: 'session-123',
        userId: 'user-456',
        amountUsd: 100,
        creditsCents: 9700,
        fiatFeeCents: 290,
        status: 'pending' as const,
        createdAt: Date.now(),
      }

      mockRedisClient.get.mockResolvedValue(JSON.stringify(session))
      mockRedisClient.setEx.mockResolvedValue('OK')

      const result = await cache.updateStatus('session-123', 'completed')

      expect(result).toBe(true)
      const updatedCall = mockRedisClient.setEx.mock.calls[0]
      const updatedSession = JSON.parse(updatedCall[2])
      expect(updatedSession.status).toBe('completed')
    })

    it('returns false when session not found', async () => {
      mockRedisClient.get.mockResolvedValue(null)

      const result = await cache.updateStatus('nonexistent', 'completed')

      expect(result).toBe(false)
    })
  })

  describe('health', () => {
    it('returns healthy status when Redis responds', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG')

      const status = await cache.health()

      expect(status).toEqual({ healthy: true, redis: true })
    })

    it('returns unhealthy when Redis times out', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('timeout'))

      const status = await cache.health()

      expect(status).toEqual({ healthy: false, redis: false })
    })
  })
})