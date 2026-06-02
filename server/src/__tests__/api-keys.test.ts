import { describe, it, expect, vi, beforeEach } from 'vitest'

const { queryQueue, redisState } = vi.hoisted(() => ({
  queryQueue: [] as Array<{ type: string; payload: unknown }>,
  redisState: { cache: new Map<string, string | null>() },
}))

vi.mock('../db/client.js', () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => ({
        returning: async () => {
          queryQueue.push({ type: 'insert', payload: v })
          return [
            {
              id: 'key-1',
              userId: (v as { userId: string }).userId,
              name: (v as { name: string }).name,
              keyHash: (v as { keyHash: string }).keyHash,
              keyPrefix: (v as { keyPrefix: string }).keyPrefix,
              active: true,
              createdAt: new Date('2026-01-01T00:00:00Z'),
              expiresAt: (v as { expiresAt: Date | null }).expiresAt,
            },
          ]
        },
      }),
    }),
    select: () => {
      const captured: { conditions: unknown } = { conditions: null }
      return {
        from: () => ({
          where: (cond: unknown) => {
            captured.conditions = cond
            return {
              for: () => {
                queryQueue.push({ type: 'select-for-update', payload: captured.conditions })
                return Promise.resolve([])
              },
              limit: (n: number) => {
                queryQueue.push({ type: 'select-limit', payload: { cond: captured.conditions, n } })
                return Promise.resolve([])
              },
            }
          },
        }),
      }
    },
    update: () => ({
      set: () => ({
        where: (cond: unknown) => ({
          returning: async () => {
            queryQueue.push({ type: 'update', payload: cond })
            return []
          },
        }),
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () => ({
              for: () => {
                const stored = queryQueue.shift()
                if (stored && stored.type === 'insert') {
                  const v = stored.payload as { keyHash: string; keyPrefix: string; userId: string }
                  return Promise.resolve([
                    {
                      id: 'key-1',
                      userId: v.userId,
                      name: 'test',
                      keyHash: v.keyHash,
                      keyPrefix: v.keyPrefix,
                      active: true,
                      createdAt: new Date('2026-01-01T00:00:00Z'),
                      expiresAt: null,
                    },
                  ])
                }
                return Promise.resolve([])
              },
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: async () => {
              return
            },
          }),
        }),
      }
      return fn(tx)
    },
  },
}))

vi.mock('../lib/redis-client.js', () => ({
  getRedisClient: async () => {
    return {
      get: async (k: string) => redisState.cache.get(k) ?? null,
      setEx: async (k: string, _ttl: number, v: string) => {
        redisState.cache.set(k, v)
      },
    }
  },
}))

vi.mock('../config.js', () => ({
  config: {
    DEFAULT_KEY_EXPIRY_DAYS: 0,
  },
}))

import { createApiKey, validateApiKey } from '../auth/api-keys.js'
import crypto from 'crypto'

describe('api-keys prefix integrity (HIGH-1 regression)', () => {
  beforeEach(() => {
    queryQueue.length = 0
    redisState.cache.clear()
  })

  it('stores plaintext keyPrefix matching the first 12 chars of the raw key', async () => {
    const { key, prefix } = await createApiKey('user-1', 'test-key')
    expect(key.startsWith('oma_sk_')).toBe(true)
    expect(prefix).toBe(key.slice(0, 12))
    expect(prefix.length).toBe(12)
  })

  it('validates a freshly-created key (prefix check no longer breaks the hash match)', async () => {
    const { key } = await createApiKey('user-2', 'roundtrip')

    redisState.cache.clear()

    const result = await validateApiKey(key)
    expect(result).not.toBeNull()
    expect(result?.userId).toBe('user-2')
    expect(result?.keyPrefix).toBe(key.slice(0, 12))
  })

  it('validates a key via the redis cache (cached path)', async () => {
    const raw = 'oma_sk_cachedkeyprefix1234567890abcdef1234567890'
    const keyHash = crypto.createHash('sha256').update(raw).digest('hex')
    redisState.cache.set(
      `apikey:${keyHash}`,
      JSON.stringify({
        id: 'key-1',
        userId: 'user-3',
        name: 'cached',
        keyHash,
        keyPrefix: raw.slice(0, 12),
        active: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        expiresAt: null,
      }),
    )

    const result = await validateApiKey(raw)
    expect(result).not.toBeNull()
    expect(result?.userId).toBe('user-3')
  })

  it('rejects a key whose prefix does not match the stored prefix', async () => {
    const result = await validateApiKey('oma_sk_invalidprefixxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
    expect(result).toBeNull()
  })
})
