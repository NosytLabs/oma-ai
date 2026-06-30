'use client'

import { m } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Coins, Receipt, Zap } from 'lucide-react'
import { FadeIn, StaggerReveal, scaleInSafe } from '@/lib/motion'

export function PricingTease() {
  const stats = [
    {
      icon: Coins,
      value: '$0.06',
      unit: '/ 1M input',
      label: 'Cheapest model',
      detail: 'Llama 3.2 3B for scripts, summaries, and lightweight chat.',
    },
    {
      icon: Receipt,
      value: '1:1',
      unit: 'USDC',
      label: 'No markup on deposit',
      detail: 'Credits mirror USDC at par. $50+ deposits get 10% bonus, $200+ get 20%. No hidden fees, no minimums.',
    },
    {
      icon: Zap,
      value: '$0',
      unit: 'monthly',
      label: 'No subscription',
      detail: 'No tiers, no seats, no enterprise contract. Pay only for tokens. Our margin is built into the per-model pricing.',
    },
  ] as const
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <FadeIn className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight">
              Pay for tokens. <span className="text-accent">Nothing else.</span>
            </h2>
            <p className="mt-3 text-text-secondary text-sm sm:text-base">
              No subscriptions, no rate limits, no surprise overage bills. One billable unit, settled in USDC.
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm text-text-bright hover:text-accent transition-colors"
          >
            See full pricing
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </FadeIn>

        <StaggerReveal
          stagger={0.08}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {stats.map((s) => (
            <m.div
              key={s.label}
              variants={scaleInSafe}
              className="relative rounded-xl border border-border bg-panel/40 p-5 hover:border-accent/40 transition-colors"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent mb-4">
                <s.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-3xl font-bold text-text-bright font-mono tabular-nums">
                  {s.value}
                </span>
                <span className="text-xs text-text-tertiary font-mono">
                  {s.unit}
                </span>
              </div>
              <p className="text-sm font-medium text-text-bright mb-1.5">
                {s.label}
              </p>
              <p className="text-xs text-text-tertiary leading-relaxed">
                {s.detail}
              </p>
            </m.div>
          ))}
        </StaggerReveal>
      </div>
    </section>
  )
}
