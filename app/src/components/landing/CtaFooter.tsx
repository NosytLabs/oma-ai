'use client'

import { useAnimatedSection } from '@/lib/hooks'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Shield, Zap, Key, Coins } from 'lucide-react'

export function CtaFooter() {
  const { ref, isVisible } = useAnimatedSection()

  return (
    <section ref={ref} className="border-t border-zinc-200 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2
          className={`mb-4 text-2xl font-bold tracking-tight transition-all duration-500 sm:text-3xl ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          START BUILDING IN 2 MINUTES
        </h2>
        <p
          className={`mb-8 text-sm text-slate-500 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          Connect your wallet, fund with any crypto, and start calling models in under 2 minutes.
        </p>
        <div
          className={`flex flex-col items-center justify-center gap-4 transition-all duration-500 sm:flex-row sm:justify-center ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <Link
            href="/dashboard"
            className="group relative inline-flex items-center gap-2 rounded-xl border border-indigo-400/50 bg-indigo-50 px-8 py-4 text-base font-bold text-indigo-600 transition-all duration-300 hover:border-indigo-500 hover:bg-indigo-500 hover:text-white hover:shadow-[0_0_30px_rgba(99,102,241,0.25)] hover:scale-105 active:scale-100 min-h-[52px] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-indigo-500/0 group-hover:animate-pulse" />
            <Key className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Get API Key Free
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/deposit"
            className="group inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-50 px-7 py-4 text-sm font-semibold text-emerald-600 transition-all duration-300 hover:border-emerald-500/60 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_25px_rgba(16,185,129,0.2)] hover:scale-105 active:scale-100 min-h-[52px]"
          >
            <Coins className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Deposit Crypto
          </Link>
          <Link
            href="/docs"
            className="btn-secondary inline-flex items-center gap-2 px-6 py-3.5 text-base font-mono min-h-[48px]"
          >
            Read the Docs
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Staking CTA */}
        <div
          className={`mt-10 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '400ms' }}
        >
          <div className="rounded-xl border border-amber-300/40 bg-gradient-to-r from-amber-50 to-orange-50 p-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1">
              <Shield className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-600">EXCLUSIVE BENEFIT</span>
            </div>
            <h3 className="mb-2 text-lg font-bold text-zinc-900">
              Stake OMA for up to 15% discount
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              Hold OMA tokens to unlock tiered discounts on all API calls. Plus get +5% bonus when depositing with OMA.
            </p>
            <Link
              href="/stake"
              className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-6 py-2.5 text-sm font-semibold text-amber-600 transition-all duration-200 hover:border-amber-500/60 hover:bg-amber-100 hover:shadow-[0_0_20px_rgba(255,184,0,0.15)] min-h-[44px]"
            >
              <Zap className="h-4 w-4" />
              Start Staking
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}