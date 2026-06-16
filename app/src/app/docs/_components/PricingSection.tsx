'use client'

import { DollarSign, CheckCircle2 } from 'lucide-react'
import { MODEL_ROWS, fmt } from '../data'
import { SectionHeading, AnimatedSection } from './SharedComponents'

export function PricingSection() {
  return (
    <AnimatedSection delay={400}>
      <SectionHeading
        id="pricing"
        icon={<DollarSign className="h-5 w-5" />}
        title="Pricing"
        subtitle="Per-model pricing. Input and output priced per million tokens. No markup over upstream cost."
      />

      <div className="mb-6 overflow-hidden rounded-lg border border-border">
        <div className="max-h-[32rem] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Model
                </th>
                <th className="hidden px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary sm:table-cell">
                  Provider
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Input / 1M
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Output / 1M
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Context
                </th>
              </tr>
            </thead>
            <tbody>
              {MODEL_ROWS.map((m, i) => (
                <tr
                  key={m.id}
                  className={`border-b border-border/40 transition-colors last:border-b-0 hover:bg-surface/30 ${
                    i % 2 === 1 ? 'bg-surface/15' : ''
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-text">{m.name}</td>
                  <td className="hidden px-4 py-2.5 text-xs text-text-secondary sm:table-cell">
                    {m.provider}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-accent">
                    {fmt(m.input)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary">
                    {fmt(m.output)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-text-muted">
                    {m.ctx}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-accent/20 bg-gradient-to-br from-accent/8 to-transparent p-4">
        <h4 className="font-display text-sm font-semibold text-accent">Credit deduction</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="text-[13px] leading-relaxed text-text-muted">
              <span className="font-mono text-text">$1 = $1</span>. Billed per token in real time.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="text-[13px] leading-relaxed text-text-muted">
              No minimums, no subscriptions
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="text-[13px] leading-relaxed text-text-muted">
              12-month rolling expiry
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="text-[13px] leading-relaxed text-text-muted">
              No markup over upstream
            </span>
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}
