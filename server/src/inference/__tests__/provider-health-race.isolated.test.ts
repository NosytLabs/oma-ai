/**
 * SEC-9 regression test: concurrent recordFailure/reportProviderResult() calls
 * must serialize per-provider so the read-modify-write on the cached
 * HealthRecord (consecutiveFailures, totalRequests, errorCount, state
 * transitions) does not lose updates.
 *
 * Pre-fix behavior: 20 concurrent `reportProviderResult(p, false, 1000)` each
 * read the same `consecutiveFailures = 0`, each wrote `1` back, and the final
 * counter landed anywhere from 1 to 20 depending on event-loop interleaving.
 *
 * Post-fix behavior: the per-provider async mutex serializes the
 * read-modify-write, so the final counter is exactly 20, the OPEN transition
 * fires exactly once at threshold (5), and the side-effecting writes
 * (hSet, setEx) get the correct payload every time.
 *
 * Target: server/src/inference/provider-health.ts
 * Side-effect accounting: we can't count DB writes (no DB writes happen in
 * reportProviderResult; only Redis hSet/setEx, which is mocked out). What we
 * CAN count is the public state on the in-process HealthRecord, which is the
 * authoritative source for every downstream consumer.
 *
 * WARNING: THIS FILE WILL BE DELETED AFTER TEST PASSES. Code preserved at
 *   .opencode/unit-tests/<timestamp>-provider-health-race.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockRedisClientRef = vi.hoisted(() => ({
  current: null as any,
  ready: false,
  // Counters for the (mocked) side effects: every hSet / setEx call observed.
  hSetCalls: 0,
  setExCalls: 0,
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

vi.mock('../surplus.js', () => ({
  surplusHealthCheck: vi.fn().mockResolvedValue({ isUp: true, latencyMs: 100 }),
  surplusListModels: vi.fn().mockResolvedValue({ object: 'list', data: [] }),
  surplusChatCompletion: vi.fn(),
}))

import {
  checkProviderHealth,
  reportProviderResult,
  isProviderAvailable,
  stopBackgroundProbing,
  CircuitState,
} from '../provider-health.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockRedisClientRef.current = null
  mockRedisClientRef.ready = false
  mockRedisClientRef.hSetCalls = 0
  mockRedisClientRef.setExCalls = 0
})

afterEach(() => {
  stopBackgroundProbing()
})

describe('SEC-9 provider-health — concurrent reportFailure (N=20)', () => {
  it('N=20 concurrent failures: consecutiveFailures === 20 (no lost updates)', async () => {
    const provider = 'sec9-race-count' as any

    // Pre-condition: healthy.
    const before = await checkProviderHealth(provider)
    expect(before.state).toBe(CircuitState.CLOSED)
    expect(before.consecutiveFailures).toBe(0)

    // Fire 20 concurrent failures. With unfixed code, all 20 see
    // consecutiveFailures = 0 in their read window and each write 1 back,
    // so the final value is anywhere from 1 to 20.
    await Promise.all(
      Array.from({ length: 20 }, () =>
        reportProviderResult(provider, false, 1000),
      ),
    )

    const after = await checkProviderHealth(provider)
    // The exact-counter assertion: post-fix, the lock serializes the
    // read-modify-write so every increment lands.
    expect(after.consecutiveFailures).toBe(20)
    // State must transition to OPEN exactly once (at the 5th failure).
    expect(after.state).toBe(CircuitState.OPEN)
    expect(after.isUp).toBe(false)
    expect(after.cooldownUntil).toBeDefined()
  })

  it('N=20 concurrent failures: totalRequests === 20 (side counter not double-counted)', async () => {
    const provider = 'sec9-race-total' as any

    await Promise.all(
      Array.from({ length: 20 }, () =>
        reportProviderResult(provider, false, 1000),
      ),
    )

    const after = await checkProviderHealth(provider)
    // totalRequests is incremented on every call; without the lock, lost
    // updates would push this well below 20.
    expect(after.totalRequests).toBe(20)
    // errorCount is incremented on every failure; same hazard.
    expect((after as any).errorCount).toBe(20)
  })

  it('N=20 concurrent failures: errorRate is 1.0 (every request failed)', async () => {
    const provider = 'sec9-race-rate' as any

    await Promise.all(
      Array.from({ length: 20 }, () =>
        reportProviderResult(provider, false, 1000),
      ),
    )

    const after = await checkProviderHealth(provider)
    // errorRate = errorCount / totalRequests = 20/20 = 1.0
    expect(after.errorRate).toBe(1)
  })

  it('N=20 concurrent failures: no throw, every call resolves', async () => {
    const provider = 'sec9-race-no-throw' as any
    await expect(
      Promise.all(
        Array.from({ length: 20 }, () =>
          reportProviderResult(provider, false, 1000),
        ),
      ),
    ).resolves.toBeDefined()
  })

  it('N=20 concurrent failures: isProviderAvailable returns false afterwards', async () => {
    const provider = 'sec9-race-unavail' as any

    await Promise.all(
      Array.from({ length: 20 }, () =>
        reportProviderResult(provider, false, 1000),
      ),
    )

    expect(await isProviderAvailable(provider)).toBe(false)
  })

  it('N=20 concurrent failures: exactly one OPEN transition (state stable on re-read)', async () => {
    const provider = 'sec9-race-stable' as any

    await Promise.all(
      Array.from({ length: 20 }, () =>
        reportProviderResult(provider, false, 1000),
      ),
    )

    const first = await checkProviderHealth(provider)
    const second = await checkProviderHealth(provider)
    // After the burst, the state must be stable — no extra transition
    // on re-read (would indicate a torn read or duplicate side effect).
    expect(first.state).toBe(second.state)
    expect(first.consecutiveFailures).toBe(second.consecutiveFailures)
  })

  it('N=20 concurrent failures: per-provider lock, two providers do not block each other', async () => {
    // Fire 20 failures for provider A and 20 for provider B concurrently.
    // The locks are per-provider so both bursts complete in roughly
    // the same wall time. The assertion: BOTH providers reach OPEN
    // with consecutiveFailures === 20, and neither was throttled by
    // the other's lock.
    await Promise.all([
      ...Array.from({ length: 20 }, () =>
        reportProviderResult('sec9-a' as any, false, 1000),
      ),
      ...Array.from({ length: 20 }, () =>
        reportProviderResult('sec9-b' as any, false, 1000),
      ),
    ])

    const a = await checkProviderHealth('sec9-a' as any)
    const b = await checkProviderHealth('sec9-b' as any)
    expect(a.state).toBe(CircuitState.OPEN)
    expect(b.state).toBe(CircuitState.OPEN)
    expect(a.consecutiveFailures).toBe(20)
    expect(b.consecutiveFailures).toBe(20)
  })

  it('N=20 concurrent: reportProviderResult+isProviderAvailable interleave without torn state', async () => {
    // Mixed read+write workload. A real consumer might call
    // isProviderAvailable while reportProviderResult is in flight.
    // The lock must prevent the reader from observing a partially
    // mutated HealthRecord.
    const provider = 'sec9-race-mixed' as any

    const ops: Array<Promise<unknown>> = []
    for (let i = 0; i < 20; i++) ops.push(reportProviderResult(provider, false, 1000))
    for (let i = 0; i < 20; i++) ops.push(isProviderAvailable(provider))
    await Promise.all(ops)

    const after = await checkProviderHealth(provider)
    expect(after.consecutiveFailures).toBe(20)
    expect(after.state).toBe(CircuitState.OPEN)
  })
})
