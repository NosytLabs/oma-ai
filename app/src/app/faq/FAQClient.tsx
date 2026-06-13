'use client'

import { useState } from 'react'
import {
  ChevronDown,
  HelpCircle,
  Coins,
  Cpu,
  Zap,
  KeyRound,
  Shield,
  Receipt,
  RefreshCw,
  Lock,
  FileText,
  Layers,
  TrendingDown,
  Sliders,
  AlertTriangle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  HelpCircle,
  Coins,
  Cpu,
  Zap,
  KeyRound,
  Shield,
  Receipt,
  RefreshCw,
  Lock,
  FileText,
  Layers,
  TrendingDown,
  Sliders,
  AlertTriangle,
}

export type FAQGroup = {
  idx: string
  name: string
  items: { q: string; a: string; iconName: string }[]
}

function AccordionItem({
  item,
  isOpen,
  onToggle,
  index,
}: {
  item: FAQGroup['items'][number]
  isOpen: boolean
  onToggle: () => void
  index: number
}) {
  const buttonId = `faq-button-${index}`
  const panelId = `faq-panel-${index}`
  const Icon = ICON_MAP[item.iconName] ?? HelpCircle
  return (
    <div className="border-b border-[var(--color-border)]">
      <button
        id={buttonId}
        onClick={onToggle}
        type="button"
        className="flex w-full items-center justify-between gap-4 py-4 sm:py-5 text-left transition-colors hover:text-[var(--color-text-bright)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="flex h-7 w-7 sm:h-8 sm:w-7 shrink-0 items-center justify-center border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
            <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" aria-hidden={true} />
          </span>
          <span className="font-medium text-[var(--color-text-bright)] text-[13.5px] sm:text-sm truncate">
            {item.q}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[600px] pb-5' : 'max-h-0'}`}
      >
        <div className="pl-10 sm:pl-11 pr-2 text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
          {item.a}
        </div>
      </div>
    </div>
  )
}

export function FAQClient({ groups }: { groups: FAQGroup[] }) {
  // Default: open the first item in each group for scannability
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    groups.forEach((g) => {
      init[`${g.idx}-0`] = true
    })
    return init
  })

  const toggle = (key: string) => {
    setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <>
      {groups.map((g) => (
        <section
          key={g.idx}
          id={`group-${g.idx}`}
          aria-labelledby={`group-${g.idx}-heading`}
          className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
        >
          <header className="mb-5 sm:mb-7 flex items-baseline gap-3 flex-wrap">
            <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
              § {g.idx}
            </span>
            <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold tracking-tight">
              {g.name}
            </h2>
            <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
              {g.items.length} question{g.items.length === 1 ? '' : 's'}
            </span>
          </header>
          <h2 id={`group-${g.idx}-heading`} className="sr-only">
            {g.name}
          </h2>

          <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
            {g.items.map((item, i) => {
              const key = `${g.idx}-${i}`
              return (
                <AccordionItem
                  key={key}
                  item={item}
                  index={i}
                  isOpen={!!openMap[key]}
                  onToggle={() => toggle(key)}
                />
              )
            })}
            <div className="px-3 sm:px-4 py-2 text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-2 flex-wrap">
              <span>group §{g.idx}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span>{g.name.toLowerCase()}</span>
            </div>
          </div>
        </section>
      ))}
    </>
  )
}
