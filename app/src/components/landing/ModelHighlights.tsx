'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Server, ArrowRight, TrendingUp, Cpu, Coins, Zap, Infinity, Hash } from 'lucide-react'

interface ModelCard {
  name: string
  category: string
  categoryColor: string
  input: string
  output: string
  provider: string
  contextLength?: string
}

interface FreeModelCard {
  name: string
  provider: string
  contextLength: string
  badge: string
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  return prefersReducedMotion
}

function ModelCardComponent({
  model,
  isVisible,
  delay,
  reducedMotion = false,
}: {
  model: ModelCard
  isVisible: boolean
  delay: number
  reducedMotion?: boolean
}) {
  return (
    <div
      className={`group relative p-5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-sm transition-all ${reducedMotion ? 'duration-0' : 'duration-500'} hover:border-[var(--color-cyan)]/30 hover:bg-[var(--color-surface-elevated)] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: reducedMotion ? '0ms' : `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-cyan)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded" />

      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-4">
          <h4 className="text-base font-semibold text-[var(--color-text)]">{model.name}</h4>
          <span
            className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border font-mono ${model.categoryColor}`}
          >
            {model.category}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
            <span className="text-[10px] font-medium uppercase text-[var(--color-text-muted)]">In / 1M</span>
            <p className="font-mono font-semibold text-[var(--color-cyan)] mt-1">{model.input}</p>
          </div>
          <div className="p-3 rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
            <span className="text-[10px] font-medium uppercase text-[var(--color-text-muted)]">Out / 1M</span>
            <p className="font-mono font-semibold text-[var(--color-text-secondary)] mt-1">{model.output}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <span className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)] font-mono">{model.provider}</span>
          </div>
          {model.contextLength && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <Hash className="w-3 h-3" />
              <span className="font-mono">{model.contextLength}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FreeModelCardComponent({
  model,
  isVisible,
  delay,
  reducedMotion = false,
}: {
  model: FreeModelCard
  isVisible: boolean
  delay: number
  reducedMotion?: boolean
}) {
  return (
    <div
      className={`group relative p-5 rounded border border-[var(--color-success)]/20 bg-[var(--color-surface)] backdrop-blur-sm transition-all ${reducedMotion ? 'duration-0' : 'duration-500'} hover:border-[var(--color-success)]/40 hover:bg-[var(--color-surface-elevated)] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: reducedMotion ? '0ms' : `${delay}ms` }}
    >
      <div className="absolute top-3 right-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-success)]/20 border border-[var(--color-success)]/30 text-[10px] font-bold text-[var(--color-success)] uppercase tracking-wider font-mono">
          <Zap className="w-3 h-3" />
          {model.badge}
        </span>
      </div>

      <div className="relative">
        <h4 className="text-base font-semibold text-[var(--color-text)] mb-1">{model.name}</h4>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">{model.provider}</p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <Infinity className="w-3.5 h-3.5 text-[var(--color-cyan)]" />
            <span className="font-mono">{model.contextLength}</span>
          </div>
          <div className="h-3 w-px bg-[var(--color-border-bright)]" />
          <span className="text-xs text-[var(--color-success)] font-medium font-mono">$0.00</span>
        </div>
      </div>
    </div>
  )
}

const paidModels = [
  {
    name: 'GPT-4o',
    category: 'Frontier',
    categoryColor: 'border-[var(--color-cyan)]/30 text-[var(--color-cyan)] bg-[var(--color-cyan)]/10',
    input: '$2.50',
    output: '$10.00',
    provider: 'Venice',
    contextLength: '128K',
  },
  {
    name: 'Claude 4 Sonnet',
    category: 'Frontier',
    categoryColor: 'border-[var(--color-cyan)]/30 text-[var(--color-cyan)] bg-[var(--color-cyan)]/10',
    input: '$3.00',
    output: '$15.00',
    provider: 'Venice',
    contextLength: '200K',
  },
  {
    name: 'Gemini 2.5 Pro',
    category: 'Frontier',
    categoryColor: 'border-[var(--color-cyan)]/30 text-[var(--color-cyan)] bg-[var(--color-cyan)]/10',
    input: '$1.50',
    output: '$9.00',
    provider: 'Venice',
    contextLength: '1M',
  },
  {
    name: 'DeepSeek R1',
    category: 'Reasoning',
    categoryColor: 'border-[var(--color-secondary)]/30 text-[var(--color-secondary)] bg-[var(--color-secondary)]/10',
    input: '$0.55',
    output: '$2.19',
    provider: 'AntSeed',
    contextLength: '64K',
  },
  {
    name: 'DeepSeek V4',
    category: 'Open Source',
    categoryColor: 'border-[var(--color-success)]/30 text-[var(--color-success)] bg-[var(--color-success)]/10',
    input: '$0.18',
    output: '$1.00',
    provider: 'AntSeed',
    contextLength: '64K',
  },
  {
    name: 'Llama 4 Scout',
    category: 'Open Source',
    categoryColor: 'border-[var(--color-success)]/30 text-[var(--color-success)] bg-[var(--color-success)]/10',
    input: '$0.30',
    output: '$0.48',
    provider: 'Venice',
    contextLength: '128K',
  },
  {
    name: 'o3',
    category: 'Reasoning',
    categoryColor: 'border-[var(--color-secondary)]/30 text-[var(--color-secondary)] bg-[var(--color-secondary)]/10',
    input: '$10.00',
    output: '$40.00',
    provider: 'Venice',
    contextLength: '200K',
  },
  {
    name: 'Gemma 3 27B',
    category: 'Budget',
    categoryColor: 'border-[var(--color-violet)]/30 text-[var(--color-violet)] bg-[var(--color-violet)]/10',
    input: '$0.04',
    output: '$0.10',
    provider: 'AntSeed',
    contextLength: '128K',
  },
]

