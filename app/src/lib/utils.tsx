export function formatCents(cents: string | number): string {
  const n = typeof cents === 'string' ? parseFloat(cents) : cents
  return (n / 100).toFixed(2)
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

export function maskKey(prefix: string): string {
  return `${prefix}****`
}

/**
 * Format a USD amount with a `$` prefix and fixed decimals.
 * Prefer `formatCurrency` (below) for new code — it supports a `compact` option
 * for axis ticks and tooltips.
 */
export function formatUsd(amount: number, decimals = 2): string {
  return `$${amount.toFixed(decimals)}`
}

/**
 * Adaptive USD currency formatter used for chart axis ticks, tooltips, and
 * dashboard summaries.
 * - < $1k (compact off): "$12.34"
 * - < $1k (compact on):  "$12.34"
 * - < $1M (compact on):  "$12.3k"
 * - >= $1M (compact on): "$1.2M"
 */
export function formatCurrency(
  value: number,
  opts: { compact?: boolean; decimals?: number } = {},
): string {
  const { compact = false, decimals = 2 } = opts
  if (!Number.isFinite(value)) return '$0'
  if (!compact) {
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`
  }
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toFixed(decimals)}`
}

/**
 * Shorten an EVM/Solana address for table display.
 * Examples:
 *   "0x1234567890abcdef1234567890abcdef12345678" → "0x1234…5678"
 *   "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpniT33q5op" → "9xQe…5op"
 *
 * Returns the original string if it is shorter than the threshold so we
 * don't mangle short identifiers.
 */
export function formatAddress(addr: string | null | undefined): string {
  if (!addr) return '—'
  if (addr.length <= 14) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
