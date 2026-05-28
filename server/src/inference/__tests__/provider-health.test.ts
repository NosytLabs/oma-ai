import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRedisClientRef = vi.hoisted(() => ({
  current: null as any,
  ready: false,
}))

vi.mock('../../db/client.js', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}))

vi.mock('../../db/schema.js', () => ({
  providerHealth: {},
}))

vi.mock('../../lib/redis-client.js', () => ({
  getRedisClient: vi.fn(() => Promise.resolve(mockRedisClientRef.current)),
  isRedisReady: vi.fn(() => mockRedisClientRef.ready),
}))

vi.mock('../provider-factory.js', () => ({
  healthCheck: vi.fn().mockResolvedValue({ isUp: true, latencyMs: 100 }),
  getProviderBaseUrl: vi.fn().mockReturnValue('https://api.venice.ai'),
  getProviderHealthPath: vi.fn().mockReturnValue('/v1/models'),
}))

import {
  checkProviderHealth,
  reportProviderResult,
  isProviderAvailable,
  reserveProvider,
  releaseProvider,
  recordTraffic,
  startBackgroundProbing,
  stopBackgroundProbing,
  CircuitState,
} from '../provider-health.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockRedisClientRef.current = null
  mockRedisClientRef.ready = false
})

describe('CircuitState', () => {
  it('exports CLOSED, OPEN, and HALF_OPEN values', () => {
    expect(CircuitState.CLOSED).toBe('CLOSED')
    expect(CircuitState.OPEN).toBe('OPEN')
    expect(CircuitState.HALF_OPEN).toBe('HALF_OPEN')
  })
})

describe('checkProviderHealth', () => {
  it('returns a health record for a provider', async () => {
    const result = await checkProviderHealth('test-health' as any)
    expect(result).toHaveProperty('isUp')
    expect(result).toHaveProperty('latencyMs')
    expect(result).toHaveProperty('errorRate')
    expect(result).toHaveProperty('state')
    expect(result).toHaveProperty('consecutiveFailures')
  })

  it('creates initial record with CLOSED state and zero failures', async () => {
    const result = await checkProviderHealth('test-health' as any)
    expect(result.state).toBe(CircuitState.CLOSED)
    expect(result.consecutiveFailures).toBe(0)
    expect(result.isUp).toBe(true)
  })

  it('inserts initial record into the database', async () => {
    const { db } = await import('../../db/client.js')

    await checkProviderHealth('test-health-db' as any as any)

    expect(db.insert).toHaveBeenCalled()
    expect(vi.mocked(db.insert).mock.results[0]?.value?.values).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'test-health-db' as any, isUp: true, latencyMs: 0, errorRate: '0' }),
    )
  })

  it('does not include cooldownUntil when null', async () => {
    const result = await checkProviderHealth('test-health' as any)
    expect(result).not.toHaveProperty('cooldownUntil')
  })
})

describe('reportProviderResult — circuit breaker transitions', () => {
  it('increments consecutive failures on each failure', async () => {
    await checkProviderHealth('test-cb' as any)
    await reportProviderResult('test-cb' as any, false, 1000)
    expect((await checkProviderHealth('test-cb' as any)).consecutiveFailures).toBe(1)

    await reportProviderResult('test-cb' as any, false, 1000)
    expect((await checkProviderHealth('test-cb' as any)).consecutiveFailures).toBe(2)
  })

  it('resets consecutive failures to 0 on success after failures', async () => {
    await reportProviderResult('test-cb' as any, false, 1000)
    await reportProviderResult('test-cb' as any, false, 1000)

    await reportProviderResult('test-cb' as any, true, 100)

    const h = await checkProviderHealth('test-cb' as any)
    expect(h.consecutiveFailures).toBe(0)
    expect(h.state).toBe(CircuitState.CLOSED)
  })

  it('opens circuit after FAILURE_THRESHOLD (5) consecutive failures', async () => {
    for (let i = 0; i < 5; i++) {
      await reportProviderResult('test-cb' as any, false, 1000)
    }

    const h = await checkProviderHealth('test-cb' as any)
    expect(h.state).toBe(CircuitState.OPEN)
    expect(h.consecutiveFailures).toBe(5)
    expect(h.isUp).toBe(false)
    expect(h.cooldownUntil).toBeDefined()
  })

  it('tracks error rate and rolling latency average', async () => {
    await checkProviderHealth('test-cb-rate' as any)
    await reportProviderResult('test-cb-rate' as any, true, 100)
    await reportProviderResult('test-cb-rate' as any, true, 200)
    await reportProviderResult('test-cb-rate' as any, false, 300)

    const h = await checkProviderHealth('test-cb-rate' as any)
    expect(h.errorRate).toBeCloseTo(1 / 3, 4)
    expect(h.latencyMs).toBeGreaterThan(0)
  })

  it('does not change circuit state when report arrives in OPEN state', async () => {
    await checkProviderHealth('test-cb-open' as any)
    for (let i = 0; i < 5; i++) {
      await reportProviderResult('test-cb-open' as any, false, 1000)
    }
    expect((await checkProviderHealth('test-cb-open' as any)).state).toBe(CircuitState.OPEN)

    await reportProviderResult('test-cb-open' as any, true, 100)
    expect((await checkProviderHealth('test-cb-open' as any)).state).toBe(CircuitState.OPEN)
  })
})

