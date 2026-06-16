'use client'

import { Boxes } from 'lucide-react'
import { MODEL_ROWS, fmt } from '../data'
import { SectionHeading, AnimatedSection, SubHeading } from './SharedComponents'

const TIER_BADGE: Record<string, string> = {
  budget:   'border-warning/30  bg-warning/10  text-warning',
  mid:      'border-info/30     bg-info/10     text-info',
  premium:  'border-tier-premium/30 bg-tier-premium/10 text-tier-premium',
  frontier: 'border-info/30     bg-info/10     text-info',
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
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
            Catalog
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-text">
            {MODEL_ROWS.length}
          </p>
          <p className="text-xs text-text-muted">routable models, refreshed daily</p>
        </div>
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
            Providers
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-text">4</p>
          <p className="text-xs text-text-muted">Venice, AntSeed, OpenRouter, Together</p>
        </div>
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
            Price floor
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-text">
            $0.01<span className="text-sm text-text-muted">/1M</span>
          </p>
          <p className="text-xs text-text-muted">cheapest tier, in &amp; out</p>
        </div>
      </div>

      <SubHeading id="models-table">Full catalog</SubHeading>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="max-h-[28rem] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Model
                </th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Provider
                </th>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Tier
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  In / 1M
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Out / 1M
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Ctx
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border/40 transition-colors last:border-b-0 hover:bg-surface/30"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-text">{m.name}</div>
                    <div className="line-clamp-1 text-xs text-text-muted">{m.blurb}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
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
                  <td className="px-4 py-2.5 text-right font-mono text-accent">
                    {fmt(m.input)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary">
                    {fmt(m.output)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-text-muted">
                    {m.ctx}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-text-muted">
        Prices are per million tokens. You pay exactly what we pay the upstream — no markup, no platform fee. Live list at{' '}
        <a
          href="/api/v1/models"
          className="font-mono text-accent underline-offset-2 hover:underline"
        >
          /v1/models
        </a>
        .
      </p>
    </AnimatedSection>
  )
}
