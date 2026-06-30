'use client'

import { ArrowRight, Coins, Key, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { StaggerReveal } from '@/lib/motion'
import { FALLBACK_MODEL_COUNT } from './Hero'

export function ValueProps() {
  const cards = [
    {
      icon: Key,
      title: '20+ models, one endpoint',
      body: `${FALLBACK_MODEL_COUNT}+ models via Venice AI. Private, uncensored inference with zero data retention. One OpenAI-compatible API.`,
      href: '/models',
      cta: 'See all models',
    },
    {
      icon: Coins,
      title: 'Pay per token, USDC',
      body: 'Pay-as-you-go in USDC on Base. x402 gasless payments. No subscriptions, no markup on deposit, 20% bonus on $200+.',
      href: '/pricing',
      cta: 'See pricing',
    },
    {
      icon: ShieldCheck,
      title: 'Anonymous by default',
      body: 'No KYC, no email, no PII. Wallet-only auth (SIWE) or x402 per-request. Zero data retention on every call.',
      href: '/login',
      cta: 'Get anonymous access',
    },
  ] as const
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <StaggerReveal
          stagger={0.1}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6"
        >
          {cards.map((c) => (
            <article
              key={c.title}
              className="tilt-card card-hover-lift sheen group relative rounded-2xl border border-border bg-panel/60 p-6 hover:border-accent/50 transition-colors"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent mb-4 transition-shadow group-hover:glow-accent-sm">
                <c.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-text-bright mb-2 tracking-tight">
                {c.title}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">
                {c.body}
              </p>
              <Link
                href={c.href}
                className="mt-4 inline-flex items-center gap-1 text-xs text-accent group-hover:gap-2 transition-all"
              >
                {c.cta}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </StaggerReveal>
      </div>
    </section>
  )
}
