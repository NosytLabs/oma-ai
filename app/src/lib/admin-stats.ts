/**
 * Pure calculation functions for admin revenue statistics.
 * Extracted from the admin page useMemo so they are independently testable
 * without requiring React components, TanStack Query, or DOM rendering.
 *
 * All functions are pure — no side effects, no API calls, no React state.
 */

/** A single provider row from the usage stats byProvider array. */
export interface ProviderRow {
  provider: string
  totalRevenue: number
  totalCost: number
  profit: number
}

/** Minimal user shape needed for active-user counting. */
export interface AdminUserStub {
  lastActivityAt: string | null
}

// ─── Core Revenue Calculations ────────────────────────────────────────────────

/**
 * Compute gross profit: totalRevenue - totalCost.
 * A negative value means cost exceeded revenue (net loss).
 */
export function computeGrossProfit(totalRevenue: number, totalCost: number): number {
  return totalRevenue - totalCost
}

/**
 * Compute margin as a percentage string (e.g. "42.5%").
 * Returns "0.0%" when revenue is 0 (avoids division by zero).
 * Returns formatted negative percentage when cost exceeds revenue.
 */
export function computeMargin(totalRevenue: number, totalCost: number): string {
  if (totalRevenue === 0) return '0.0%'
  const margin = ((totalRevenue - totalCost) / totalRevenue) * 100
  return `${margin.toFixed(1)}%`
}

/**
 * Find a specific provider's cost from the byProvider array.
 * Case-sensitive match on `provider` field. Returns 0 if not found.
 */
export function findProviderCost(
  byProvider: ProviderRow[],
  providerName: string,
): number {
  return byProvider.find((p) => p.provider === providerName)?.totalCost ?? 0
}

/**
 * Find a specific provider's total revenue from the byProvider array.
 * Returns 0 if not found.
 */
export function findProviderRevenue(
  byProvider: ProviderRow[],
  providerName: string,
): number {
  return byProvider.find((p) => p.provider === providerName)?.totalRevenue ?? 0
}

/**
 * Find a specific provider's profit from the byProvider array.
 * Returns 0 if not found.
 */
export function findProviderProfit(
  byProvider: ProviderRow[],
  providerName: string,
): number {
  return byProvider.find((p) => p.provider === providerName)?.profit ?? 0
}

// ─── Active User Counting ─────────────────────────────────────────────────────

const MS_24H = 24 * 60 * 60 * 1000

/**
 * Count users whose `lastActivityAt` falls within the last 24 hours.
 * Accepts an explicit `now` parameter for deterministic testing.
 */
export function countActiveUsersLast24h(
  users: AdminUserStub[],
  now: Date = new Date(),
): number {
  const last24h = new Date(now.getTime() - MS_24H)
  return users.filter(
    (u) => u.lastActivityAt && new Date(u.lastActivityAt) > last24h,
  ).length
}

// ─── Provider Cost Summary ────────────────────────────────────────────────────

interface ProviderCostBreakdown {
  venice: number
  total: number
}

/**
 * Compute the Venice provider cost breakdown from a byProvider array.
 * The `total` field is the Venice cost (single provider).
 */
export function computeProviderCosts(byProvider: ProviderRow[]): ProviderCostBreakdown {
  const venice = findProviderCost(byProvider, 'venice')
  return { venice, total: venice }
}

/**
 * Compute the full admin-overview stats from raw server data.
 *
 * `totalDollarsPurchased` comes from `revenueSummary.totalDeposits` (it's
 * the sum of all deposits, not just inference spend).
 *
 * `revenue` is grossProfit = totalRevenue - totalCost from the revenue
 * summary (not the usage summary), because the admin overview card
 * labelled "Revenue" shows overall platform profit.
 */
export function computeAdminStats(
  byProvider: ProviderRow[],
  users: AdminUserStub[],
  totalUsers: number,
  totalApiKeys: number,
  totalDeposits: number,
  usageRevenue: number,
  revenueGrossProfit: number,
  now: Date = new Date(),
) {
  return {
    totalUsers,
    totalApiKeys,
    totalDollarsPurchased: totalDeposits,
    totalUsageThisMonth: usageRevenue,
    revenue: revenueGrossProfit,
    activeUsersLast24h: countActiveUsersLast24h(users, now),
    providerCosts: computeProviderCosts(byProvider),
  }
}
