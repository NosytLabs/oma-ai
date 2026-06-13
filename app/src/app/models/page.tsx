'use client'

import dynamic from 'next/dynamic'
import { useState, useMemo, useEffect, memo, Suspense } from 'react'
import { Search, Brain, ArrowRight, Sparkles, ChevronDown, Code, Eye, Zap as ZapIcon, Hash, Cpu, SlidersHorizontal, XCircle } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/Skeleton'
import { Model, Provider, Tier, MODELS, PROVIDER_COLORS, TIER_COLORS, TIER_ORDER, formatPrice, getModelsByTier, Capability } from '@/lib/prices'

const LazyModelDetailModal = dynamic(
  () => import('@/components/models/ModelDetailModal').then(mod => mod.ModelDetailModal),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl h-[90vh] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }
)

type SortOption = 'price' | 'context' | 'name'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'price', label: 'Price (Low to High)' },
  { value: 'context', label: 'Context Length' },
  { value: 'name', label: 'Name (A-Z)' },
]

const TIERS: (Tier | 'All')[] = ['All', 'budget', 'mid', 'premium', 'frontier']
const PROVIDERS: (Provider | 'All')[] = ['All', 'Venice', 'AntSeed']

const TIER_LABELS: Record<Tier, string> = {
  budget: 'Budget',
  mid: 'Mid-Range',
  premium: 'Premium',
  frontier: 'Frontier',
}

const ICON_PROPS = { strokeWidth: 1.5 } as const

const CAPABILITY_ICONS: Record<Capability, React.ReactNode> = {
  reasoning: <Brain className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  coding: <Code className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  multimodal: <Eye className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  vision: <Eye className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  fast: <ZapIcon className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  uncensored: <Cpu className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  agents: <Cpu className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  math: <Hash className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
  chat: <Brain className="h-3.5 w-3.5" aria-hidden="true" {...ICON_PROPS} />,
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



interface ModelCardProps {
  model: Model
  onSelect: (model: Model) => void
}

const ModelCard = memo(function ModelCard({ model, onSelect }: ModelCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="model-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{ transform: `scale(${isPressed ? '0.98' : '1'})` }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate font-mono" style={{ color: 'var(--color-text-muted)' }}>{model.id}</p>
          <p className="mt-0.5 text-base font-semibold" style={{ color: 'var(--color-text-bright)' }}>{model.name}</p>
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

      <div className="mb-3 flex items-center gap-4 text-xs min-h-[44px]" style={{ color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1">
          <Brain className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
          <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{model.contextLength}</span>
        </span>
        <span className="flex items-center gap-1 font-mono" style={{ color: 'var(--color-accent)' }}>
          {formatPrice(model.inputPricePer1M)}
          <span style={{ color: 'var(--color-text-muted)' }}>/1M in</span>
        </span>
        <span className="flex items-center gap-1 font-mono" style={{ color: 'var(--color-text-muted)' }}>
          {formatPrice(model.outputPricePer1M)}
          <span style={{ color: 'var(--color-text-muted)' }}>/1M out</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {model.capabilities.slice(0, 4).map((cap) => (
          <span
            key={cap}
            className="capability-chip"
            style={{
              backgroundColor: isHovered ? 'var(--color-accent-dim)' : 'var(--color-surface)',
              color: isHovered ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            {CAPABILITY_ICONS[cap]}
            {CAPABILITY_LABELS[cap]}
          </span>
        ))}
        {model.capabilities.length > 4 && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)', borderRadius: '6px' }}>
            +{model.capabilities.length - 4}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/playground?model=${encodeURIComponent(model.id)}`}
          className="model-card-cta"
          style={{ flex: 1 }}
          aria-label={`Use ${model.name} in Playground`}
          onClick={() => onSelect(model)}
        >
          Use in Playground
        </Link>
        <span className="model-card-arrow" aria-hidden="true">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </motion.article>
  )
})

const FreeModelHeroCard = memo(function FreeModelHeroCard({ model, onSelect }: Omit<ModelCardProps, 'onSelect'> & { onSelect: (model: Model) => void }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="free-model-card"
    >
      <div className="mb-3 flex items-start justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TIER_COLORS[model.tier].badge}`}>
          {TIER_LABELS[model.tier]}
        </span>
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <Brain className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
          <span className="font-medium" style={{ color: 'var(--color-accent)' }}>{model.contextLength}</span>
        </div>
      </div>

      <h3 className="text-lg font-bold mb-1 font-syne" style={{ color: 'var(--color-text-bright)' }}>{model.name}</h3>
      <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--color-text-muted)' }}>{model.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {model.capabilities.map((cap) => (
          <span key={cap} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}>
            {CAPABILITY_ICONS[cap]}
            {CAPABILITY_LABELS[cap]}
          </span>
        ))}
      </div>

      <Link
        href="/playground"
        className="free-model-cta"
        aria-label={`Try ${model.name} free`}
        onClick={() => onSelect(model)}
      >
        <Sparkles className="h-4 w-4" />
        Try Free
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.article>
  )
})

