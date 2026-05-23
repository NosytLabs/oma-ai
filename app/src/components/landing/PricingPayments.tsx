'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Coins, ArrowRight, Zap, Shield, Clock } from 'lucide-react'

const PAYMENT_METHODS = [
  { method: 'USDC on Base', settlement: '~2 seconds', fee: '0%', badge: 'Popular', color: 'bg-blue-500' },
  { method: 'USDC on Solana', settlement: '~2 seconds', fee: '0%', badge: null, color: 'bg-purple-500' },
  { method: 'HoudiniSwap', settlement: '5-45 min', fee: 'Swap spread', badge: '100+ coins', color: 'bg-pink-500' },
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
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className={`text-center mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Add Credits
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Pay with crypto you already have. Credits added instantly.
          </p>
        </div>

        <div className={`space-y-3 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
          {PAYMENT_METHODS.map((m, i) => {
            return (
              <div
                key={m.method}
                className="flex items-center justify-between p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-cyan-500/30 hover:bg-zinc-900/80 transition-all duration-300 group"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center group-hover:border-cyan-500/30 transition-colors`}>
                    <Coins className="w-5 h-5 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{m.method}</span>
                    {m.badge && (
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                        m.badge === 'Popular'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                      }`}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-zinc-500">{m.settlement}</span>
                  <span className={`font-semibold ${m.fee === '0%' ? 'text-emerald-400' : 'text-zinc-300'}`}>
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
              <div key={benefit.text} className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-sm text-zinc-400">{benefit.text}</span>
              </div>
            )
          })}
        </div>

        <div className={`mt-8 p-5 rounded-xl bg-zinc-900/30 border border-zinc-800/50 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '600ms' }}>
          <p className="text-sm text-zinc-600 text-center">
            Credits are non-redeemable and non-transferable. Billed per token at live rates.
          </p>
        </div>

        <div className={`mt-8 text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '700ms' }}>
          <Link
            href="/deposit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-zinc-900 font-semibold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
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