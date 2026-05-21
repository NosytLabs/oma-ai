'use client'

import { useAnimatedSection } from '@/lib/hooks'
import { Wallet, Coins, Key, Terminal, ArrowDownUp } from 'lucide-react'

const steps = [
  {
    icon: <Wallet className="h-6 w-6" />,
    title: 'CONNECT WALLET',
    desc: 'EVM or Solana -- MetaMask, Phantom, Coinbase, any wallet.',
  },
  {
    icon: <ArrowDownUp className="h-6 w-6" />,
    title: 'CROSS-CHAIN DEPOSIT',
    desc: 'USDC on Base/Solana, or 100+ coins via HoudiniSwap. No bridging needed.',
  },
  {
    icon: <Coins className="h-6 w-6" />,
    title: 'STAKE OMA (OPTIONAL)',
    desc: 'Hold OMA tokens for up to 15% discount on all API calls.',
  },
  {
    icon: <Key className="h-6 w-6" />,
    title: 'GENERATE API KEY',
    desc: 'One click. Instant. SHA-256 hashed on our end.',
  },
  {
    icon: <Terminal className="h-6 w-6" />,
    title: 'CALL THE API',
    desc: 'OpenAI SDK compatible. Drop-in replacement.',
  },
]

function StepIcon({
  step,
  index,
  isVisible,
}: {
  step: (typeof steps)[0]
  index: number
  isVisible: boolean
}) {
  return (
    <div
      className={`relative z-10 mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-xl border border-border bg-panel text-cyan transition-all duration-500 step-icon ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      {step.icon}
      <span
        className={`step-number absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-cyan text-xs font-bold text-void transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        }`}
        style={{ transitionDelay: `${index * 150 + 200}ms` }}
      >
        {index + 1}
      </span>
      <div
        className={`absolute inset-0 rounded-xl bg-cyan/5 opacity-0 transition-opacity duration-300 ${isVisible ? 'opacity-100' : ''}`}
        style={{ transitionDelay: `${index * 150 + 300}ms` }}
      />
    </div>
  )
}

export function HowItWorks() {
  const { ref, isVisible } = useAnimatedSection()

  return (
    <section ref={ref} className="border-t border-border py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <h2
          className={`mb-16 text-center text-2xl font-bold tracking-tight transition-all duration-500 sm:text-3xl ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          HOW IT WORKS
        </h2>

        <div className="relative grid grid-cols-1 gap-8 md:grid-cols-5">
          {steps.map((step, i) => (
            <div key={step.title} className="relative text-center">
              {i < steps.length - 1 && (
                <div
                  className={`absolute right-0 top-12 hidden h-px w-full translate-x-1/2 border-t border-dashed border-border transition-all duration-500 md:block ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ transitionDelay: `${i * 150 + 400}ms` }}
                  aria-hidden="true"
                />
              )}
              <StepIcon step={step} index={i} isVisible={isVisible} />
              <h3
                className={`mb-2 text-xs font-bold tracking-wider transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: `${i * 150 + 100}ms` }}
              >
                {step.title}
              </h3>
              <p
                className={`text-xs text-text-dim transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: `${i * 150 + 200}ms` }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Cross-chain deposit flow visual */}
        <div
          className={`mt-12 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '800ms' }}
        >
          <div className="rounded-xl border border-border bg-panel p-6">
            <h4 className="mb-4 text-center text-xs font-bold tracking-widest text-text-dim">
              CROSS-CHAIN DEPOSIT FLOW
            </h4>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-xs font-semibold text-text">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                Base
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-xs font-semibold text-text">
                <div className="h-2 w-2 rounded-full bg-purple-400" />
                Solana
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-xs font-semibold text-text">
                <div className="h-2 w-2 rounded-full bg-amber" />
                OMA Token
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-xs font-semibold text-text">
                <div className="h-2 w-2 rounded-full bg-pink" />
                100+ Coins
              </div>
              <span className="text-text-dim">→</span>
              <div className="flex items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/10 px-4 py-2 text-xs font-bold text-cyan">
                <Key className="h-3.5 w-3.5" />
                Credits
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}