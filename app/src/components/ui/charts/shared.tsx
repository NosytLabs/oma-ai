/**
 * Shared utilities for the OMA-AI chart components.
 *
 * - **Color tokens**: chart colors are referenced via `var(--color-*)` so
 *   they follow theme changes from `app/src/app/globals.css`. recharts
 *   forwards these strings straight into the rendered SVG and the browser
 *   resolves them at draw time.
 * - **Formatters**: currency, compact number, and adaptive date formatters
 *   used by every chart axis and tooltip.
 * - **Empty/Loading states**: small composable pieces that any chart can
 *   slot in to handle the "no data" and "loading" cases consistently.
 * - **Figure wrapper**: each chart is wrapped in `<figure role="img">` with
 *   a `<figcaption className="sr-only">` description for screen readers.
 */
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { format } from 'date-fns'

// ─── Color tokens ────────────────────────────────────────────────────────────
// All chart colors are CSS custom properties from `app/src/app/globals.css`.
// recharts writes these strings into the rendered SVG and the browser
// resolves them at paint time, so theme changes propagate without rebuilds.

export const CHART_COLORS = {
  accent: 'var(--color-accent)',
  accentHover: 'var(--color-accent-hover)',
  secondary: 'var(--color-secondary)',
  tertiary: 'var(--color-tertiary)',
  emerald: 'var(--color-provider-antseed)',
  blue: 'var(--color-provider-openrouter)',
  pink: 'var(--color-provider-together)',
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',

  // Provider colors (used by SpendByProvider / ProviderHealth)
  providerVenice: 'var(--color-provider-venice)',
  providerAntseed: 'var(--color-provider-antseed)',
  providerOpenrouter: 'var(--color-provider-openrouter)',
  providerTogether: 'var(--color-provider-together)',

  // Axis / grid neutrals
  axis: 'var(--color-text-tertiary)',
  grid: 'var(--color-border)',
  border: 'var(--color-border)',
} as const

// Ordered categorical palette. Used for arbitrary data.
export const CHART_PALETTE: readonly string[] = [
  CHART_COLORS.accent,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.pink,
  CHART_COLORS.emerald,
  CHART_COLORS.blue,
  'var(--color-error)',
  'var(--color-tertiary)',
]

/**
 * Build a stable, unique gradient id for a given chart instance. recharts
 * shares the DOM so two `<linearGradient id="costGradient">` defs on the
 * same page will collide and only the first will be referenced. By suffixing
 * with a per-instance token (often the React `useId()` value) we keep
 * every gradient isolated.
 */
export function makeGradientId(base: string, instanceId?: string): string {
  const suffix = instanceId ? `-${instanceId}` : `-${Math.random().toString(36).slice(2, 8)}`
  return `${base}${suffix}`
}

/**
 * Pick a color for a given provider name. Falls back to the accent if the
 * provider is unknown, keeping the legend stable for new providers that
 * haven't been branded yet.
 */
export function providerColor(provider: string): string {
  const p = provider.toLowerCase()
  if (p.includes('venice')) return CHART_COLORS.providerVenice
  if (p.includes('antseed')) return CHART_COLORS.providerAntseed
  if (p.includes('openrouter')) return CHART_COLORS.providerOpenrouter
  if (p.includes('together')) return CHART_COLORS.providerTogether
  return CHART_COLORS.accent
}

// ─── Formatters ──────────────────────────────────────────────────────────────
//
// `formatCurrency` and `formatAddress` are consolidated in `src/lib/utils.tsx`.
// Recharts axes / tooltips should import from there so every chart in the app
// produces the same shape. The helpers below stay chart-specific (date, etc.).

/**
 * Compact number formatter: "1.2k", "3.4M".
 */
export function formatCompactNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(decimals)}k`
  return value.toLocaleString('en-US')
}

/**
 * Adaptive date axis tick formatter.
 * - < 60 days: "Jun 11"
 * - 60-365 days: "Jun 11"
 * - >= 365 days: "Jun 2025"
 */
export function formatChartDate(value: string | number | Date, spanDays: number): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  if (spanDays >= 365) return format(d, 'MMM yyyy')
  return format(d, 'MMM d')
}

/**
 * Full date for tooltips: "Jun 11, 2026".
 */
export function formatFullDate(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return format(d, 'MMM d, yyyy')
}

/**
 * Compute the span (in days) covered by a date-keyed series. Returns 0
 * for empty / single-point series so callers can use it as a fallback
 * for the adaptive date formatter.
 */
export function dateSpanDays(dates: Array<string | number | Date>): number {
  if (dates.length < 2) return 0
  const first = new Date(dates[0]).getTime()
  const last = new Date(dates[dates.length - 1]).getTime()
  if (Number.isNaN(first) || Number.isNaN(last)) return 0
  return Math.max(0, Math.round((last - first) / 86_400_000))
}

// ─── Empty / Loading / Figure ────────────────────────────────────────────────

interface ChartEmptyStateProps {
  title?: string
  description?: string
  action?: ReactNode
  ctaLabel?: string
  ctaHref?: string
}

/**
 * Standardized empty state for every chart. Shows an inbox icon, a one-line
 * title, optional description, and an optional CTA (e.g., "make a test
 * request") when the page provides a route.
 */
export function ChartEmptyState({
  title = 'No data yet',
  description = 'Once you start using the API, your activity will show up here.',
  action,
  ctaLabel,
  ctaHref,
}: ChartEmptyStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
      <Inbox className="h-7 w-7 text-text-muted" aria-hidden="true" />
      <p className="font-mono text-xs uppercase tracking-widest text-text-muted">{title}</p>
      {description && (
        <p className="max-w-[28ch] text-[10px] font-mono leading-relaxed text-text-tertiary">
          {description}
        </p>
      )}
      {action ?? (ctaLabel && ctaHref ? (
        <a
          href={ctaHref}
          className="mt-2 inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          {ctaLabel}
        </a>
      ) : null)}
    </div>
  )
}

/**
 * Lightweight skeleton placeholder for charts while data is loading.
 * Uses the same height as the chart slot so the layout doesn't jump.
 */
export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-sm border border-border/50 bg-surface/40"
      style={{ height }}
      aria-hidden="true"
    >
      <div className="flex h-full items-end gap-1.5 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-border/60"
            style={{ height: `${30 + ((i * 17) % 60)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

interface ChartFigureProps {
  /** Accessible description of the chart contents, read by screen readers. */
  description: string
  /** Optional caption (rarely visible). */
  caption?: string
  children: ReactNode
  className?: string
}

/**
 * Wrap every chart in a `<figure role="img">` with a `<figcaption className="sr-only">`
 * description. Recharts renders the underlying `<svg>` directly so we set
 * `role="img"` on the figure (NOT on the svg) to keep a single a11y node.
 */
export function ChartFigure({ description, caption, children, className }: ChartFigureProps) {
  return (
    <figure
      role="img"
      aria-label={description}
      className={className}
    >
      {children}
      <figcaption className="sr-only">{caption ?? description}</figcaption>
    </figure>
  )
}
