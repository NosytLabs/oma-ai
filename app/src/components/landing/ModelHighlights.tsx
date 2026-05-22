'use client'

import { useAnimatedSection } from '@/lib/hooks'
import Link from 'next/link'
import { Sparkles, Zap, Brain, Server, ArrowRight } from 'lucide-react'

interface ModelCard {
  name: string
  category: string
  categoryColor: string
  input: string
  output: string
  provider: string
  providerColor: string
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
      className={`model-card card-glow card card-border-glow card-hover-lift flex flex-col gap-3 transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-text">{model.name}</h4>
        <span className={`badge shrink-0 ${model.categoryColor}`}>
          {model.category}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-text-dim">IN / 1M</span>
          <p className="font-semibold text-text">{model.input}</p>
        </div>
        <div>
          <span className="text-text-dim">OUT / 1M</span>
          <p className="font-semibold text-text">{model.output}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-zinc-200 pt-2">
        <Server className="h-3 w-3 text-slate-400" />
        <span className={`text-[10px] font-semibold uppercase ${model.providerColor}`}>
          {model.provider}
        </span>
      </div>
    </div>
  )
}

const frontier: ModelCard[] = [
  {
    name: 'Claude Opus 4.7',
    category: 'FRONTIER',
    categoryColor: 'border-cyan/40 text-cyan bg-cyan/10',
    input: '$15.00',
    output: '$75.00',
    provider: 'VENICE',
    providerColor: 'text-amber',
  },
  {
    name: 'GPT-4o',
    category: 'FRONTIER',
    categoryColor: 'border-cyan/40 text-cyan bg-cyan/10',
    input: '$2.50',
    output: '$10.00',
    provider: 'VENICE',
    providerColor: 'text-amber',
  },
  {
    name: 'o3',
    category: 'REASONING',
    categoryColor: 'border-amber/40 text-amber bg-amber/10',
    input: '$10.00',
    output: '$40.00',
    provider: 'VENICE',
    providerColor: 'text-amber',
  },
  {
    name: 'Gemini 3.5 Flash',
    category: 'FRONTIER',
    categoryColor: 'border-cyan/40 text-cyan bg-cyan/10',
    input: '$1.50',
    output: '$9.00',
    provider: 'VENICE',
    providerColor: 'text-amber',
  },
]

const openSource: ModelCard[] = [
  {
    name: 'DeepSeek V4 Pro',
    category: 'OPEN-SOURCE',
    categoryColor: 'border-green/40 text-green bg-green/10',
    input: '$0.18',
    output: '$1.00',
    provider: 'ANTSEED',
    providerColor: 'text-cyan',
  },
  {
    name: 'DeepSeek R1',
    category: 'OPEN-SOURCE',
    categoryColor: 'border-green/40 text-green bg-green/10',
    input: '$0.55',
    output: '$2.19',
    provider: 'ANTSEED',
    providerColor: 'text-cyan',
  },
  {
    name: 'Llama 3.3 70B',
    category: 'OPEN-SOURCE',
    categoryColor: 'border-green/40 text-green bg-green/10',
    input: '$0.30',
    output: '$0.48',
    provider: 'VENICE',
    providerColor: 'text-amber',
  },
  {
    name: 'Gemma 3 27B',
    category: 'OPEN-SOURCE',
    categoryColor: 'border-green/40 text-green bg-green/10',
    input: '$0.04',
    output: '$0.10',
    provider: 'ANTSEED',
    providerColor: 'text-cyan',
  },
]

const specialized: ModelCard[] = [
  {
    name: 'Venice Uncensored',
    category: 'UNCENSORED',
    categoryColor: 'border-pink/40 text-pink bg-pink/10',
    input: '$0.07',
    output: '$0.35',
    provider: 'VENICE',
    providerColor: 'text-amber',
  },
  {
    name: 'ChainScout Guard V1',
    category: 'GUARDRAIL',
    categoryColor: 'border-amber/40 text-amber bg-amber/10',
    input: '$25.00',
    output: '$120.00',
    provider: 'ANTSEED',
    providerColor: 'text-cyan',
  },
]

function ModelSection({
  title,
  icon,
  colorClass,
  models,
  isVisible,
  baseDelay,
}: {
  title: string
  icon: React.ReactNode
  colorClass: string
  models: ModelCard[]
  isVisible: boolean
  baseDelay: number
}) {
  return (
    <div>
      <h3
        className={`mb-4 flex items-center gap-2 text-xs font-bold tracking-widest ${colorClass} transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
        }`}
        style={{ transitionDelay: `${baseDelay}ms` }}
      >
        {icon}
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {models.map((m, i) => (
          <ModelCardComponent
            key={m.name}
            model={m}
            isVisible={isVisible}
            delay={baseDelay + i * 80}
          />
        ))}
      </div>
    </div>
  )
}

export function ModelHighlights() {
  const { ref, isVisible } = useAnimatedSection()

  return (
    <section ref={ref} className="border-t border-zinc-200 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h2
          className={`mb-4 text-center text-2xl font-bold tracking-tight transition-all duration-500 sm:text-3xl ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          MODEL HIGHLIGHTS
        </h2>
        <p
          className={`mb-12 text-center text-sm text-text-dim transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          Per 1M tokens. Pay as you go. No subscriptions.
        </p>

        <div className="space-y-12">
          <ModelSection
            title="FRONTIER MODELS"
            icon={<Sparkles className="h-4 w-4" />}
            colorClass="text-cyan"
            models={frontier}
            isVisible={isVisible}
            baseDelay={200}
          />

          <ModelSection
            title="OPEN-SOURCE VALUE"
            icon={<Zap className="h-4 w-4" />}
            colorClass="text-emerald-600"
            models={openSource}
            isVisible={isVisible}
            baseDelay={400}
          />

          <ModelSection
            title="SPECIALIZED"
            icon={<Brain className="h-4 w-4" />}
            colorClass="text-amber-600"
            models={specialized}
            isVisible={isVisible}
            baseDelay={600}
          />
        </div>

        <div
          className={`mt-8 text-center transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '800ms' }}
        >
          <Link
            href="/models"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:text-zinc-900 arrow-animate"
          >
            View all 50+ models
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}