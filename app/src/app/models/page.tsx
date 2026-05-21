'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Cpu, Zap, Brain, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type Category = 'all' | 'budget' | 'mid' | 'premium' | 'frontier' | 'coding' | 'reasoning' | 'uncensored'

interface Model {
  id: string
  name: string
  category: 'budget' | 'mid' | 'premium' | 'frontier'
  provider: 'Venice' | 'AntSeed' | 'Both'
  input: number
  output: number
  ctx: string
  caps: string[]
}

const MODELS: Model[] = [
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', category: 'frontier', provider: 'Venice', input: 15.00, output: 75.00, ctx: '200K', caps: ['chat','coding','reasoning','vision'] },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', category: 'frontier', provider: 'Venice', input: 3.00, output: 15.00, ctx: '200K', caps: ['chat','coding','vision'] },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', category: 'premium', provider: 'Venice', input: 0.80, output: 4.00, ctx: '200K', caps: ['chat','fast','vision'] },
  { id: 'gpt-5.5', name: 'GPT-5.5', category: 'frontier', provider: 'Venice', input: 10.00, output: 30.00, ctx: '128K', caps: ['chat','coding','reasoning'] },
  { id: 'gpt-4o', name: 'GPT-4o', category: 'frontier', provider: 'Venice', input: 2.50, output: 10.00, ctx: '128K', caps: ['chat','coding','vision'] },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', category: 'premium', provider: 'Venice', input: 0.15, output: 0.60, ctx: '128K', caps: ['chat','fast'] },
  { id: 'o3', name: 'OpenAI o3', category: 'frontier', provider: 'Venice', input: 10.00, output: 40.00, ctx: '200K', caps: ['reasoning','coding','agents'] },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', category: 'frontier', provider: 'Venice', input: 1.50, output: 9.00, ctx: '1M', caps: ['chat','reasoning','vision'] },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', category: 'premium', provider: 'Venice', input: 0.15, output: 0.60, ctx: '1M', caps: ['chat','fast','vision'] },
  { id: 'grok-41-fast', name: 'Grok 4.1 Fast', category: 'premium', provider: 'AntSeed', input: 0.26, output: 0.66, ctx: '128K', caps: ['chat','fast','reasoning'] },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', category: 'premium', provider: 'AntSeed', input: 0.18, output: 1.00, ctx: '128K', caps: ['chat','coding','reasoning','math'] },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', category: 'mid', provider: 'AntSeed', input: 0.05, output: 0.19, ctx: '128K', caps: ['chat','fast','coding'] },
  { id: 'deepseek-r1', name: 'DeepSeek R1', category: 'premium', provider: 'AntSeed', input: 0.55, output: 2.19, ctx: '64K', caps: ['reasoning','math','coding'] },
  { id: 'qwen3-235b-thinking', name: 'Qwen3 235B Thinking', category: 'premium', provider: 'AntSeed', input: 0.45, output: 2.11, ctx: '128K', caps: ['reasoning'] },
  { id: 'qwen3-coder-480b', name: 'Qwen3 Coder 480B', category: 'premium', provider: 'AntSeed', input: 0.14, output: 0.60, ctx: '128K', caps: ['coding','chat','reasoning'] },
  { id: 'qwen3-coder-30b', name: 'Qwen3 Coder 30B', category: 'budget', provider: 'AntSeed', input: 0.01, output: 0.02, ctx: '64K', caps: ['coding','fast'] },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', category: 'mid', provider: 'Both', input: 0.30, output: 0.48, ctx: '128K', caps: ['chat','fast'] },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', category: 'budget', provider: 'AntSeed', input: 0.01, output: 0.01, ctx: '128K', caps: ['chat','fast','cheap'] },
  { id: 'qwen3-235b', name: 'Qwen3 235B', category: 'mid', provider: 'AntSeed', input: 0.09, output: 0.45, ctx: '128K', caps: ['chat','reasoning'] },
  { id: 'qwen3-8b', name: 'Qwen3 8B', category: 'budget', provider: 'AntSeed', input: 0.01, output: 0.01, ctx: '32K', caps: ['chat','fast','cheap'] },
  { id: 'glm-5.1', name: 'GLM-5.1', category: 'mid', provider: 'AntSeed', input: 0.25, output: 0.60, ctx: '128K', caps: ['chat','coding'] },
  { id: 'kimi-k2-6', name: 'Kimi K2.6', category: 'mid', provider: 'AntSeed', input: 0.07, output: 0.42, ctx: '128K', caps: ['chat','reasoning','coding'] },
  { id: 'gemma-3-27b', name: 'Gemma 3 27B', category: 'mid', provider: 'AntSeed', input: 0.09, output: 0.18, ctx: '128K', caps: ['chat','vision'] },
  { id: 'gemma4-31b', name: 'Gemma 4 31B', category: 'budget', provider: 'AntSeed', input: 0.01, output: 0.02, ctx: '128K', caps: ['chat','coding','vision'] },
  { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', category: 'mid', provider: 'AntSeed', input: 0.04, output: 0.14, ctx: '128K', caps: ['chat','coding','math'] },
  { id: 'minimax-m2.7', name: 'MiniMax M2.7', category: 'budget', provider: 'AntSeed', input: 0.01, output: 0.02, ctx: '64K', caps: ['chat','fast'] },
  { id: 'mistral-large', name: 'Mistral Large', category: 'frontier', provider: 'Venice', input: 2.00, output: 6.00, ctx: '128K', caps: ['chat','reasoning'] },
  { id: 'mistral-small-3.2', name: 'Mistral Small 3.2', category: 'mid', provider: 'AntSeed', input: 0.09, output: 0.25, ctx: '64K', caps: ['chat','fast'] },
  { id: 'qwen2.5-72b', name: 'Qwen 2.5 72B', category: 'mid', provider: 'AntSeed', input: 0.40, output: 0.40, ctx: '32K', caps: ['chat','coding','math'] },
  { id: 'venice-uncensored', name: 'Venice Uncensored', category: 'premium', provider: 'Venice', input: 0.07, output: 0.35, ctx: '32K', caps: ['chat','uncensored','vision'] },
]

