'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Shield, Zap, Key, Coins } from 'lucide-react'

function useAnimatedSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(element)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

export function CtaFooter() {
  const { ref, isVisible } = useAnimatedSection()

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className={`text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Start Building in 2 Minutes
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto mb-10">
            Connect your wallet, fund with any crypto, and start calling models in under 2 minutes.
          </p>
          
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '200ms' }}>
            <Link
              href="/dashboard"
              className="btn-primary text-lg px-8 py-4"
            >
              <Key className="w-5 h-5 mr-2" />
              Get API Key
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              href="/deposit"
              className="btn-secondary text-lg px-8 py-4"
            >
              <Coins className="w-5 h-5 mr-2" />
              Deposit Crypto
            </Link>
            <Link
              href="/docs"
              className="px-6 py-4 text-base font-medium text-zinc-500 hover:text-cyan-400 transition-colors"
            >
              Read the Docs
              <ArrowRight className="w-4 h-4 ml-2 inline-block" />
            </Link>
          </div>

          <div className={`mt-16 p-8 rounded-2xl bg-gradient-to-r from-zinc-900/80 to-zinc-900/50 border border-amber-500/20 backdrop-blur-sm transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '400ms' }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-300">Exclusive Benefit</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">
              Stake OMA for up to 15% discount
            </h3>
            <p className="text-zinc-500 mb-6 max-w-lg mx-auto">
              Hold OMA tokens to unlock tiered discounts on all API calls. Plus get +5% bonus when depositing with OMA.
            </p>
            <Link
              href="/stake"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium hover:bg-amber-500/20 hover:border-amber-400/50 transition-all"
            >
              <Zap className="w-4 h-4" />
              Start Staking
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}