'use client'

import { useAnimatedSection } from '@/lib/hooks'
import { Key, Zap, Coins, Clock, Shield, ShieldOff, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const methods = [
  {
    method: 'USDC on Base',
    settlement: '~2 seconds',
    fee: '0%',
    icon: <Key className="h-4 w-4 text-blue-400" />,
    badge: 'Popular',
  },
  {
    method: 'USDC on Solana',
    settlement: '~2 seconds',
    fee: '0%',
    icon: <Zap className="h-4 w-4 text-purple-400" />,
  },
  {
    method: 'OMA Token',
    settlement: '~2 seconds',
    fee: '+5% bonus',
    icon: <Coins className="h-4 w-4 text-cyan" />,
    badge: 'Best Value',
  },
  {
    method: 'BTC / XMR / SOL (HoudiniSwap)',
    settlement: '5-45 min',
    fee: 'Swap spread',
    icon: <Clock className="h-4 w-4 text-amber" />,
  },
]

const stakingTiers = [
  { stake: '1K OMA', discount: '3%', pct: 20, color: 'bg-cyan/20' },
  { stake: '10K OMA', discount: '6%', pct: 40, color: 'bg-cyan/30' },
  { stake: '50K OMA', discount: '10%', pct: 67, color: 'bg-cyan/40' },
  { stake: '100K OMA', discount: '15%', pct: 100, color: 'bg-cyan/60' },
]

export function PricingPayments() {
  const { ref, isVisible } = useAnimatedSection()

  return (
    <section ref={ref} className="border-t border-border py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4">
        <h2
          className={`mb-4 text-center text-2xl font-bold tracking-tight transition-all duration-500 sm:text-3xl ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          PRICING & PAYMENTS
        </h2>
        <p
          className={`mb-12 text-center text-sm text-text-dim transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          Credits are 1:1 USD. No markup on your deposit.
        </p>

        <div
          className={`overflow-hidden rounded-lg border border-border transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-4 py-3 font-medium text-text-dim">METHOD</th>
                <th className="px-4 py-3 font-medium text-text-dim">SETTLEMENT</th>
                <th className="px-4 py-3 font-medium text-text-dim">FEE</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m, i) => (
                <tr
                  key={m.method}
                  className={`border-b border-border/50 transition-colors duration-300 hover:bg-panel ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ transitionDelay: `${250 + i * 50}ms` }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {m.icon}
                      <span className="text-text">{m.method}</span>
                      {m.badge && (
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          m.badge === 'Best Value' 
                            ? 'bg-cyan/20 text-cyan' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {m.badge}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-dim">{m.settlement}</td>
                  <td
                    className={`px-4 py-3 ${
                      m.fee === '0%' || m.fee === '+5% bonus' ? 'text-cyan font-semibold' : 'text-text-dim'
                    }`}
                  >
                    {m.fee}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className={`mt-10 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '400ms' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-text-dim">
              <Shield className="h-4 w-4 text-cyan" />
              STAKING DISCOUNT TIERS
            </h3>
            <Link
              href="/stake"
              className="flex items-center gap-1 text-xs text-amber transition-colors hover:text-cyan"
            >
              Learn more <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stakingTiers.map((tier, i) => (
              <div
                key={tier.stake}
                className={`card-glow rounded-xl border border-border bg-panel p-4 transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: `${450 + i * 80}ms` }}
              >
                <div className="mb-3 text-center">
                  <span className="text-lg font-bold text-text">{tier.stake}</span>
                </div>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full border border-border bg-void">
                  <div
                    className={`h-full rounded-full ${tier.color} progress-animated`}
                    style={{ width: `${tier.pct}%`, animationDelay: `${500 + i * 100}ms` }}
                  />
                </div>
                <div className="text-center">
                  <span className="text-xl font-bold text-cyan">{tier.discount}</span>
                  <span className="ml-1 text-xs text-text-dim">OFF</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[10px] text-text-dim">
            Max combined: 5% OMA bonus + 15% staking = <span className="text-cyan">20%</span>. Circuit breakers apply.
          </p>
        </div>

        <div
          className={`mt-8 flex items-start gap-3 rounded-xl border border-border bg-panel p-5 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '700ms' }}
        >
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-text-dim" />
          <div>
            <p className="text-xs font-semibold text-text">
              Credits are non-redeemable and non-transferable.
            </p>
            <p className="mt-1 text-xs text-text-dim">
              No MTL license required. 12-month rolling expiry. ~5-8% breakage covers operating
              costs.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}