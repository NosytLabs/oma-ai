'use client'

import { useState, useMemo, useEffect, useRef, memo } from 'react'
import { Search, Brain, ArrowRight, Sparkles, X, ChevronDown, Code, Eye, Zap as ZapIcon, Hash, DollarSign, Terminal, Cpu } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Model, Provider, Tier, MODELS, PROVIDER_COLORS, TIER_COLORS, TIER_ORDER, formatPrice, formatPricePerToken, getModelsByTier, Capability } from '@/lib/models-data'

type SortOption = 'price' | 'context' | 'name'

const PROVIDERS: (Provider | 'All')[] = ['All', 'Venice', 'AntSeed']
const TIERS: (Tier | 'All')[] = ['All', 'budget', 'mid', 'premium', 'frontier']

const TIER_LABELS = {
  budget: 'Budget',
  mid: 'Mid-Range',
  premium: 'Premium',
  frontier: 'Frontier',
} as const

const CAPABILITY_ICONS: Record<Capability, React.ReactNode> = {
  reasoning: <Brain className="h-4 w-4" />,
  coding: <Code className="h-4 w-4" />,
  multimodal: <Eye className="h-4 w-4" />,
  vision: <Eye className="h-4 w-4" />,
  fast: <ZapIcon className="h-4 w-4" />,
  uncensored: <Cpu className="h-4 w-4" />,
  agents: <Cpu className="h-4 w-4" />,
  math: <Hash className="h-4 w-4" />,
  chat: <Brain className="h-4 w-4" />,
}

const CAPABILITY_LABELS: Record<Capability, string> = {
  reasoning: 'Reasoning',
  coding: 'Coding',
  multimodal: 'Multimodal',
  vision: 'Vision',
  fast: 'Fast',
  uncensored: 'Uncensored',
  agents: 'Agents',
  math: 'Math',
  chat: 'Chat',
}

function ModelDetailModal({ model, onClose }: { model: Model; onClose: () => void }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm p-6">
            <div>
              <h2 className="text-2xl font-bold text-white">{model.name}</h2>
              <p className="mt-1 text-sm text-zinc-500">{model.id}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${PROVIDER_COLORS[model.provider].bg} ${PROVIDER_COLORS[model.provider].text}`}>
                {model.provider}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${TIER_COLORS[model.tier].badge}`}>
                {TIER_LABELS[model.tier]}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-2">Description</h3>
              <p className="text-zinc-300">{model.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
                <p className="text-xs text-zinc-600 mb-1">Input Price</p>
                <p className="text-2xl font-bold font-mono text-cyan-400">{formatPrice(model.inputPricePer1M)}</p>
                <p className="text-xs text-zinc-600 mt-1">per 1M tokens</p>
              </div>
              <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
                <p className="text-xs text-zinc-600 mb-1">Output Price</p>
                <p className="text-2xl font-bold font-mono text-zinc-300">{formatPrice(model.outputPricePer1M)}</p>
                <p className="text-xs text-zinc-600 mt-1">per 1M tokens</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3 rounded-lg bg-zinc-800/30 p-3">
                <Brain className="h-5 w-5 text-cyan-500/60" />
                <div>
                  <p className="text-xs text-zinc-600">Context Window</p>
                  <p className="font-semibold text-white">{model.contextLength}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-zinc-800/30 p-3">
                <DollarSign className="h-5 w-5 text-cyan-500/60" />
                <div>
                  <p className="text-xs text-zinc-600">Per Token</p>
                  <p className="font-semibold text-white">{formatPricePerToken(model.inputPricePer1M)}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">Capabilities</h3>
              <div className="flex flex-wrap gap-2">
                {model.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/50 px-3 py-1.5 text-sm font-medium text-zinc-400"
                  >
                    {CAPABILITY_ICONS[cap]}
                    {CAPABILITY_LABELS[cap]}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">Sample Request</h3>
              <div className="relative">
                <div className="absolute left-4 top-3">
                  <Terminal className="h-5 w-5 text-zinc-600" />
                </div>
                <pre className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-4 pl-12 text-sm font-mono text-zinc-400 overflow-x-auto">
{`curl https://api.oma.ai/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model.modelId}",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}
                </pre>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-zinc-800">
              <Link
                href="/playground"
                className="btn-primary flex-1 justify-center"
              >
                Use in Playground
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
              <Link
                href="/dashboard"
                className="btn-secondary flex-1 justify-center"
              >
                Get API Key
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

const ModelCard = memo(function ModelCard({
  model,
  delay,
  onSelect,
  isVisible,
}: {
  model: Model
  delay: number
  onSelect: (model: Model) => void
  isVisible: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
      transition={{ duration: 0.4, delay: delay * 0.05 }}
      className="group relative cursor-pointer"
      onClick={() => onSelect(model)}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
      <div className="relative rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-5 transition-all duration-300 hover:border-cyan-500/30 hover:bg-zinc-900/80 hover:-translate-y-0.5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-zinc-600">{model.id}</p>
            <p className="mt-0.5 text-base font-semibold text-white">{model.name}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PROVIDER_COLORS[model.provider].bg} ${PROVIDER_COLORS[model.provider].text}`}>
              {model.provider}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[model.tier].badge}`}>
              {TIER_LABELS[model.tier]}
            </span>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Brain className="h-3.5 w-3.5 text-cyan-500/60" />
            <span className="font-medium text-zinc-300">{model.contextLength}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="font-mono text-cyan-400">{formatPrice(model.inputPricePer1M)}</span>
            <span>/1M in</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="font-mono text-zinc-400">{formatPrice(model.outputPricePer1M)}</span>
            <span>/1M out</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {model.capabilities.slice(0, 4).map((cap) => (
            <span
              key={cap}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-800/50 px-2 py-0.5 text-xs font-medium text-zinc-500 transition-colors group-hover:bg-cyan-500/10 group-hover:text-cyan-400"
            >
              {CAPABILITY_ICONS[cap]}
              {CAPABILITY_LABELS[cap]}
            </span>
          ))}
          {model.capabilities.length > 4 && (
            <span className="inline-flex items-center rounded-md bg-zinc-800/50 px-2 py-0.5 text-xs font-medium text-zinc-500">
              +{model.capabilities.length - 4}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button className="flex-1 rounded-lg bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20">
            Use in Playground
          </button>
          <button className="rounded-lg bg-zinc-800/50 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
})

const FreeModelHeroCard = memo(function FreeModelHeroCard({
  model,
  delay,
  onSelect,
}: {
  model: Model
  delay: number
  onSelect: (model: Model) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      className="group relative cursor-pointer rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-zinc-900/50 p-5 transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10"
      onClick={() => onSelect(model)}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />

      <div className="relative">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TIER_COLORS[model.tier].badge}`}>
              {TIER_LABELS[model.tier]}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Brain className="h-3.5 w-3.5 text-cyan-500/60" />
            <span className="font-medium text-cyan-400">{model.contextLength}</span>
          </div>
        </div>

        <h3 className="text-lg font-bold text-white mb-1">{model.name}</h3>
        <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{model.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {model.capabilities.map((cap) => (
            <span
              key={cap}
              className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-400/80"
            >
              {CAPABILITY_ICONS[cap]}
              {CAPABILITY_LABELS[cap]}
            </span>
          ))}
        </div>

        <Link
          href="/playground"
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-900 transition-all hover:bg-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20"
          onClick={(e) => e.stopPropagation()}
        >
          <Sparkles className="h-4 w-4" />
          Try Free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  )
})