describe('reportProviderResult — HALF_OPEN transitions (via Redis mock)', () => {
  function setupRedisWithOpenExpired(provider: string, cooldownUntil = '1') {
    mockRedisClientRef.current = {
      hGetAll: vi.fn().mockResolvedValue({
        state: 'OPEN',
        consecutiveFailures: '5',
        lastFailureAt: '1000',
        isUp: 'false',
        latencyMs: '500',
        errorRate: '0.5000',
        totalRequests: '5',
        errorCount: '5',
        cooldownUntil,
      }),
      hSet: vi.fn().mockResolvedValue(undefined),
      setEx: vi.fn().mockResolvedValue('OK'),
    }
    mockRedisClientRef.ready = true
  }

  it('transitions from HALF_OPEN to CLOSED on success', async () => {
    setupRedisWithOpenExpired('test-half-close' as any)

    await isProviderAvailable('test-half-close' as any)
    expect((await checkProviderHealth('test-half-close' as any)).state).toBe(CircuitState.HALF_OPEN)

    await reportProviderResult('test-half-close' as any, true, 100)

    const h = await checkProviderHealth('test-half-close' as any)
    expect(h.state).toBe(CircuitState.CLOSED)
    expect(h.consecutiveFailures).toBe(0)
  })

  it('transitions from HALF_OPEN back to OPEN on failure', async () => {
    setupRedisWithOpenExpired('test-half-fail' as any)

    await isProviderAvailable('test-half-fail' as any)
    expect((await checkProviderHealth('test-half-fail' as any)).state).toBe(CircuitState.HALF_OPEN)

    await reportProviderResult('test-half-fail' as any, false, 1000)

    const h = await checkProviderHealth('test-half-fail' as any)
    expect(h.state).toBe(CircuitState.OPEN)
    expect(h.isUp).toBe(false)
  })
})

describe('isProviderAvailable', () => {
  it('returns true for a healthy provider (CLOSED state)', async () => {
    await checkProviderHealth('test-avail' as any)
    expect(await isProviderAvailable('test-avail' as any)).toBe(true)
  })

  it('returns false when circuit is OPEN with active cooldown', async () => {
    for (let i = 0; i < 5; i++) {
      await reportProviderResult('test-avail' as any, false, 1000)
    }
    expect(await isProviderAvailable('test-avail' as any)).toBe(false)
  })

  it('transitions to HALF_OPEN and returns true when cooldown has expired', async () => {
    mockRedisClientRef.current = {
      hGetAll: vi.fn().mockResolvedValue({
        state: 'OPEN',
        consecutiveFailures: '5',
        lastFailureAt: '0',
        isUp: 'false',
        latencyMs: '500',
        errorRate: '0.5000',
        totalRequests: '5',
        errorCount: '5',
        cooldownUntil: '1',
      }),
      hSet: vi.fn().mockResolvedValue(undefined),
    }
    mockRedisClientRef.ready = true

    expect(await isProviderAvailable('test-avail-redis' as any)).toBe(true)

    const h = await checkProviderHealth('test-avail-redis' as any)
    expect(h.state).toBe(CircuitState.HALF_OPEN)
  })

  it('returns false when pending request limit is reached', async () => {
    await checkProviderHealth('test-avail-pending' as any)
    reserveProvider('test-avail-pending' as any, 'req-1')
    reserveProvider('test-avail-pending' as any, 'req-2')
    reserveProvider('test-avail-pending' as any, 'req-3')

    expect(await isProviderAvailable('test-avail-pending' as any)).toBe(false)
  })
})

describe('reserveProvider / releaseProvider', () => {
  it('reserves a slot when under the limit', () => {
    expect(reserveProvider('test-reserve' as any, 'req-1')).toBe(true)
  })

  it('returns false when MAX_PENDING_PER_PROVIDER (3) is reached', () => {
    expect(reserveProvider('test-reserve' as any, 'req-1')).toBe(true)
    expect(reserveProvider('test-reserve' as any, 'req-2')).toBe(true)
    expect(reserveProvider('test-reserve' as any, 'req-3')).toBe(true)
    expect(reserveProvider('test-reserve' as any, 'req-4')).toBe(false)
  })

  it('releases a reservation and allows new reserves', () => {
    releaseProvider('test-reserve' as any, 'req-2')
    expect(reserveProvider('test-reserve' as any, 'req-4')).toBe(true)
  })

  it('does not throw when releasing for an unknown provider', () => {
    expect(() => releaseProvider('test-unknown' as any, 'req-1')).not.toThrow()
  })

  it('cleans up empty pending set after releasing last reservation', () => {
    releaseProvider('test-reserve' as any, 'req-1')
    releaseProvider('test-reserve' as any, 'req-3')
    releaseProvider('test-reserve' as any, 'req-4')
    expect(reserveProvider('test-reserve' as any, 'req-5')).toBe(true)
  })
})

describe('recordTraffic', () => {
  it('records last traffic timestamp without throwing', () => {
    expect(() => recordTraffic('venice')).not.toThrow()
  })
})

describe('background probing', () => {
  it('starts interval without throwing', () => {
    expect(() => startBackgroundProbing()).not.toThrow()
    stopBackgroundProbing()
  })

  it('stops interval without throwing', () => {
    startBackgroundProbing()
    expect(() => stopBackgroundProbing()).not.toThrow()
  })

  it('does not create a second interval on duplicate start', () => {
    startBackgroundProbing()
    startBackgroundProbing()
    stopBackgroundProbing()
  })

  it('can be restarted after being stopped', () => {
    startBackgroundProbing()
    stopBackgroundProbing()
    expect(() => startBackgroundProbing()).not.toThrow()
    stopBackgroundProbing()
  })
})

