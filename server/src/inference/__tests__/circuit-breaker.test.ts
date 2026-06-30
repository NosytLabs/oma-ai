import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
}))

import {
  getCircuitBreakerKey,
} from '../circuit-breaker.js'

describe('Circuit Breaker', () => {
  describe('getCircuitBreakerKey', () => {
    it('returns provider:model format when model provided', () => {
      expect(getCircuitBreakerKey('venice', 'deepseek-v3-2')).toBe('venice:deepseek-v3-2')
    })

    it('returns provider only when no model', () => {
      expect(getCircuitBreakerKey('venice')).toBe('venice')
    })
  })
})