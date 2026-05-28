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
      <div className="absolute inset-0 bg-[var(--color-void)]" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className={`text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-4xl md:text-5xl font-mono font-bold tracking-tight text-[var(--color-text)] mb-4">
            Start Building in 2 Minutes
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10">
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
              className="px-6 py-4 text-base font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-cyan)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
            >
              Read the Docs
              <ArrowRight className="w-4 h-4 ml-2 inline-block" />
            </Link>
          </div>

          <div className={`mt-16 p-8 rounded-lg border border-[var(--color-secondary)]/20 bg-[var(--color-surface)] backdrop-blur-sm transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: '400ms' }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/10 mb-4">
              <Shield className="w-4 h-4 text-[var(--color-secondary)]" />
              <span className="text-sm font-medium text-[var(--color-secondary)] font-mono">Exclusive Benefit</span>
            </div>
            <h3 className="text-2xl font-mono font-bold text-[var(--color-text)] mb-3">
              Stake OMA for up to 15% discount
            </h3>
            <p className="text-[var(--color-text-secondary)] mb-6 max-w-lg mx-auto">
              Hold OMA tokens to unlock tiered discounts on all API calls. Plus get +5% bonus when depositing with OMA.
            </p>
            <Link
              href="/stake"
              className="inline-flex items-center gap-2 px-6 py-3 rounded border border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] font-medium hover:bg-[var(--color-secondary)]/20 hover:border-[var(--color-secondary)]/50 transition-all"
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