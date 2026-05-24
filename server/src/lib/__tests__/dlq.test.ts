import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addToDlq, getDlqEntries, retryFromDlq, clearDlq } from '../dlq.js'

let redisAvailable = true

const mockRedisClient = vi.hoisted(() => ({
  lPush: vi.fn().mockImplementation(() => {
    if (!redisAvailable) throw new Error('Redis not available')
    return 1
  }),
  lRange: vi.fn().mockImplementation(() => {
    if (!redisAvailable) return []
    return []
  }),
  lTrim: vi.fn().mockImplementation(() => {
    if (!redisAvailable) throw new Error('Redis not available')
    return 'OK'
  }),
  lLen: vi.fn().mockImplementation(() => {
    if (!redisAvailable) return 0
    return 0
  }),
  del: vi.fn().mockImplementation(() => {
    if (!redisAvailable) throw new Error('Redis not available')
    return 1
  }),
}))

vi.mock('../redis-client.js', () => ({
  getRedisClient: vi.fn().mockImplementation(() => {
    return redisAvailable ? Promise.resolve(mockRedisClient) : Promise.resolve(null)
  }),
}))

describe('DLQ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redisAvailable = true
  })

  describe('addToDlq', () => {
    it('pushes entry to Redis DLQ list', async () => {
      await addToDlq('onramp', '{"sessionId":"test-123"}', 'Network timeout')

      expect(mockRedisClient.lPush).toHaveBeenCalledWith(
        'webhook:dlq',
        expect.stringContaining('"provider":"onramp"')
      )
    })

    it('handles Redis connection failure gracefully', async () => {
      redisAvailable = false

      const result = await addToDlq('onramp', '{"sessionId":"test-123"}', 'Connection refused')

      expect(result).toBeUndefined()
    })
  })

  describe('getDlqEntries', () => {
    it('returns entries from DLQ list', async () => {
      const entries = [
        JSON.stringify({ provider: 'onramp', body: '{"sessionId":"1"}', error: 'timeout', timestamp: '2025-01-01T00:00:00Z' }),
        JSON.stringify({ provider: 'deposit', body: '{"txHash":"0xabc"}', error: 'retry', timestamp: '2025-01-02T00:00:00Z' }),
      ]
      mockRedisClient.lRange.mockResolvedValueOnce(entries)

      const result = await getDlqEntries(0, 10)

      expect(result).toHaveLength(2)
      expect(result[0].provider).toBe('onramp')
      expect(result[1].provider).toBe('deposit')
    })

    it('returns empty array when DLQ is empty', async () => {
      mockRedisClient.lRange.mockResolvedValueOnce([])

      const result = await getDlqEntries(0, 10)

      expect(result).toEqual([])
    })

    it('returns empty array when Redis unavailable', async () => {
      redisAvailable = false

      const result = await getDlqEntries(0, 10)

      expect(result).toEqual([])
    })
  })

  describe('retryFromDlq', () => {
    it('pops entry from DLQ and returns it', async () => {
      const entry = { provider: 'onramp', body: '{"sessionId":"test"}', error: 'timeout', timestamp: '2025-01-01T00:00:00Z' }
      mockRedisClient.lRange.mockResolvedValueOnce([JSON.stringify(entry)])
      mockRedisClient.lTrim.mockResolvedValueOnce('OK')

      const result = await retryFromDlq()

      expect(result).toEqual(entry)
      expect(mockRedisClient.lTrim).toHaveBeenCalledWith('webhook:dlq', 1, -1)
    })

    it('returns null when DLQ is empty', async () => {
      mockRedisClient.lRange.mockResolvedValueOnce([])

      const result = await retryFromDlq()

      expect(result).toBeNull()
    })

    it('returns null when Redis unavailable', async () => {
      redisAvailable = false

      const result = await retryFromDlq()

      expect(result).toBeNull()
    })
  })

  describe('clearDlq', () => {
    it('deletes the DLQ list', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1)

      const result = await clearDlq()

      expect(result).toBe(true)
      expect(mockRedisClient.del).toHaveBeenCalledWith('webhook:dlq')
    })

    it('returns false when Redis unavailable', async () => {
      redisAvailable = false

      const result = await clearDlq()

      expect(result).toBe(false)
    })
  })
})