const AnimatedSection = memo(function AnimatedSection({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
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
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  )
})

export default function ModelsPage() {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<Tier | 'All'>('All')
  const [providerFilter, setProviderFilter] = useState<Provider | 'All'>('All')
  const [sortBy, setSortBy] = useState<SortOption>('price')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [isGridVisible, setIsGridVisible] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = gridRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsGridVisible(true)
          observer.unobserve(element)
        }
      },
      { threshold: 0.05 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const sortButton = document.getElementById("sort-dropdown-button")
      const sortDropdown = document.getElementById("sort-dropdown")
      if (sortButton && sortDropdown && !sortButton.contains(e.target as Node) && !sortDropdown.contains(e.target as Node)) {
        setSortDropdownOpen(false)
      }
    }
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    let result = [...MODELS]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          m.capabilities.some((c) => c.toLowerCase().includes(q))
      )
    }

    if (tierFilter !== 'All') {
      result = result.filter((m) => m.tier === tierFilter)
    }

    if (providerFilter !== 'All') {
      result = result.filter((m) => m.provider === providerFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.inputPricePer1M - b.inputPricePer1M
        case 'context':
          return parseInt(b.contextLength) - parseInt(a.contextLength)
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return result
  }, [search, tierFilter, providerFilter, sortBy])

  const modelsByTier = useMemo(() => getModelsByTier(filtered), [filtered])

  const budgetModels = useMemo(() => MODELS.filter((m) => m.tier === 'budget' && m.inputPricePer1M <= 0.02), [])

  const groupedModels = useMemo(() => {
    return TIER_ORDER.map((tier) => ({
      tier,
      label: TIER_LABELS[tier],
      models: modelsByTier[tier],
    })).filter((group) => group.models.length > 0)
  }, [modelsByTier])

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <AnimatedSection className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">{MODELS.length}+ models available</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Every model. One API.
            </h1>
          </div>
          <p className="mt-4 max-w-2xl text-lg text-zinc-500">
            Access {MODELS.length}+ models via OpenAI-compatible API. Starter credits available. Pay per token, no subscriptions.
          </p>
        </AnimatedSection>

        {budgetModels.length > 0 && tierFilter === 'All' && providerFilter === 'All' && !search && (
          <AnimatedSection delay={100}>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-400 border border-amber-500/20">
                  <Sparkles className="h-4 w-4" />
                  Budget Models
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {budgetModels.map((model, i) => (
                  <FreeModelHeroCard
                    key={model.id}
                    model={model}
                    delay={i}
                    onSelect={setSelectedModel}
                  />
                ))}
              </div>
            </div>
          </AnimatedSection>
        )}

        <AnimatedSection delay={200} className="sticky top-0 z-20 mb-6 bg-zinc-950/80 backdrop-blur-md py-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-zinc-800/50 bg-zinc-900/80 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-full border border-zinc-800 bg-zinc-900 py-2.5 pl-11 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 lg:w-64"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-600">Tier:</span>
                <div className="flex flex-wrap gap-1.5">
                  {TIERS.map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setTierFilter(tier)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        tierFilter === tier
                          ? tier === 'All'
                            ? 'bg-cyan-500 text-zinc-900'
                            : TIER_COLORS[tier as Tier].bg + ' ' + TIER_COLORS[tier as Tier].text + ' border ' + TIER_COLORS[tier as Tier].border
                          : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-transparent'
                      }`}
                    >
                      {tier === 'All' ? 'All' : TIER_LABELS[tier as Tier]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-600">Provider:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PROVIDERS.map((provider) => (
                    <button
                      key={provider}
                      onClick={() => setProviderFilter(provider)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        providerFilter === provider
                          ? provider === 'All'
                            ? 'bg-cyan-500 text-zinc-900'
                            : PROVIDER_COLORS[provider as Provider].bg + ' ' + PROVIDER_COLORS[provider as Provider].text + ' border ' + PROVIDER_COLORS[provider as Provider].border
                          : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-transparent'
                      }`}
                    >
                      {provider}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">
                <span className="font-semibold text-cyan-400">{filtered.length}</span> models
              </span>
              <div className="relative">
                <button className="flex items-center gap-1.5 rounded-full bg-zinc-800/50 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                  Sort by
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-30">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl overflow-hidden">
                    {(['price', 'context', 'name'] as SortOption[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSortBy(opt)}
                        className={`block w-full px-4 py-2 text-left text-xs transition-colors ${
                          sortBy === opt ? 'bg-cyan-500/10 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        {opt === 'price' ? 'Price (Low to High)' : opt === 'context' ? 'Context Length' : 'Name (A-Z)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        <div ref={gridRef}>
          {groupedModels.length === 0 ? (
            <AnimatedSection delay={300}>
              <div className="flex flex-col items-center justify-center py-20">
                <Search className="mb-4 h-12 w-12 text-zinc-700" />
                <p className="text-lg font-medium text-zinc-500">No models match your criteria</p>
                <button
                  onClick={() => { setSearch(''); setTierFilter('All'); setProviderFilter('All') }}
                  className="mt-4 text-sm text-cyan-400 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            </AnimatedSection>
          ) : (
            <div className="space-y-10">
              {groupedModels.map((group) => (
                <AnimatedSection key={group.tier} delay={300}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className={`text-lg font-bold ${TIER_COLORS[group.tier].text}`}>
                        {group.label.toUpperCase()} MODELS
                      </h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[group.tier].badge}`}>
                        {group.models.length}
                      </span>
                    </div>
                    
                      <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.models.map((model, i) => (
                      <ModelCard
                        key={model.id}
                        model={model}
                        delay={i}
                        onSelect={setSelectedModel}
                        isVisible={isGridVisible}
                      />
                    ))}
                  </div>
                </AnimatedSection>
              ))}
            </div>
          )}
        </div>

        <AnimatedSection delay={500} className="mt-16">
          <h3 className="mb-6 text-lg font-semibold text-white">Provider Legend</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {([
              { name: 'Venice', color: 'purple', desc: 'Privacy-first AI with zero data retention. Great for sensitive applications.' },
              { name: 'Together AI', color: 'orange', desc: 'Open AI optimized for inference. Strong selection of open-weight models.' },
              { name: 'DeepInfra', color: 'green', desc: 'Budget-friendly inference for open models. Great value for cost-effective workloads.' },
            ] as const).map((provider) => {
              const colorMap: Record<string, string> = {
                purple: 'bg-purple-500',
                orange: 'bg-orange-500',
                green: 'bg-green-500',
              };
              return (
              <div key={provider.name} className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className={`flex h-3 w-3 rounded-full ${colorMap[provider.color] || 'bg-purple-500'}`} style={{}} />
                  <span className="font-semibold text-white">{provider.name}</span>
                </div>
                <p className="text-sm text-zinc-500">{provider.desc}</p>
              </div>
              );
            })}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={700} className="mt-16 text-center">
          <p className="mb-6 text-zinc-500">
            All models accessible via OpenAI-compatible API. OMA stakers get up to 15% discount.
          </p>
          <Link href="/dashboard" className="btn-primary text-lg px-8 py-4">
            Get API Key
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </AnimatedSection>
      </div>

      <AnimatePresence>
        {selectedModel && (
          <ModelDetailModal model={selectedModel} onClose={() => setSelectedModel(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}