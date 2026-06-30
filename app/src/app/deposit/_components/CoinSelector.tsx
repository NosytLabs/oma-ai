'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, Coins, Lock } from 'lucide-react'

import { CryptoLogo } from '@/components/ui/CryptoLogo'
import { POPULAR_COINS, SWAP_COINS, type CoinOption } from '../_constants'

export function CoinSelector({
  selected,
  onSelect,
}: {
  selected: CoinOption | null
  onSelect: (c: CoinOption) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allCoins = [
    ...POPULAR_COINS,
    ...SWAP_COINS.filter(c => !POPULAR_COINS.some(p => p.symbol === c.symbol)),
  ]

  const filteredCoins = allCoins.filter(coin =>
    coin.symbol.toLowerCase().includes(search.toLowerCase()) ||
    coin.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <label htmlFor={id} className="mb-2 block text-xs font-medium tracking-wider text-text-secondary font-mono uppercase">
        Select Asset
      </label>
      <m.button
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 rounded-lg border border-border-bright bg-surface px-4 py-4 text-left
          hover:bg-surface-elevated hover:border-accent/40
          focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30
          transition-colors duration-150"
        whileHover={{ scale: 1 }}
        whileTap={{ scale: 0.99 }}
      >
        {selected ? (
          <>
            <CryptoLogo symbol={selected.symbol} size={32} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-bright">{selected.symbol}</span>
                {selected.isPopular && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold text-accent bg-accent/10 border border-accent/20">
                    POPULAR
                  </span>
                )}
              </div>
              <div className="text-xs text-text-secondary">{selected.name} — {selected.network}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center gap-2 text-text-secondary">
            <Coins className="h-5 w-5" />
            <span>Choose cryptocurrency</span>
          </div>
        )}
        <ChevronDown className={`h-5 w-5 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </m.button>

      <AnimatePresence>
        {isOpen && (
          <m.div
            className="absolute z-50 mt-2 w-full rounded-lg border border-border-bright bg-panel shadow-xl glass"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <label htmlFor={`${id}-search`} className="sr-only">Search coins</label>
                <input
                  id={`${id}-search`}
                  type="text"
                  placeholder="Search coins..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded bg-surface border border-border text-sm
                    text-text placeholder:text-text-muted
                    focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filteredCoins.map((coin) => (
                <m.button
                  key={coin.id}
                  onClick={() => { onSelect(coin); setIsOpen(false); setSearch('') }}
                  className={`w-full flex items-center gap-3 px-4 py-3
                    hover:bg-surface-elevated hover:text-text-bright
                    focus:bg-surface-elevated focus:text-text-bright
                    focus:outline-none
                    ${selected?.id === coin.id ? 'bg-surface-elevated border-l-2 border-accent' : 'border-l-2 border-transparent'}`}
                  whileHover={{ x: 2 }}
                >
                  <CryptoLogo symbol={coin.symbol} size={28} />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{coin.symbol}</span>
                      {coin.isPrivacy && <Lock className="h-3 w-3 text-pink" />}
                    </div>
                    <div className="text-xs text-text-secondary">{coin.name}</div>
                  </div>
                </m.button>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
