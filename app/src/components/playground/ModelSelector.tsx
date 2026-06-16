'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search } from 'lucide-react'
import { TierFilter, useLiveModels } from './ChatMessage'

interface ModelSelectorProps {
  model: string
  setModel: (m: string) => void
}

const tierColors: Record<TierFilter, string> = {
  all: 'bg-surface-elevated text-text-muted',
  frontier: 'bg-violet/20 text-violet',
  premium: 'bg-violet/20 text-violet',
  mid: 'bg-accent/10 text-accent',
  budget: 'bg-orange/20 text-orange',
  reasoning: 'bg-warning/20 text-warning',
  coding: 'bg-pink/20 text-pink',
  uncensored: 'bg-error/20 text-error',
}

export function ModelSelector({ model, setModel }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const MODELS = useLiveModels()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    return MODELS.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase())
      const matchesTier = tierFilter === 'all' || m.category === tierFilter
      return matchesSearch && matchesTier
    })
  }, [search, tierFilter, MODELS])

  const selectedModel = MODELS.find(m => m.id === model)

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select AI model"
        className="flex items-center gap-3 px-3 py-2 bg-void border border-border hover:border-border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <span className="text-sm text-text-secondary font-mono">{selectedModel?.name || 'SELECT MODEL'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 mt-1.5 w-80 bg-void border border-border overflow-hidden z-50"
            role="listbox"
            aria-label="Available AI models"
          >
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="SEARCH MODELS..."
                  aria-label="Search models"
                  className="w-full pl-9 pr-3 py-2 bg-void border border-border text-sm text-text-secondary font-mono placeholder-text-muted focus:border-border focus:outline-none"
                />
              </div>
              <div className="flex gap-1 mt-2">
                {(['all', 'frontier', 'premium', 'mid', 'budget'] as TierFilter[]).map(tier => (
                  <button
                    key={tier}
                    onClick={(e) => { e.stopPropagation(); setTierFilter(tier) }}
                    aria-label={`Filter by ${tier} tier`}
                    aria-pressed={tierFilter === tier}
                    className={`px-3 py-2 min-h-[44px] text-[10px] font-mono uppercase tracking-wider transition-all ${tierFilter === tier ? tierColors[tier] : 'bg-surface text-text-muted hover:text-text-secondary'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-void`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted font-mono">NO MODELS FOUND</div>
              ) : (
                filtered.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setOpen(false); setSearch('') }}
                    role="option"
                    aria-selected={m.id === model}
                    aria-label={`${m.name}, ${m.category} tier, ${m.ctx} context`}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-void ${
                      m.id === model
                        ? 'bg-success-dim border border-success/50 text-success'
                        : 'hover:bg-surface text-text-secondary'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-mono">{m.name}</div>
                      <div className="text-[10px] text-text-muted font-mono">{m.ctx} CTX</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] px-1.5 py-0.5 font-mono uppercase ${tierColors[m.category as TierFilter] || 'bg-surface-elevated text-text-muted'}`}>
                        {m.category}
                      </div>
                      <div className="text-[10px] text-text-muted font-mono mt-1">
                        ${m.inputPer1M}/1M IN
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}