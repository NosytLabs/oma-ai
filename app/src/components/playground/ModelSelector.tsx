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
  all: 'bg-zinc-700 text-zinc-300',
  frontier: 'bg-purple-500/20 text-purple-400',
  premium: 'bg-violet-500/20 text-violet-400',
  mid: 'bg-cyan-500/20 text-cyan-400',
  budget: 'bg-emerald-500/20 text-emerald-400',
  reasoning: 'bg-amber-500/20 text-amber-400',
  coding: 'bg-pink-500/20 text-pink-400',
  uncensored: 'bg-red-500/20 text-red-400',
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
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
        className="flex items-center gap-3 px-4 py-2.5 bg-surface border border-border rounded-full hover:border-accent transition-all duration-200 group"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
        <span className="font-medium text-text">{selectedModel?.name || 'Select Model'}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-80 bg-panel border border-border rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search models..."
                  className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent"
                />
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {(['all', 'frontier', 'premium', 'mid', 'budget'] as TierFilter[]).map(tier => (
                  <button
                    key={tier}
                    onClick={(e) => { e.stopPropagation(); setTierFilter(tier) }}
                    className={`px-2 py-1 text-xs rounded-full transition-all ${tierFilter === tier ? tierColors[tier] : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-500">No models found</div>
              ) : (
                filtered.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setOpen(false); setSearch('') }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                      m.id === model
                        ? 'bg-accent/10 border border-accent/30 text-accent'
                        : 'hover:bg-surface text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm">{m.name}</div>
                      <div className="text-xs text-zinc-500">{m.ctx} context</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs px-2 py-0.5 rounded-full ${tierColors[m.category as TierFilter] || 'bg-zinc-700 text-zinc-300'}`}>
                        {m.category}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        ${m.inputPer1M}/1M in
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