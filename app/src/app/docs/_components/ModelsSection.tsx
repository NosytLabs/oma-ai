'use client'

import { Boxes } from 'lucide-react'
import { MODEL_ROWS, fmt } from '../data'
import { SectionHeading, AnimatedSection, SubHeading } from './SharedComponents'

const TIER_BADGE: Record<string, string> = {
  budget:   'border-[var(--color-warning)]/30  bg-[var(--color-warning)]/10  text-[var(--color-warning)]',
  mid:      'border-[var(--color-info)]/30     bg-[var(--color-info)]/10     text-[var(--color-info)]',
  premium:  'border-[var(--color-tier-premium)]/30 bg-[var(--color-tier-premium)]/10 text-[var(--color-tier-premium)]',
  frontier: 'border-[var(--color-info)]/30     bg-[var(--color-info)]/10     text-[var(--color-info)]',
}

const TIER_RANK: Record<string, number> = { budget: 0, mid: 1, premium: 2, frontier: 3 }

export function ModelsSection() {
  const sorted = [...MODEL_ROWS].sort(
    (a, b) =>
      (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) || a.name.localeCompare(b.name)
  )

  return (
    <AnimatedSection delay={250}>
      <SectionHeading
        id="models"
        icon={<Boxes className="h-5 w-5" />}
        title="Models"
        subtitle="91+ models from Venice, AntSeed, OpenRouter, and Together. We route to whichever is healthiest for your prompt."
        badge={`${MODEL_ROWS.length} models`}
      />

      <SubHeading id="models-overview">Overview</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Catalog
          </p>
          <p className="mt-1 font-syne text-2xl font-bold text-[var(--color-text)]">
            {MODEL_ROWS.length}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">routable models, refreshed daily</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Providers
          </p>
          <p className="mt-1 font-syne text-2xl font-bold text-[var(--color-text)]">4</p>
          <p className="text-xs text-[var(--color-text-muted)]">Venice, AntSeed, OpenRouter, Together</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Price floor
          </p>
          <p className="mt-1 font-syne text-2xl font-bold text-[var(--color-text)]">
            $0.01<span className="text-sm text-[var(--color-text-muted)]">/1M</span>
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">cheapest tier, in &amp; out</p>
        </div>
      </div>

      <SubHeading id="models-table">Full catalog</SubHeading>
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <div className="max-h-[28rem] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Model
                </th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Provider
                </th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Tier
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  In / 1M
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Out / 1M
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Ctx
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-[var(--color-border)]/40 transition-colors last:border-b-0 hover:bg-[var(--color-surface)]/30"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[var(--color-text)]">{m.name}</div>
                    <div className="line-clamp-1 text-xs text-[var(--color-text-muted)]">{m.blurb}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--color-text-secondary)]">
                    {m.provider}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
                        TIER_BADGE[m.tier] ?? TIER_BADGE.budget
                      }`}
                    >
                      {m.tier}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--color-accent)]">
                    {fmt(m.input)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--color-text-secondary)]">
                    {fmt(m.output)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-[var(--color-text-muted)]">
                    {m.ctx}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
        Prices are per million tokens. You pay exactly what we pay the upstream — no markup, no platform fee. Live list at{' '}
        <a
          href="/api/v1/models"
          className="font-mono text-[var(--color-accent)] underline-offset-2 hover:underline"
        >
          /v1/models
        </a>
        .
      </p>
    </AnimatedSection>
  )
}
