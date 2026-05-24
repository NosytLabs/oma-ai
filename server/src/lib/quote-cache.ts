import { getRedisClient } from './redis-client.js'

export interface PendingSession {
  id: string
  userId: string
  amountUsd: number
  creditsCents: number
  fiatFeeCents: number
  status: 'pending' | 'completed' | 'expired'
  createdAt: number
}

interface QuoteCacheOptions {
  ttlMs: number
  lockTtlMs: number
}

export class QuoteCache {
  private ttlSec: number
  private lockTtlSec: number

  constructor(options: QuoteCacheOptions) {
    this.ttlSec = Math.floor(options.ttlMs / 1000)
    this.lockTtlSec = Math.floor(options.lockTtlMs / 1000)
  }

  private sessionKey(id: string): string {
    return `quote:session:${id}`
  }

  private lockKey(id: string): string {
    return `quote:lock:${id}`
  }

  async set(session: PendingSession): Promise<boolean> {
    const redis = await getRedisClient()
    if (!redis) return false

    try {
      await redis.setEx(this.sessionKey(session.id), this.ttlSec, JSON.stringify(session))
      return true
    } catch {
      return false
    }
  }

  async get(id: string): Promise<PendingSession | null> {
    const redis = await getRedisClient()
    if (!redis) return null

    try {
      const data = await redis.get(this.sessionKey(id))
      if (!data) return null
      return JSON.parse(data) as PendingSession
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    const redis = await getRedisClient()
    if (!redis) return false

    try {
      await redis.del(this.sessionKey(id))
      return true
    } catch {
      return false
    }
  }

  async acquireLock(id: string, workerId: string): Promise<boolean> {
    const redis = await getRedisClient()
    if (!redis) return false

    try {
      const result = await redis.set(this.lockKey(id), workerId, {
        EX: this.lockTtlSec,
        NX: true,
      })
      return result === 'OK'
    } catch {
      return false
    }
  }

  async releaseLock(id: string, workerId: string): Promise<boolean> {
    const redis = await getRedisClient()
    if (!redis) return false

    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `

    try {
      const result = await redis.eval(luaScript, {
        keys: [this.lockKey(id)],
        arguments: [workerId],
      })
      return (result as number) === 1
    } catch {
      return false
    }
  }

  async updateStatus(id: string, status: PendingSession['status']): Promise<boolean> {
    const redis = await getRedisClient()
    if (!redis) return false

    try {
      const data = await redis.get(this.sessionKey(id))
      if (!data) return false

      const session = JSON.parse(data) as PendingSession
      session.status = status

      await redis.setEx(this.sessionKey(id), this.ttlSec, JSON.stringify(session))
      return true
    } catch {
      return false
    }
  }

  async health(): Promise<{ healthy: boolean; redis: boolean }> {
    const redis = await getRedisClient()
    if (!redis) return { healthy: false, redis: false }

    try {
      await redis.ping()
      return { healthy: true, redis: true }
    } catch {
      return { healthy: false, redis: false }
    }
  }
}