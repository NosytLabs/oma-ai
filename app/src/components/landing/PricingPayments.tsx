'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Coins, ArrowRight, Zap, Shield, Clock } from 'lucide-react'

const PAYMENT_METHODS = [
  { method: 'USDC on Base', settlement: '~2 seconds', fee: '0%', badge: 'Popular', color: 'bg-[var(--color-info)]' },
  { method: 'USDC on Solana', settlement: '~2 seconds', fee: '0%', badge: null, color: 'bg-[var(--color-violet)]' },
  { method: 'HoudiniSwap', settlement: '5-45 min', fee: 'Swap spread', badge: '100+ coins', color: 'bg-[var(--color-pink)]' },
]

const CREDIT_BENEFITS = [
  { icon: Shield, text: 'Credits never expire' },
  { icon: Zap, text: 'Billed per token, in real-time' },
  { icon: Clock, text: 'Instant settlement onchain' },
]

export function PricingPayments() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="absolute inset-0 bg-[var(--color-void)]" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className={`text-center mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-4xl md:text-5xl font-mono font-bold tracking-tight text-[var(--color-text)] mb-4">
            Add Credits
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
            Pay with crypto you already have. Credits added instantly.
          </p>
        </div>

        <div className={`space-y-3 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
          {PAYMENT_METHODS.map((m, i) => {
            return (
              <div
                key={m.method}
                className="flex items-center justify-between p-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-cyan)]/30 hover:bg-[var(--color-surface-elevated)] transition-all duration-300 group"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded border border-[var(--color-border-bright)] bg-[var(--color-surface-elevated)] flex items-center justify-center group-hover:border-[var(--color-cyan)]/30 transition-colors`}>
                    <Coins className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-cyan)] transition-colors" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[var(--color-text)] font-mono">{m.method}</span>
                    {m.badge && (
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full font-mono ${
                        m.badge === 'Popular'
                          ? 'bg-[var(--color-info)]/20 text-[var(--color-info)] border border-[var(--color-info)]/30'
                          : 'bg-[var(--color-pink)]/20 text-[var(--color-pink)] border border-[var(--color-pink)]/30'
                      }`}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm font-mono">
                  <span className="text-[var(--color-text-muted)]">{m.settlement}</span>
                  <span className={`font-semibold ${m.fee === '0%' ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {m.fee}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className={`mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '400ms' }}>
          {CREDIT_BENEFITS.map((benefit) => {
            const Icon = benefit.icon
            return (
              <div key={benefit.text} className="flex items-center gap-2 p-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
                <Icon className="w-4 h-4 text-[var(--color-cyan)] shrink-0" />
                <span className="text-sm text-[var(--color-text-secondary)]">{benefit.text}</span>
              </div>
            )
          })}
        </div>

        <div className={`mt-8 p-5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '600ms' }}>
          <p className="text-sm text-[var(--color-text-muted)] text-center font-mono">
            Credits are non-redeemable and non-transferable. Billed per token at live rates.
          </p>
        </div>

        <div className={`mt-8 text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '700ms' }}>
          <Link
            href="/deposit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded bg-[var(--color-cyan)] text-[var(--color-void)] font-semibold hover:bg-[var(--color-cyan-bright)] transition-colors shadow-lg shadow-[var(--color-cyan)]/20"
          >
            <Coins className="w-5 h-5" />
            Buy Credits
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}