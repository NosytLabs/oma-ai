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

function ModelCardComponent({
  model,
  isVisible,
  delay,
}: {
  model: ModelCard
  isVisible: boolean
  delay: number
}) {
  return (
    <div
      className={`group relative p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm transition-all duration-500 hover:border-cyan-500/30 hover:bg-zinc-900/80 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-4">
          <h4 className="text-base font-semibold text-white">{model.name}</h4>
          <span
            className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${model.categoryColor}`}
          >
            {model.category}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
            <span className="text-[10px] font-medium uppercase text-zinc-600">In / 1M</span>
            <p className="font-mono font-semibold text-cyan-400 mt-1">{model.input}</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
            <span className="text-[10px] font-medium uppercase text-zinc-600">Out / 1M</span>
            <p className="font-mono font-semibold text-zinc-300 mt-1">{model.output}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-[11px] font-semibold uppercase text-zinc-500">{model.provider}</span>
          </div>
          {model.contextLength && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Hash className="w-3 h-3" />
              <span>{model.contextLength}</span>
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
}: {
  model: FreeModelCard
  isVisible: boolean
  delay: number
}) {
  return (
    <div
      className={`group relative p-5 rounded-xl bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 border border-emerald-500/20 backdrop-blur-sm transition-all duration-500 hover:border-emerald-500/40 hover:bg-gradient-to-br hover:from-emerald-500/10 hover:to-cyan-500/10 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="absolute top-3 right-3">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
          <Zap className="w-3 h-3" />
          {model.badge}
        </span>
      </div>

      <div className="relative">
        <h4 className="text-base font-semibold text-white mb-1">{model.name}</h4>
        <p className="text-xs text-zinc-500 mb-4">{model.provider}</p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Infinity className="w-3.5 h-3.5 text-cyan-400" />
            <span>{model.contextLength}</span>
          </div>
          <div className="h-3 w-px bg-zinc-700" />
          <span className="text-xs text-emerald-400 font-medium">$0.00</span>
        </div>
      </div>
    </div>
  )
}

const paidModels = [
  {
    name: 'GPT-4o',
    category: 'Frontier',
    categoryColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
    input: '$2.50',
    output: '$10.00',
    provider: 'Venice',
    contextLength: '128K',
  },
  {
    name: 'Claude 4 Sonnet',
    category: 'Frontier',
    categoryColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
    input: '$3.00',
    output: '$15.00',
    provider: 'Venice',
    contextLength: '200K',
  },
  {
    name: 'Gemini 2.5 Pro',
    category: 'Frontier',
    categoryColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
    input: '$1.50',
    output: '$9.00',
    provider: 'Venice',
    contextLength: '1M',
  },
  {
    name: 'DeepSeek R1',
    category: 'Reasoning',
    categoryColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    input: '$0.55',
    output: '$2.19',
    provider: 'AntSeed',
    contextLength: '64K',
  },
  {
    name: 'DeepSeek V4',
    category: 'Open Source',
    categoryColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    input: '$0.18',
    output: '$1.00',
    provider: 'AntSeed',
    contextLength: '64K',
  },
  {
    name: 'Llama 4 Scout',
    category: 'Open Source',
    categoryColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    input: '$0.30',
    output: '$0.48',
    provider: 'Venice',
    contextLength: '128K',
  },
  {
    name: 'o3',
    category: 'Reasoning',
    categoryColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    input: '$10.00',
    output: '$40.00',
    provider: 'Venice',
    contextLength: '200K',
  },
  {
    name: 'Gemma 3 27B',
    category: 'Budget',
    categoryColor: 'border-pink-500/30 text-pink-400 bg-pink-500/10',
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
        if (entry.isIntersecting) setFreeModelsVisible(true)
      },
      { threshold: 0.2 }
    )
    if (freeModelsRef.current) observer.observe(freeModelsRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="relative py-24 px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">50+ models available</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Every model. One API.
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            From frontier models to budget options. Pay per token, no subscriptions, no minimums.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paidModels.map((model, i) => (
            <ModelCardComponent key={model.name} model={model} isVisible={isVisible} delay={i * 80} />
          ))}
        </div>

        <div
          className={`mt-12 text-center transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '400ms' }}
        >
          <Link
            href="/models"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-medium hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all"
          >
            View all models
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div
          className={`mt-16 p-8 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800/50 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '600ms' }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">No credit card required</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Budget Models</h3>
            <p className="text-zinc-500">Low-cost models to get started</p>
          </div>

          <div ref={freeModelsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {freeModels.map((model, i) => (
              <FreeModelCardComponent
                key={model.name}
                model={model}
                isVisible={freeModelsVisible}
                delay={i * 80}
              />
            ))}
          </div>
        </div>

        <div
          className={`mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-600 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '800ms' }}
        >
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-2">
              <stat.icon className="w-4 h-4 text-cyan-500/60" />
              <span>{stat.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}