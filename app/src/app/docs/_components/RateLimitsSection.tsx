'use client'

import { Gauge } from 'lucide-react'
import { PLAN_LIMITS } from '../data'
import { SectionHeading, AnimatedSection, SubHeading } from './SharedComponents'

export function RateLimitsSection() {
  return (
    <AnimatedSection delay={300}>
      <SectionHeading
        id="rate-limits"
        icon={<Gauge className="h-5 w-5" />}
        title="Rate limits"
        subtitle="Per-plan request and token limits with burst handling. Every response carries the headers in this section."
      />

      <SubHeading id="rl-plans">Plan limits</SubHeading>
      <div className="mb-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/40">
              <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                Plan
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                RPM
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                TPM
              </th>
              <th className="hidden px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary sm:table-cell">
                RPD
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                Concurrent
              </th>
            </tr>
          </thead>
          <tbody>
            {PLAN_LIMITS.map((p, i) => (
              <tr
                key={p.name}
                className={`border-b border-border/40 transition-colors last:border-b-0 ${
                  i % 2 === 1 ? 'bg-surface/20' : ''
                } hover:bg-surface/40`}
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${p.badge}`}
                  >
                    {p.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-text-secondary">
                  {p.rpm.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-text-secondary">
                  {p.tpm.toLocaleString()}
                </td>
                <td className="hidden px-4 py-3 text-right font-mono text-text-secondary sm:table-cell">
                  {p.rpd.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-text-secondary">
                  {p.concurrent}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubHeading id="rl-headers">Response headers</SubHeading>
      <div className="mb-8 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <tbody>
            <tr className="border-b border-border/40">
              <td className="w-1/3 px-4 py-2.5 font-mono text-[13px] text-accent">
                X-RateLimit-Limit
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                string — requests per minute for your plan
              </td>
            </tr>
            <tr className="border-b border-border/40">
              <td className="w-1/3 px-4 py-2.5 font-mono text-[13px] text-accent">
                X-RateLimit-Remaining
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                string — requests left in the current window
              </td>
            </tr>
            <tr>
              <td className="w-1/3 px-4 py-2.5 font-mono text-[13px] text-accent">
                X-RateLimit-Reset
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                string — seconds until the window resets
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <SubHeading id="rl-when">When you hit the ceiling</SubHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <h4 className="mb-2 font-display text-sm font-semibold text-text">Burst handling</h4>
          <p className="text-[13px] leading-relaxed text-text-muted">
            Token bucket algorithm allows short bursts above the sustained rate. Excess tokens spill into the next window, so a 30-second spike is fine — sustained overload is not.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <h4 className="mb-2 font-display text-sm font-semibold text-text">On 429</h4>
          <p className="text-[13px] leading-relaxed text-text-muted">
            Read{' '}
            <code className="rounded border border-border/60 bg-panel px-1 font-mono text-[0.85em] text-accent">
              X-RateLimit-Reset
            </code>
            , wait that long, then retry with exponential backoff. See{' '}
            <a href="#errors" className="font-medium text-accent underline-offset-2 hover:underline">
              Errors
            </a>{' '}
            for a reference retry loop.
          </p>
        </div>
      </div>
    </AnimatedSection>
  )
}
