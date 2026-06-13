'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search } from 'lucide-react'
import { TierFilter, MODELS } from './ChatMessage'

interface ModelSelectorProps {
  model: string
  setModel: (m: string) => void
}

const tierColors: Record<TierFilter, string> = {
  all: 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]',
  frontier: 'bg-[var(--color-violet)]/20 text-[var(--color-violet)]',
  premium: 'bg-[var(--color-violet)]/20 text-[var(--color-violet)]',
  mid: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  budget: 'bg-[var(--color-green)]/20 text-[var(--color-green)]',
  reasoning: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
  coding: 'bg-[var(--color-pink)]/20 text-[var(--color-pink)]',
  uncensored: 'bg-[var(--color-error)]/20 text-[var(--color-error)]',
}

export function ModelSelector({ model, setModel }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)

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
  }, [search, tierFilter])

  const selectedModel = MODELS.find(m => m.id === model)

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select AI model"
        className="flex items-center gap-3 px-3 py-2 bg-[var(--color-void)] border border-[var(--color-border)] hover:border-[var(--color-border)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-success)]" />
        </span>
        <span className="text-sm text-[var(--color-text-secondary)] font-mono">{selectedModel?.name || 'SELECT MODEL'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 mt-1.5 w-80 bg-[var(--color-void)] border border-[var(--color-border)] overflow-hidden z-50"
            role="listbox"
            aria-label="Available AI models"
          >
            <div className="p-2 border-b border-[var(--color-border)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="SEARCH MODELS..."
                  aria-label="Search models"
                  className="w-full pl-9 pr-3 py-2 bg-[var(--color-void)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] font-mono placeholder-[var(--color-text-muted)] focus:border-[var(--color-border)] focus:outline-none"
                />
              </div>
              <div className="flex gap-1 mt-2">
                {(['all', 'frontier', 'premium', 'mid', 'budget'] as TierFilter[]).map(tier => (
                  <button
                    key={tier}
                    onClick={(e) => { e.stopPropagation(); setTierFilter(tier) }}
                    aria-label={`Filter by ${tier} tier`}
                    aria-pressed={tierFilter === tier}
                    className={`px-3 py-2 min-h-[44px] text-[10px] font-mono uppercase tracking-wider transition-all ${tierFilter === tier ? tierColors[tier] : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-void)]`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--color-text-muted)] font-mono">NO MODELS FOUND</div>
              ) : (
                filtered.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setOpen(false); setSearch('') }}
                    role="option"
                    aria-selected={m.id === model}
                    aria-label={`${m.name}, ${m.category} tier, ${m.ctx} context`}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-void)] ${
                      m.id === model
                        ? 'bg-[var(--color-success-dim)] border border-[var(--color-success)]/50 text-[var(--color-success)]'
                        : 'hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-mono">{m.name}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] font-mono">{m.ctx} CTX</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] px-1.5 py-0.5 font-mono uppercase ${tierColors[m.category as TierFilter] || 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]'}`}>
                        {m.category}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1">
                        ${m.inputPer1M}/1M IN
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}