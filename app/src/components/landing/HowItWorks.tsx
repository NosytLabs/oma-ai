'use client'

import { useEffect, useRef, useState } from 'react'
import { Wallet, Coins, Key, Terminal, ArrowDownUp, Check, CreditCard, TrendingUp } from 'lucide-react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const steps = [
  {
    icon: Wallet,
    title: 'Connect Wallet',
    desc: 'MetaMask, WalletConnect, or Coinbase Wallet.',
  },
  {
    icon: ArrowDownUp,
    title: 'Add Funds',
    desc: 'USDC on Base or Solana. 100+ tokens via HoudiniSwap.',
  },
  {
    icon: Coins,
    title: 'Stake OMA',
    desc: 'Hold OMA for up to 15% discount on API calls.',
  },
  {
    icon: Key,
    title: 'Get API Key',
    desc: 'One click. Instant. SHA-256 hashed.',
  },
  {
    icon: Terminal,
    title: 'Build',
    desc: 'OpenAI SDK compatible. Drop-in.',
  },
  {
    icon: TrendingUp,
    title: 'Scale Your Usage',
    desc: 'Choose a subscription tier or pay-as-you-go credits.',
  },
]

function StepCard({
  step,
  index,
  isVisible,
  reducedMotion = false,
}: {
  step: typeof steps[0]
  index: number
  isVisible: boolean
  reducedMotion?: boolean
}) {
  const Icon = step.icon
  return (
    <div
      className={`relative p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-sm transition-all ${reducedMotion ? 'duration-0' : 'duration-500'} hover:border-[var(--color-cyan)]/30 hover:bg-[var(--color-surface-elevated)] group ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: reducedMotion ? '0ms' : `${index * 100}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-cyan)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded" />

      <div className="relative flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded border border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/10 flex items-center justify-center group-hover:border-[var(--color-cyan)]/40 transition-colors">
          <Icon className="w-5 h-5 text-[var(--color-cyan)]" />
        </div>
        <div className="w-8 h-8 rounded-full border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 flex items-center justify-center group-hover:bg-[var(--color-cyan)]/20 transition-colors">
          <span className="text-xs font-bold text-[var(--color-cyan)] font-mono">{index + 1}</span>
        </div>
      </div>
      <h3 className="text-base font-semibold text-[var(--color-text)] mb-2">{step.title}</h3>
      <p className="text-sm text-[var(--color-text-muted)]">{step.desc}</p>
    </div>
  )
}

const networks = [
  { name: 'Base', color: 'bg-[var(--color-info)]' },
  { name: 'Solana', color: 'bg-[var(--color-violet)]' },
  { name: 'Ethereum', color: 'bg-[var(--color-text-muted)]' },
  { name: 'Polygon', color: 'bg-[var(--color-violet)]' },
]

const subscriptionTiers = [
  { name: 'FREE', price: '$0', tokens: '1M/mo', color: 'border-[var(--color-border-bright)]' },
  { name: 'STARTER', price: '$9', tokens: '10M/mo', color: 'border-[var(--color-info)]/50' },
  { name: 'PRO', price: '$29', tokens: '50M/mo', color: 'border-[var(--color-cyan)]/50', highlighted: true },
  { name: 'BUSINESS', price: '$99', tokens: '250M/mo', color: 'border-[var(--color-secondary)]/50' },
]

export function HowItWorks() {
  const [isVisible, setIsVisible] = useState(false)
  const [tiersVisible, setTiersVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tiersRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [prefersReducedMotion])

  useEffect(() => {
    if (prefersReducedMotion) {
      setTiersVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setTiersVisible(true)
      },
      { threshold: 0.2 }
    )
    if (tiersRef.current) observer.observe(tiersRef.current)
    return () => observer.disconnect()
  }, [prefersReducedMotion])

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="absolute inset-0 bg-[var(--color-void)]" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div
          className={`text-center mb-16 transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-700'} ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/10 mb-6">
            <Check className="w-4 h-4 text-[var(--color-cyan)]" />
            <span className="text-sm font-medium text-[var(--color-cyan)] font-mono">No signup required</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-mono font-bold tracking-tight text-[var(--color-text)] mb-4">
            Get started in minutes
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
            From wallet to API key in five simple steps. No credit card, no forms, no friction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <StepCard key={step.title} step={step} index={i} isVisible={isVisible} reducedMotion={prefersReducedMotion ?? false} />
          ))}
        </div>

        <div
          ref={tiersRef}
          className={`mt-16 p-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-sm transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-700'} ${
            tiersVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: prefersReducedMotion ? '0ms' : '300ms' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded border border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[var(--color-cyan)]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">Scale Your Usage</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Subscription tiers or pay-as-you-go</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {subscriptionTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative p-4 rounded bg-[var(--color-surface)] border ${tier.color} ${
                  tier.highlighted ? 'bg-[var(--color-cyan)]/5' : ''
                } transition-all hover:bg-[var(--color-surface-elevated)]`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[var(--color-cyan)] text-[10px] font-bold text-[var(--color-void)]">
                    POPULAR
                  </div>
                )}
                <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-1 font-mono">{tier.name}</div>
                <div className="text-xl font-bold text-[var(--color-text)] font-mono">{tier.price}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{tier.tokens}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-muted)]">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[var(--color-success)]" />
              Credits never expire
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[var(--color-success)]" />
              Cancel anytime
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[var(--color-success)]" />
              OMA staking for 15% discount
            </span>
          </div>
        </div>

        <div
          className={`mt-16 p-8 rounded border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-sm transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-700'} ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: prefersReducedMotion ? '0ms' : '600ms' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-6 text-center font-mono">
            Supported Networks
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {networks.map((chain) => (
              <div
                key={chain.name}
                className="flex items-center gap-3 px-5 py-3 rounded border border-[var(--color-border-bright)] bg-[var(--color-surface-elevated)] hover:border-[var(--color-border-bright)]/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${chain.color}`} />
                <span className="text-sm font-medium text-[var(--color-text-secondary)] font-mono">{chain.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