interface FilterBarProps {
  search: string
  setSearch: (v: string) => void
  tierFilter: Tier | 'All'
  setTierFilter: (v: Tier | 'All') => void
  providerFilter: Provider | 'All'
  setProviderFilter: (v: Provider | 'All') => void
  filteredCount: number
  sortBy: SortOption
  setSortBy: (v: SortOption) => void
  sortDropdownOpen: boolean
  setSortDropdownOpen: (v: boolean) => void
}

const FilterBar = memo(function FilterBar({
  search,
  setSearch,
  tierFilter,
  setTierFilter,
  providerFilter,
  setProviderFilter,
  filteredCount,
  sortBy,
  setSortBy,
  sortDropdownOpen,
  setSortDropdownOpen,
}: FilterBarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const filterContent = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-xl" style={{ backgroundColor: 'var(--color-panel)', border: '1px solid var(--color-border)', padding: '16px' }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="model-search-input"
            aria-label="Search models"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Tier:</span>
          <div className="flex flex-wrap gap-1.5">
            {TIERS.map((tier) => (
              <button key={tier} onClick={() => setTierFilter(tier)} className="filter-pill" aria-pressed={tierFilter === tier}>
                {tier === 'All' ? 'All' : TIER_LABELS[tier as Tier]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Provider:</span>
          <div className="flex flex-wrap gap-1.5">
            {PROVIDERS.map((provider) => (
              <button key={provider} onClick={() => setProviderFilter(provider)} className="filter-pill" aria-pressed={providerFilter === provider}>
                {provider}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{filteredCount}</span> models
        </span>
        <div className="relative">
          <button
            id="sort-dropdown-button"
            className="sort-dropdown-trigger"
            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSortDropdownOpen(false)
              }
            }}
            aria-haspopup="listbox"
            aria-expanded={sortDropdownOpen}
            tabIndex={0}
          >
            Sort by
            <ChevronDown className="h-3.5 w-3.5" style={{ transform: sortDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
          </button>
          {sortDropdownOpen && (
            <div 
              id="sort-dropdown" 
              className="sort-dropdown-menu" 
              role="listbox" 
              aria-label="Sort options"
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setSortDropdownOpen(false) }}
                  className="sort-option"
                  role="option"
                  aria-selected={sortBy === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="sticky top-0 z-20 mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ backgroundColor: 'var(--color-void)', backdropFilter: 'blur(12px)', paddingTop: '16px', paddingBottom: '16px' }}>
      <div className="hidden lg:block">{filterContent}</div>
      <div className="lg:hidden">
        <div className="flex items-center justify-between mb-4">
          <button className="mobile-filter-toggle" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)} aria-expanded={mobileFiltersOpen}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {mobileFiltersOpen ? <XCircle className="h-4 w-4" /> : null}
          </button>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{filteredCount}</span> models
          </span>
        </div>
        {mobileFiltersOpen && (
          <div className="overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--color-panel)', border: '1px solid var(--color-border)' }}>
            <div className="p-4 flex flex-col gap-4">{filterContent}</div>
          </div>
        )}
      </div>
    </div>
  )
})

const NoResults = ({ onReset }: { onReset: () => void }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <Search className="mb-4 h-12 w-12" style={{ color: 'var(--color-border-bright)' }} />
    <p className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>No models match your criteria</p>
    <button onClick={onReset} aria-label="Reset filters" className="text-sm" style={{ color: 'var(--color-accent)' }}>
      Reset filters
    </button>
  </div>
)

export default function ModelsPage() {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<Tier | 'All'>('All')
  const [providerFilter, setProviderFilter] = useState<Provider | 'All'>('All')
  const [sortBy, setSortBy] = useState<SortOption>('price')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)

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

  const handleReset = () => {
    setSearch('')
    setTierFilter('All')
    setProviderFilter('All')
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-void)' }}>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.header className="mb-8" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: 'var(--color-accent-dim)', border: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-accent)' }}>{MODELS.length}+ models available</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight lg:text-5xl font-syne" style={{ color: 'var(--color-text-bright)' }}>
            Every model. One API.
          </h1>
          <p className="mt-4 max-w-2xl text-lg" style={{ color: 'var(--color-text-secondary)' }}>
            Access {MODELS.length}+ models via OpenAI-compatible API. Starter credits available. Pay per token, no subscriptions.
          </p>
        </motion.header>

        {budgetModels.length > 0 && tierFilter === 'All' && providerFilter === 'All' && !search && (
          <motion.section className="mb-8" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: 'var(--color-secondary-dim)', color: 'var(--color-secondary)', border: '1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent)' }}>
                <Sparkles className="h-4 w-4" />
                Budget Models
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {budgetModels.map((model) => (
                <FreeModelHeroCard key={model.id} model={model} onSelect={setSelectedModel} />
              ))}
            </div>
          </motion.section>
        )}

        <FilterBar
          search={search}
          setSearch={setSearch}
          tierFilter={tierFilter}
          setTierFilter={setTierFilter}
          providerFilter={providerFilter}
          setProviderFilter={setProviderFilter}
          filteredCount={filtered.length}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortDropdownOpen={sortDropdownOpen}
          setSortDropdownOpen={setSortDropdownOpen}
        />

        {groupedModels.length === 0 ? (
          <NoResults onReset={handleReset} />
        ) : (
          <div className="space-y-10">
            {groupedModels.map((group) => (
              <motion.section key={group.tier} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <div className="mb-4 flex items-center gap-3">
                  <h2 className={`text-lg font-bold font-syne ${TIER_COLORS[group.tier].text}`}>
                    {group.label}
                  </h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[group.tier].badge}`}>
                    {group.models.length}
                  </span>
                  <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--color-border) 0%, transparent 100%)' }} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.models.map((model) => (
                    <ModelCard key={model.id} model={model} onSelect={setSelectedModel} />
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        )}

        <motion.section className="mt-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <h3 className="mb-6 text-lg font-semibold font-syne" style={{ color: 'var(--color-text-bright)' }}>Provider Legend</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {([
              { name: 'Venice', accent: 'var(--color-accent)', desc: 'Privacy-first AI with zero data retention. Great for sensitive applications.' },
              { name: 'AntSeed', accent: 'var(--color-success)', desc: 'Budget-friendly inference for open models. Great value for cost-effective workloads.' },
            ] as const).map((provider) => (
              <div key={provider.name} className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-panel)', border: '1px solid var(--color-border)' }}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: provider.accent }} />
                  <span className="font-semibold" style={{ color: 'var(--color-text-bright)' }}>{provider.name}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{provider.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        </div>

      <AnimatePresence>
        {selectedModel && (
          <Suspense fallback={null}>
            <LazyModelDetailModal model={selectedModel} onClose={() => setSelectedModel(null)} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  )
}