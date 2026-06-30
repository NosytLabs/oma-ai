'use client'

/**
 * MODEL SELECTOR REDESIGN — "Terminal Noir" Aesthetic
 * 
 * Key changes:
 * - Glassmorphism dropdown with animated gradient border
 * - Model items have subtle hover glow that matches tier color
 * - Search input has a pulsing accent border when focused
 * - Tier filter pills use filled+outlined states for clear selection
 * - Selected model gets a left accent bar indicator
 * - Smooth spring transitions on open/close
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search } from 'lucide-react'
import { type TierFilter, useLiveModels } from './chat-message-shared'
import { displayName } from '@/lib/model-utils'

interface ModelSelectorProps {
  model: string
  setModel: (m: string) => void
  compact?: boolean
}

// Tier colors — more vivid, with glow variants
const tierStyles: Record<TierFilter, { bg: string; text: string; glow: string; border: string }> = {
  all: { bg: 'bg-surface-elevated', text: 'text-text-muted', glow: 'transparent', border: 'var(--color-border)' },
  frontier: { bg: 'bg-violet/20', text: 'text-violet', glow: 'rgba(167, 139, 250, 0.15)', border: 'var(--color-violet)' },
  premium: { bg: 'bg-violet/20', text: 'text-violet', glow: 'rgba(167, 139, 250, 0.15)', border: 'var(--color-violet)' },
  mid: { bg: 'bg-accent/10', text: 'text-accent', glow: 'var(--color-accent-glow)', border: 'var(--color-accent)' },
  budget: { bg: 'bg-accent/20', text: 'text-accent', glow: 'var(--color-accent-glow)', border: 'var(--color-accent)' },
  reasoning: { bg: 'bg-warning/20', text: 'text-warning', glow: 'rgba(255, 184, 0, 0.15)', border: 'var(--color-warning)' },
  coding: { bg: 'bg-pink/20', text: 'text-pink', glow: 'rgba(236, 72, 153, 0.15)', border: 'var(--color-pink)' },
  uncensored: { bg: 'bg-error/20', text: 'text-error', glow: 'rgba(255, 51, 102, 0.15)', border: 'var(--color-error)' },
}

const dropdownVariants = {
  hidden: { opacity: 0, y: -12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.97,
    transition: { duration: 0.12 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.02, type: 'spring' as const, stiffness: 400, damping: 30 },
  }),
}

export function ModelSelector({ model, setModel, compact = false }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const MODELS = useLiveModels()

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return MODELS.filter(m => {
      const name = displayName(m.id, m.name)
      const matchesSearch = !q || name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      const matchesTier = tierFilter === 'all' || m.category === tierFilter
      return matchesSearch && matchesTier
    })
  }, [search, tierFilter, MODELS])

  const selectedModel = useMemo(() => MODELS.find(m => m.id === model), [model, MODELS])
  const selectedName = selectedModel ? displayName(selectedModel.id, selectedModel.name) : null

  return (
    <div ref={dropdownRef} className="relative">
      {/* ─── TRIGGER BUTTON ─── */}
      <button type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select AI model"
        className={`
          flex items-center gap-3 bg-void border border-border
          hover:border-accent/40 transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-void
          min-w-0 group
          ${compact
            ? 'w-full justify-between px-2 py-1.5'
            : 'px-3 py-2'
          }
        `}
      >
        {/* Animated pulse dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
        <span className="text-sm text-text-secondary font-mono truncate min-w-0 max-w-[12rem]">
          {selectedName || 'SELECT MODEL'}
        </span>
        <ChevronDown
          className={`
            w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200
            ${open ? 'rotate-180' : ''}
          `}
        />
      </button>

      {/* ─── DROPDOWN ─── */}
      <AnimatePresence>
        {open && (
          <m.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={dropdownVariants}
            className="
              glass-strong absolute top-full left-0 mt-1.5 w-80 overflow-hidden z-50
            "
            style={{
              boxShadow: '0 20px 60px -12px rgba(0, 0, 0, 0.5), 0 0 40px -20px var(--color-accent-glow)',
            }}
            role="listbox"
            aria-label="Available AI models"
          >
            {/* ─── Search + Tier Filters ─── */}
            {!compact && (
              <div className="p-2 border-b border-border/50">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="SEARCH MODELS..."
                    aria-label="Search models"
                    className="
                      w-full pl-9 pr-3 py-2 bg-void border border-border
                      text-sm text-text-secondary font-mono placeholder-text-muted
                      focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                      transition-all duration-200
                    "
                  />
                </div>
                {/* Tier filter pills */}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {(['all', 'frontier', 'premium', 'mid', 'budget', 'reasoning', 'coding', 'uncensored'] as TierFilter[]).map(tier => {
                    const isActive = tierFilter === tier
                    const style = tierStyles[tier]
                    return (
                      <button type="button"
                        key={tier}
                        onClick={(e) => { e.stopPropagation(); setTierFilter(tier) }}
                        aria-label={`Filter by ${tier} tier`}
                        aria-pressed={isActive}
                        className={`
                          px-2 py-1.5 min-h-[36px] text-[10px] font-mono uppercase tracking-wider
                          transition-all duration-150
                          ${isActive
                            ? `${style.bg} ${style.text} border`
                            : 'bg-surface/50 text-text-muted hover:text-text-secondary border border-transparent'
                          }
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                          focus-visible:ring-offset-1 focus-visible:ring-offset-void
                        `}
                        style={isActive ? { borderColor: style.border } : undefined}
                      >
                        {tier}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ─── Model List ─── */}
            <div className={`overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent ${compact ? 'max-h-72' : 'max-h-64'}`}>
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted font-mono">NO MODELS FOUND</div>
              ) : (
                filtered.map((modelItem, i) => {
                  const name = displayName(modelItem.id, modelItem.name)
                  const isSelected = modelItem.id === model
                  const tierStyle = tierStyles[modelItem.category as TierFilter] || tierStyles.all
                  return (
                    <m.button
                      key={modelItem.id}
                      custom={i}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      onClick={() => { setModel(modelItem.id); setOpen(false); setSearch(''); setTierFilter('all') }}
                      role="option"
                      aria-selected={isSelected}
                      aria-label={`${name}, ${modelItem.category} tier, ${modelItem.ctx} context`}
                      className={`
                        w-full flex items-center justify-between text-left
                        ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'}
                        transition-all duration-150 relative
                        ${isSelected
                          ? 'bg-accent/10 text-accent'
                          : 'hover:bg-surface/80 text-text-secondary'
                        }
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                        focus-visible:ring-offset-1 focus-visible:ring-offset-void
                      `}
                    >
                      {/* Left accent bar for selected */}
                      {isSelected && (
                        <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-accent" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-mono truncate">{name}</div>
                        <div className="text-[10px] text-text-muted font-mono truncate">
                          {modelItem.ctx} CTX · {modelItem.id}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div
                          className={`
                            text-[10px] px-1.5 py-0.5 font-mono uppercase
                            ${tierStyle.bg} ${tierStyle.text}
                          `}
                        >
                          {modelItem.category}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono mt-1">
                          ${modelItem.inputPer1M.toFixed(2)}/1M IN
                        </div>
                      </div>
                    </m.button>
                  )
                })
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
