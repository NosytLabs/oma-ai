// ponytail: shared tone taxonomy for provider health surfaces.
// Single source of truth — used by ProviderHealthCard (full status table)
// and ProviderHealthSummary (compact overview pill).

export type CheckStatus = 'ok' | 'degraded' | 'rate_limited' | 'circuit_open' | string

export type Tone = 'green' | 'yellow' | 'orange' | 'red'

/** Map a provider check status → display label + UI tone bucket. */
export function getStatusLabel(status: CheckStatus): { label: string; tone: Tone } {
  if (status === 'ok') return { label: 'Operational', tone: 'green' }
  if (status === 'degraded') return { label: 'Degraded', tone: 'yellow' }
  if (status === 'rate_limited') return { label: 'Rate limited', tone: 'orange' }
  if (status === 'circuit_open') return { label: 'Circuit open', tone: 'red' }
  return { label: 'Outage', tone: 'red' }
}

/** Map a provider check status → tone bucket (no label). */
export function toneFor(status: CheckStatus): Tone {
  if (status === 'ok') return 'green'
  if (status === 'degraded') return 'yellow'
  if (status === 'rate_limited') return 'orange'
  return 'red'
}

/** Tailwind text color class per tone. */
export const TONE_TEXT: Record<Tone, string> = {
  green: 'text-success',
  yellow: 'text-secondary',
  orange: 'text-warning',
  red: 'text-pink',
}

/** Tailwind background class per tone. */
export const TONE_DOT: Record<Tone, string> = {
  green: 'bg-success',
  yellow: 'bg-secondary',
  orange: 'bg-warning',
  red: 'bg-pink',
}
