'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Cpu, Zap, Brain, ArrowRight, Shield, Users } from 'lucide-react'
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

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'budget', label: 'Budget' },
  { key: 'mid', label: 'Mid' },
  { key: 'premium', label: 'Premium' },
  { key: 'frontier', label: 'Frontier' },
  { key: 'coding', label: 'Coding' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'uncensored', label: 'Uncensored' },
]

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  budget: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  mid: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  premium: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  frontier: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

const PROVIDER_STYLES: Record<string, { bg: string; text: string }> = {
  Venice: { bg: 'bg-blue-100', text: 'text-blue-700' },
  AntSeed: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Both: { bg: 'bg-amber-100', text: 'text-amber-700' },
}

function formatPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(3)}`
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
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="group relative rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50"
      style={{ animationDelay: `${delay}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-500">{model.id}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{model.name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${PROVIDER_STYLES[model.provider].bg} ${PROVIDER_STYLES[model.provider].text}`}
          >
            {model.provider}
          </span>
          {model.provider === 'Venice' && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200" title="Zero data retention on Venice-hosted inference">
              <Shield className="h-3 w-3" />
              Privacy
            </span>
          )}
          {model.provider === 'AntSeed' && (
            <span className="flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 border border-cyan-200" title="P2P decentralized inference">
              <Users className="h-3 w-3" />
              P2P
            </span>
          )}
        </div>
      </div>

      <span
        className={`inline-block rounded-lg border px-3 py-1 text-xs font-medium uppercase tracking-wide ${CATEGORY_STYLES[model.category].bg} ${CATEGORY_STYLES[model.category].text} ${CATEGORY_STYLES[model.category].border}`}
      >
        {model.category}
      </span>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4">
        <div>
          <p className="text-xs text-slate-500">Input / 1M tokens</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatPrice(model.input)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Output / 1M tokens</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatPrice(model.output)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <Brain className="h-4 w-4 text-indigo-500" />
        <span>Context: <span className="font-semibold text-slate-900">{model.ctx}</span></span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {model.caps.map((cap) => (
          <span
            key={cap}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600"
          >
            {cap}
          </span>
        ))}
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}

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
      className={`transition-all duration-500 ease-out ${className} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default function ModelsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')

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
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="mb-2 text-sm font-medium text-indigo-600">OMA AI Gateway</div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              AI Models API — Access Multiple LLMs Through One Gateway
            </h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 border border-emerald-200">
              <Shield className="h-4 w-4" />
              Privacy-first
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            {MODELS.length}+ models via OpenAI-compatible API. Privacy-first with Venice-hosted inference. Pay per token, no subscriptions.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={100} className="mt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    activeCategory === cat.key
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 lg:w-72"
              />
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={200} className="mt-6">
          <div className="flex items-center gap-4 rounded-xl bg-white border border-slate-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-indigo-500" />
              <span className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{filtered.length}</span> models
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-indigo-500" />
              <span className="text-sm text-slate-600">Venice AI + AntSeed P2P</span>
            </div>
            {activeCategory !== 'all' && (
              <>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => setActiveCategory('all')}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Clear filter
                </button>
              </>
            )}
          </div>
        </AnimatedSection>

        {filtered.length === 0 ? (
          <AnimatedSection delay={300}>
            <div className="flex flex-col items-center justify-center py-20">
              <Search className="mb-4 h-12 w-12 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">No models match your criteria</p>
              <button
                onClick={() => { setActiveCategory('all'); setSearch('') }}
                className="mt-4 text-sm text-indigo-600 hover:underline"
              >
                Reset filters
              </button>
            </div>
          </AnimatedSection>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((model, i) => (
              <ModelCard key={model.id} model={model} delay={i * 50} />
            ))}
          </div>
        )}

        <AnimatedSection delay={500} className="mt-16">
          <h3 className="mb-6 text-lg font-semibold text-slate-900">Provider Legend</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-3 w-3 rounded-full bg-blue-500" />
                <span className="font-semibold text-slate-900">Venice AI</span>
              </div>
              <p className="text-sm text-slate-600">
                Privacy-first (zero data retention on certain models). Hosted inference for proprietary models (GPT, Claude, Gemini, Mistral). Low-latency, high-availability.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-3 w-3 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-900">AntSeed P2P</span>
              </div>
              <p className="text-sm text-slate-600">
                P2P decentralized inference for open-source models. 50-60% cheaper. Community-run compute nodes.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-3 w-3 rounded-full bg-amber-500" />
                <span className="font-semibold text-slate-900">Both</span>
              </div>
              <p className="text-sm text-slate-600">
                Available via either provider. Automatic failover ensures maximum uptime for critical workloads.
              </p>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={700} className="mt-16 text-center">
          <p className="mb-6 text-slate-600">
            All models accessible via OpenAI-compatible API. OMA stakers get up to 15% discount.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200/50"
          >
            Get API Key
            <ArrowRight className="h-4 w-4" />
          </Link>
        </AnimatedSection>
      </div>
    </div>
  )
}