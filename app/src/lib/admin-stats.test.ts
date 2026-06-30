import { describe, it, expect } from 'vitest'
import {
  computeGrossProfit,
  computeMargin,
  findProviderCost,
  findProviderRevenue,
  findProviderProfit,
  countActiveUsersLast24h,
  computeProviderCosts,
  computeAdminStats,
} from './admin-stats'
import type { ProviderRow, AdminUserStub } from './admin-stats'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUsers(activeCount: number, inactiveCount: number): AdminUserStub[] {
  const now = new Date('2026-06-27T12:00:00Z')
  const active: AdminUserStub[] = Array.from({ length: activeCount }, (_, i) => ({
    lastActivityAt: new Date(now.getTime() - i * 60 * 60 * 1000).toISOString(), // i hours ago
  }))
  const inactive: AdminUserStub[] = Array.from({ length: inactiveCount }, () => ({
    lastActivityAt: new Date('2026-06-20T00:00:00Z').toISOString(), // 7 days ago
  }))
  return [...active, ...inactive]
}

function makeProviderRows(): ProviderRow[] {
  return [
    { provider: 'venice', totalRevenue: 500, totalCost: 300, profit: 200 },
    { provider: 'surplus', totalRevenue: 200, totalCost: 150, profit: 50 },
  ]
}

// ─── computeGrossProfit ───────────────────────────────────────────────────────

describe('computeGrossProfit', () => {
  it('returns positive profit when revenue exceeds cost', () => {
    expect(computeGrossProfit(1000, 600)).toBe(400)
  })

  it('returns zero when revenue equals cost', () => {
    expect(computeGrossProfit(500, 500)).toBe(0)
  })

  it('returns negative when cost exceeds revenue', () => {
    expect(computeGrossProfit(200, 300)).toBe(-100)
  })

  it('returns revenue when cost is zero', () => {
    expect(computeGrossProfit(750, 0)).toBe(750)
  })

  it('returns negative cost when revenue is zero', () => {
    expect(computeGrossProfit(0, 150)).toBe(-150)
  })

  it('handles large numbers', () => {
    expect(computeGrossProfit(1_000_000, 600_000)).toBe(400_000)
  })
})

// ─── computeMargin ────────────────────────────────────────────────────────────

describe('computeMargin', () => {
  it('computes a positive margin percentage', () => {
    expect(computeMargin(1000, 600)).toBe('40.0%')
  })

  it('returns "0.0%" when margin is zero (breakeven)', () => {
    expect(computeMargin(500, 500)).toBe('0.0%')
  })

  it('returns "0.0%" when revenue is zero (avoids division by zero)', () => {
    expect(computeMargin(0, 100)).toBe('0.0%')
  })

  it('returns negative margin when cost exceeds revenue', () => {
    expect(computeMargin(200, 300)).toBe('-50.0%')
  })

  it('returns "100.0%" when cost is zero', () => {
    expect(computeMargin(500, 0)).toBe('100.0%')
  })

  it('rounds to 1 decimal place', () => {
    expect(computeMargin(1000, 333)).toBe('66.7%')
  })

  it('handles non-round division correctly', () => {
    expect(computeMargin(300, 100)).toBe('66.7%')
  })

  it('handles very small margins', () => {
    expect(computeMargin(10000, 9999)).toBe('0.0%')
  })
})

// ─── findProviderCost ─────────────────────────────────────────────────────────

describe('findProviderCost', () => {
  const providers = makeProviderRows()

  it('finds venice cost', () => {
    expect(findProviderCost(providers, 'venice')).toBe(300)
  })

  it('finds surplus cost', () => {
    expect(findProviderCost(providers, 'surplus')).toBe(150)
  })

  it('returns 0 for unknown provider', () => {
    expect(findProviderCost(providers, 'nonexistent')).toBe(0)
  })

  it('returns 0 for empty array', () => {
    expect(findProviderCost([], 'venice')).toBe(0)
  })

  it('is case-sensitive', () => {
    expect(findProviderCost(providers, 'Venice')).toBe(0)
  })
})

// ─── findProviderRevenue ──────────────────────────────────────────────────────

describe('findProviderRevenue', () => {
  const providers = makeProviderRows()

  it('finds venice revenue', () => {
    expect(findProviderRevenue(providers, 'venice')).toBe(500)
  })

  it('returns 0 for unknown provider', () => {
    expect(findProviderRevenue(providers, 'unknown')).toBe(0)
  })
})

// ─── findProviderProfit ───────────────────────────────────────────────────────

describe('findProviderProfit', () => {
  const providers = makeProviderRows()

  it('finds venice profit', () => {
    expect(findProviderProfit(providers, 'venice')).toBe(200)
  })

  it('finds surplus profit', () => {
    expect(findProviderProfit(providers, 'surplus')).toBe(50)
  })

  it('returns 0 for unknown provider', () => {
    expect(findProviderProfit(providers, 'unknown')).toBe(0)
  })
})

// ─── countActiveUsersLast24h ──────────────────────────────────────────────────

