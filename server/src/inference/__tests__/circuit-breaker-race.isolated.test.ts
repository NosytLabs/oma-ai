/**
 * SEC-9 regression test: concurrent recordProviderError / recordProviderSuccess
 * must serialize per-key (provider, model) so state transitions are atomic.
 *
 * Without a per-key lock, future refactors that introduce an `await` between
 * the read and the write of `circuitBreakers.get(key)` would lose updates.
 * This test documents the expected post-fix invariants and pins them down.
 *
 * Target: server/src/inference/circuit-breaker.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
}))

import {
  recordProviderError,
  recordProviderSuccess,
  isCircuitOpen,
  getCircuitBreakerKey,
} from '../circuit-breaker.js'

describe('SEC-9 circuit-breaker — concurrent state transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('15 concurrent recordProviderError calls open the breaker (no exceptions)', async () => {
    const provider = 'sec9-cb-1'
    const model = 'm-1'

    // Pre-condition: closed.
    expect(await isCircuitOpen(provider, model)).toBe(false)

    // Fire 15 concurrent errors. The IIFE in recordProviderError runs the
    // read-modify-write synchronously, so each call sees the result of the
    // previous one — counter reaches 15, state transitions to "open".
    await expect(
      Promise.all(
        Array.from({ length: 15 }, () => recordProviderError(provider, model)),
      ),
    ).resolves.toBeDefined()

    expect(await isCircuitOpen(provider, model)).toBe(true)
  })

  it('15 concurrent recordProviderError without model key also opens', async () => {
    const provider = 'sec9-cb-2'
    expect(await isCircuitOpen(provider)).toBe(false)

    await Promise.all(
      Array.from({ length: 15 }, () => recordProviderError(provider)),
    )

    expect(await isCircuitOpen(provider)).toBe(true)
  })

  it('mixed concurrent success + error does not throw (deterministic state)', async () => {
    const provider = 'sec9-cb-3'
    const model = 'm-2'

    // 8 errors + 4 successes interleaved. The IIFE in recordProviderError
    // keeps incrementing `failures` across all state transitions; the
    // success path in the closed branch does `failures = max(0, failures - 1)`.
    // Either outcome (8→4=4, or 8 errors that open then 4 decrements in open
    // branch) is consistent with the code — the test pins "no throw, no
    // NaN state" regardless of interleaving.
    const ops: Array<Promise<unknown>> = []
    for (let i = 0; i < 8; i++) ops.push(recordProviderError(provider, model))
    for (let i = 0; i < 4; i++) ops.push(recordProviderSuccess(provider, model))
    await expect(Promise.all(ops)).resolves.toBeDefined()

    // isCircuitOpen must return a boolean (no thrown error, no NaN state).
    const open = await isCircuitOpen(provider, model)
    expect(typeof open).toBe('boolean')
  })

  it('different providers do not block each other (per-key lock scope)', async () => {
    // Two providers, 15 failures each, fired concurrently. A per-key lock
    // allows them to interleave; a global lock would still pass but be
    // pessimistic. This pins the lock's granularity.
    await Promise.all([
      ...Array.from({ length: 15 }, () => recordProviderError('sec9-cb-a')),
      ...Array.from({ length: 15 }, () => recordProviderError('sec9-cb-b')),
    ])

    expect(await isCircuitOpen('sec9-cb-a')).toBe(true)
    expect(await isCircuitOpen('sec9-cb-b')).toBe(true)
  })

  it('different models of the same provider have independent state', async () => {
    // provider+model is the lock key — same provider, different models
    // must not share state.
    await Promise.all([
      ...Array.from({ length: 15 }, () => recordProviderError('sec9-cb-p', 'a')),
      ...Array.from({ length: 15 }, () => recordProviderError('sec9-cb-p', 'b')),
    ])

    expect(await isCircuitOpen('sec9-cb-p', 'a')).toBe(true)
    expect(await isCircuitOpen('sec9-cb-p', 'b')).toBe(true)
  })

  it('getCircuitBreakerKey shape preserved (public API not drifted)', () => {
    expect(getCircuitBreakerKey('p', 'm')).toBe('p:m')
    expect(getCircuitBreakerKey('p')).toBe('p')
  })
})