const CATEGORIES: { key: Category; label: string; icon?: React.ReactNode }[] = [
  { key: 'all', label: 'All' },
  { key: 'budget', label: 'Budget' },
  { key: 'mid', label: 'Mid' },
  { key: 'premium', label: 'Premium' },
  { key: 'frontier', label: 'Frontier' },
  { key: 'coding', label: 'Coding' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'uncensored', label: 'Uncensored' },
]

const CATEGORY_COLORS: Record<string, string> = {
  budget: 'bg-green/15 text-green border-green/30',
  mid: 'bg-cyan/15 text-cyan border-cyan/30',
  premium: 'bg-amber/15 text-amber border-amber/30',
  frontier: 'bg-pink/15 text-pink border-pink/30',
}

const CAP_COLORS: Record<string, string> = {
  chat: 'text-text-dim',
  coding: 'text-cyan',
  reasoning: 'bg-amber/10 text-amber',
  vision: 'bg-purple-500/15 text-purple-400',
  fast: 'bg-green/10 text-green',
  math: 'bg-blue-500/15 text-blue-400',
  cheap: 'text-green',
  agents: 'bg-pink/10 text-pink',
  uncensored: 'bg-pink/10 text-pink',
}

const PROVIDER_STYLES: Record<string, string> = {
  Venice: 'bg-cyan/10 text-cyan border-cyan/20',
  AntSeed: 'bg-green/10 text-green border-green/20',
  Both: 'bg-amber/10 text-amber border-amber/20',
}

function formatPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(2)}`
  if (price < 1) return `$${price.toFixed(2)}`
  return `$${price.toFixed(2)}`
}

function matchesFilter(model: Model, category: Category): boolean {
  if (category === 'all') return true
  if (category === 'uncensored') return model.caps.includes('uncensored')
  if (category === 'coding') return model.caps.includes('coding')
  if (category === 'reasoning') return model.caps.includes('reasoning')
  return model.category === category
}

function ModelCard({ model, delay }: { model: Model; delay: number }) {
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
      className={`card-glow card flex flex-col gap-3 transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-cyan">{model.id}</p>
          <p className="mt-0.5 text-sm font-semibold text-text">{model.name}</p>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${PROVIDER_STYLES[model.provider]}`}
        >
          {model.provider}
        </span>
      </div>

      <div>
        <span
          className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORY_COLORS[model.category]}`}
        >
          {model.category}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded border border-border bg-void/50 p-2.5">
        <div>
          <p className="text-[10px] uppercase text-text-dim">Input / 1M</p>
          <p className="text-sm font-bold text-text">{formatPrice(model.input)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-text-dim">Output / 1M</p>
          <p className="text-sm font-bold text-text">{formatPrice(model.output)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Brain className="h-3 w-3 text-text-dim" />
        <span className="text-[11px] text-text-dim">
          Context: <span className="font-semibold text-text">{model.ctx}</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
        {model.caps.map((cap) => (
          <span
            key={cap}
            className={`rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              CAP_COLORS[cap] || 'text-text-dim'
            }`}
          >
            {cap}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ModelsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [isVisible, setIsVisible] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = headerRef.current
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

  const filtered = useMemo(() => {
    return MODELS.filter((m) => {
      const catMatch = matchesFilter(m, activeCategory)
      if (!catMatch) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.caps.some((c) => c.toLowerCase().includes(q))
      )
    })
  }, [activeCategory, search])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 font-mono">
      {/* Header */}
      <div ref={headerRef} className="mb-8">
        <h1
          className={`text-3xl font-bold tracking-tight transition-all duration-500 sm:text-4xl ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="glow-text text-cyan">MODELS</span>
        </h1>
        <p
          className={`mt-2 text-sm text-text-dim transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          {MODELS.length}+ models. OpenAI-compatible. Pay per token.
        </p>
      </div>

      {/* Filter Bar */}
      <div
        className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
        style={{ transitionDelay: '200ms' }}
      >
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                activeCategory === cat.key
                  ? 'bg-cyan text-void border border-cyan'
                  : 'bg-panel text-text-dim border border-border hover:border-cyan/50 hover:text-cyan'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-border bg-panel py-2 pl-9 pr-4 text-xs text-text placeholder:text-text-dim focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan/30 sm:w-64"
          />
        </div>
      </div>

      {/* Stats Bar */}
      <div
        className={`mb-6 flex items-center gap-4 rounded border border-border bg-panel px-4 py-2.5 transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
        style={{ transitionDelay: '300ms' }}
      >
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-cyan" />
          <span className="text-xs text-text-dim">
            <span className="font-bold text-text">{filtered.length}</span> models available
          </span>
        </div>
        <span className="text-border">|</span>
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-cyan" />
          <span className="text-xs text-text-dim">Venice AI + AntSeed P2P</span>
        </div>
        {activeCategory !== 'all' && (
          <>
            <span className="text-border">|</span>
            <button
              onClick={() => setActiveCategory('all')}
              className="text-xs text-cyan hover:underline"
            >
              Clear filter
            </button>
          </>
        )}
      </div>

      {/* Model Cards Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-dim">
          <Search className="mb-4 h-8 w-8 opacity-30" />
          <p className="text-sm">No models match your criteria.</p>
          <button
            onClick={() => { setActiveCategory('all'); setSearch('') }}
            className="mt-3 text-xs text-cyan hover:underline"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((model, i) => (
            <ModelCard key={model.id} model={model} delay={i * 50} />
          ))}
        </div>
      )}

      {/* Provider Legend */}
      <div
        className={`mt-12 border-t border-border pt-8 transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
        style={{ transitionDelay: '500ms' }}
      >
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-dim">
          Provider Legend
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card-glow card">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan" />
              <span className="text-xs font-bold uppercase text-cyan">Venice AI</span>
            </div>
            <p className="text-[11px] leading-relaxed text-text-dim">
              Hosted inference for proprietary models (GPT, Claude, Gemini, Mistral).
              Low-latency, high-availability. 0-10% markup.
            </p>
          </div>
          <div className="card-glow card">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green" />
              <span className="text-xs font-bold uppercase text-green">AntSeed P2P</span>
            </div>
            <p className="text-[11px] leading-relaxed text-text-dim">
              Decentralized peer-to-peer inference for open-source models.
              50-60% cheaper. Community-run compute nodes.
            </p>
          </div>
          <div className="card-glow card">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber" />
              <span className="text-xs font-bold uppercase text-amber">Both</span>
            </div>
            <p className="text-[11px] leading-relaxed text-text-dim">
              Available via both providers. Automatic failover ensures
              maximum uptime for critical workloads.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div
        className={`mt-12 border-t border-border py-8 text-center transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
        style={{ transitionDelay: '700ms' }}
      >
        <p className="mb-4 text-sm text-text-dim">
          All models accessible via OpenAI-compatible API. OMA stakers get up to 15% discount.
        </p>
        <Link
          href="/dashboard"
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm font-mono"
        >
          Get API Key
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}