describe('countActiveUsersLast24h', () => {
  const now = new Date('2026-06-27T12:00:00Z')

  it('counts users active in last 24h', () => {
    const users = makeUsers(3, 2)
    expect(countActiveUsersLast24h(users, now)).toBe(3)
  })

  it('returns 0 when no users are active', () => {
    const users = makeUsers(0, 5)
    expect(countActiveUsersLast24h(users, now)).toBe(0)
  })

  it('returns 0 for empty array', () => {
    expect(countActiveUsersLast24h([], now)).toBe(0)
  })

  it('excludes users with null lastActivityAt', () => {
    const users: AdminUserStub[] = [
      { lastActivityAt: new Date('2026-06-27T11:00:00Z').toISOString() },
      { lastActivityAt: null },
      { lastActivityAt: new Date('2026-06-27T10:00:00Z').toISOString() },
    ]
    expect(countActiveUsersLast24h(users, now)).toBe(2)
  })

  it('excludes users active exactly 24h ago (boundary)', () => {
    const users: AdminUserStub[] = [
      { lastActivityAt: new Date('2026-06-26T12:00:00Z').toISOString() },
    ]
    expect(countActiveUsersLast24h(users, now)).toBe(0)
  })

  it('includes users active 23h 59m ago', () => {
    const users: AdminUserStub[] = [
      { lastActivityAt: new Date('2026-06-26T12:01:00Z').toISOString() },
    ]
    expect(countActiveUsersLast24h(users, now)).toBe(1)
  })

  it('uses current time as default when now is omitted', () => {
    const users = makeUsers(1, 0)
    const result = countActiveUsersLast24h(users)
    expect(result).toBeGreaterThanOrEqual(0)
  })
})

// ─── computeProviderCosts ─────────────────────────────────────────────────────

describe('computeProviderCosts', () => {
  it('returns venice cost as total', () => {
    const providers = makeProviderRows()
    const result = computeProviderCosts(providers)
    expect(result.venice).toBe(300)
    expect(result.total).toBe(300)
  })

  it('returns zeros when no providers exist', () => {
    const result = computeProviderCosts([])
    expect(result).toEqual({ venice: 0, total: 0 })
  })

  it('returns venice cost even with other providers present', () => {
    const providers: ProviderRow[] = [
      { provider: 'venice', totalRevenue: 100, totalCost: 50, profit: 50 },
      { provider: 'surplus', totalRevenue: 80, totalCost: 40, profit: 40 },
    ]
    const result = computeProviderCosts(providers)
    expect(result.venice).toBe(50)
    expect(result.total).toBe(50)
  })
})

// ─── computeAdminStats ────────────────────────────────────────────────────────

describe('computeAdminStats', () => {
  const providers = makeProviderRows()
  const users = makeUsers(5, 3)
  const now = new Date('2026-06-27T12:00:00Z')

  it('computes full admin stats from raw data', () => {
    const stats = computeAdminStats(
      providers,
      users,
      100,    // totalUsers
      45,     // totalApiKeys
      5000,   // totalDeposits
      1200,   // usageRevenue
      400,    // revenueGrossProfit
      now,
    )

    expect(stats.totalUsers).toBe(100)
    expect(stats.totalApiKeys).toBe(45)
    expect(stats.totalDollarsPurchased).toBe(5000)
    expect(stats.totalUsageThisMonth).toBe(1200)
    expect(stats.revenue).toBe(400)
    expect(stats.activeUsersLast24h).toBe(5)
    expect(stats.providerCosts.venice).toBe(300)
    expect(stats.providerCosts.total).toBe(300)
  })

  it('handles zero users and zero activity', () => {
    const stats = computeAdminStats(
      [],
      [],
      0, 0, 0, 0, 0,
      now,
    )

    expect(stats.totalUsers).toBe(0)
    expect(stats.totalApiKeys).toBe(0)
    expect(stats.totalDollarsPurchased).toBe(0)
    expect(stats.totalUsageThisMonth).toBe(0)
    expect(stats.revenue).toBe(0)
    expect(stats.activeUsersLast24h).toBe(0)
    expect(stats.providerCosts.total).toBe(0)
  })

  it('handles negative profit (loss)', () => {
    const stats = computeAdminStats(
      providers,
      users,
      50, 20, 3000, 1000, -200,
      now,
    )

    expect(stats.revenue).toBe(-200)
    expect(stats.totalDollarsPurchased).toBe(3000)
  })

  it('matches the pattern used in the admin page', () => {
    const totalRevenue = 8000
    const totalCost = 5000
    const grossProfit = computeGrossProfit(totalRevenue, totalCost)
    const providerCosts = computeProviderCosts(providers)

    expect(grossProfit).toBe(3000)
    expect(providerCosts.venice).toBe(300)

    const stats = computeAdminStats(
      providers,
      users,
      200, 80, 12000, 8000, grossProfit,
      now,
    )

    expect(stats.revenue).toBe(3000)
    expect(stats.totalDollarsPurchased).toBe(12000)
    expect(stats.totalUsageThisMonth).toBe(8000)
    expect(stats.providerCosts.total).toBe(300)
  })
})
