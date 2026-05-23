'use client'

import { useEffect, useRef, useState } from 'react'
import { Wallet, Coins, Key, Terminal, ArrowDownUp, Check, CreditCard, TrendingUp } from 'lucide-react'

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
}: {
  step: typeof steps[0]
  index: number
  isVisible: boolean
}) {
  const Icon = step.icon
  return (
    <div
      className={`relative p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm transition-all duration-500 hover:border-cyan-500/30 hover:bg-zinc-900/80 group ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />

      <div className="relative flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors">
          <Icon className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
          <span className="text-xs font-bold text-cyan-400">{index + 1}</span>
        </div>
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
      <p className="text-sm text-zinc-500">{step.desc}</p>
    </div>
  )
}

const networks = [
  { name: 'Base', color: 'bg-blue-500' },
  { name: 'Solana', color: 'bg-purple-500' },
  { name: 'Ethereum', color: 'bg-slate-400' },
  { name: 'Polygon', color: 'bg-purple-400' },
]

const subscriptionTiers = [
  { name: 'FREE', price: '$0', tokens: '1M/mo', color: 'border-zinc-600' },
  { name: 'STARTER', price: '$9', tokens: '10M/mo', color: 'border-blue-500/50' },
  { name: 'PRO', price: '$29', tokens: '50M/mo', color: 'border-cyan-500/50', highlighted: true },
  { name: 'BUSINESS', price: '$99', tokens: '250M/mo', color: 'border-amber-500/50' },
]

export function HowItWorks() {
  const [isVisible, setIsVisible] = useState(false)
  const [tiersVisible, setTiersVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tiersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setTiersVisible(true)
      },
      { threshold: 0.2 }
    )
    if (tiersRef.current) observer.observe(tiersRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Check className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">No signup required</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Get started in minutes
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            From wallet to API key in five simple steps. No credit card, no forms, no friction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <StepCard key={step.title} step={step} index={i} isVisible={isVisible} />
          ))}
        </div>

        <div
          ref={tiersRef}
          className={`mt-16 p-8 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm transition-all duration-700 ${
            tiersVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/10 to-amber-500/10 border border-cyan-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Scale Your Usage</h3>
              <p className="text-sm text-zinc-500">Subscription tiers or pay-as-you-go</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {subscriptionTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative p-4 rounded-xl bg-zinc-900/50 border ${tier.color} ${
                  tier.highlighted ? 'bg-cyan-500/5' : ''
                } transition-all hover:bg-zinc-900/80`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-cyan-500 text-[10px] font-bold text-zinc-900">
                    POPULAR
                  </div>
                )}
                <div className="text-xs font-semibold text-zinc-500 mb-1">{tier.name}</div>
                <div className="text-xl font-bold text-white">{tier.price}</div>
                <div className="text-xs text-zinc-500 mt-1">{tier.tokens}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Credits never expire
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Cancel anytime
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              OMA staking for 15% discount
            </span>
          </div>
        </div>

        <div
          className={`mt-16 p-8 rounded-xl bg-gradient-to-r from-zinc-900/80 to-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '600ms' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-6 text-center">
            Supported Networks
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {networks.map((chain) => (
              <div
                key={chain.name}
                className="flex items-center gap-3 px-5 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50 transition-colors"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${chain.color}`} />
                <span className="text-sm font-medium text-zinc-300">{chain.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}