const freeModels: FreeModelCard[] = [
  { name: 'DeepSeek R1', provider: '', contextLength: '64K context', badge: 'Budget' },
  { name: 'Llama 3.2 3B', provider: '', contextLength: '128K context', badge: 'Budget' },
  { name: 'Mistral 7B', provider: '', contextLength: '32K context', badge: 'Budget' },
  { name: 'Qwen 2.5 72B', provider: '', contextLength: '32K context', badge: 'Budget' },
  { name: 'Gemma 3 2B', provider: '', contextLength: '128K context', badge: 'Budget' },
  { name: 'Phi-4 3.8B', provider: '', contextLength: '16K context', badge: 'Budget' },
]

const stats = [
  { icon: TrendingUp, text: 'Auto-routing for lowest latency' },
  { icon: Cpu, text: 'Multi-provider inference network' },
  { icon: Coins, text: 'Pay with 100+ cryptocurrencies' },
]

export function ModelHighlights() {
  const [isVisible, setIsVisible] = useState(false)
  const [freeModelsVisible, setFreeModelsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const freeModelsRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const element = ref.current
    if (!element) return
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
    observer.observe(element)
    return () => observer.disconnect()
  }, [prefersReducedMotion])

  useEffect(() => {
    const element = freeModelsRef.current
    if (!element) return
    if (prefersReducedMotion) {
      setFreeModelsVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setFreeModelsVisible(true)
      },
      { threshold: 0.2 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [prefersReducedMotion])

  return (
    <section ref={ref} aria-label="Model highlights" className="relative py-24 px-4">
      <div className="absolute inset-0 bg-[var(--color-void)]" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div
          className={`text-center mb-12 transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-700'} ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/10 mb-6">
            <Sparkles className="w-4 h-4 text-[var(--color-cyan)]" />
            <span className="text-sm font-medium text-[var(--color-cyan)] font-mono">50+ models available</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-mono font-bold tracking-tight text-[var(--color-text)] mb-4">
            Every model. One API.
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
            From frontier models to budget options. Pay per token, no subscriptions, no minimums.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paidModels.map((model, i) => (
            <ModelCardComponent key={model.name} model={model} isVisible={isVisible} delay={i * 80} reducedMotion={prefersReducedMotion} />
          ))}
        </div>

        <div
          className={`mt-12 text-center transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-700'} ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: prefersReducedMotion ? '0ms' : '400ms' }}
        >
          <Link
            href="/models"
            className="inline-flex items-center gap-2 px-6 py-3 rounded border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)] font-medium hover:bg-[var(--color-cyan)]/20 hover:border-[var(--color-cyan)]/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
          >
            View all models
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div
          className={`mt-16 p-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-700'} ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: prefersReducedMotion ? '0ms' : '600ms' }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 mb-4">
              <Zap className="w-4 h-4 text-[var(--color-success)]" />
              <span className="text-sm font-medium text-[var(--color-success)] font-mono">No credit card required</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-mono font-bold text-[var(--color-text)] mb-2">Budget Models</h3>
            <p className="text-[var(--color-text-muted)]">Low-cost models to get started</p>
          </div>

          <div ref={freeModelsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {freeModels.map((model, i) => (
              <FreeModelCardComponent
                key={model.name}
                model={model}
                isVisible={freeModelsVisible}
                delay={i * 80}
                reducedMotion={prefersReducedMotion}
              />
            ))}
          </div>
        </div>

        <div
          className={`mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--color-text-muted)] transition-all ${prefersReducedMotion ? 'duration-0' : 'duration-700'} ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: prefersReducedMotion ? '0ms' : '800ms' }}
        >
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-2">
              <stat.icon className="w-4 h-4 text-[var(--color-cyan)]/60" />
              <span>{stat.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}