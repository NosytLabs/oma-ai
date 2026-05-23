'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Zap, ArrowRight, Coins, Shield, Rocket, Users } from 'lucide-react'

const BUDGET_MODELS = [
  { name: 'DeepSeek R1', desc: 'Advanced reasoning' },
  { name: 'Llama 3.2 3B', desc: 'Fast & efficient' },
  { name: 'Mistral 7B', desc: 'Balanced performance' },
]

const STEPS = [
  { icon: Users, title: 'Create free account', desc: 'Sign up in seconds, no credit card required' },
  { icon: Shield, title: 'Get API key', desc: 'Instant access to your dashboard' },
  { icon: Coins, title: 'Buy credits', desc: '$1 = 100 credits. 50+ models available.' },
  { icon: Rocket, title: 'Start building', desc: 'OpenAI-compatible API. Integrate in minutes.' },
]

function AnimatedSection({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export function PricingTiers() {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <section ref={ref} className="relative py-24 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-cyan-500/5 rounded-full blur-[200px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Coins className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">Credits-Based Pricing</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Pay only for what you use
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            No subscriptions. No monthly plans. Buy credits and spend them across 50+ models.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={100} className="mb-16">
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-zinc-900/80 to-zinc-900/80 p-8 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Starter Credits</h3>
                  <p className="text-cyan-400 font-medium">Try at low cost</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {BUDGET_MODELS.map((model) => (
                  <div key={model.name} className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{model.name}</p>
                      <p className="text-xs text-zinc-500">{model.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-zinc-900 font-semibold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30"
                >
                  <Rocket className="w-5 h-5" />
                  Start building
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-sm text-zinc-500">No credit card required</p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={200} className="mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">How It Works</h3>
            <p className="text-zinc-500">Start in minutes, scale infinitely</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="relative p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-cyan-500/30 transition-colors">
                  <div className="absolute -top-3 left-6 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mb-4 mt-2">
                    <Icon className="w-5 h-5 text-zinc-400" />
                  </div>
                  <h4 className="font-semibold text-white mb-1">{step.title}</h4>
                  <p className="text-sm text-zinc-500">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </AnimatedSection>



        <AnimatedSection delay={400} className="mt-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: '50+', label: 'Models Available' },
              { value: '$0', label: 'Starter Credits' },
              { value: '50', label: 'Req/day Starter' },
              { value: '0%', label: 'Subscription' },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-xs text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={500} className="mt-12 text-center">
          <p className="text-sm text-zinc-500">
            All plans include access to our REST API and OpenAI-compatible endpoint.
            <Link href="/pricing" className="text-cyan-400 hover:text-cyan-300 ml-1">
              View full pricing
              <ArrowRight className="w-3 h-3 inline ml-1" />
            </Link>
          </p>
        </AnimatedSection>
      </div>
    </section>
  )
}