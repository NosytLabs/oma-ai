'use client'

import { m } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { scaleInSafe } from '@/lib/motion'
import { formatPrice } from '@/lib/prices'

export type ModelLogo = 'llama' | 'deepseek' | 'venice'

const MONOGRAM: Record<ModelLogo, string> = {
  llama: 'L',
  deepseek: 'DS',
  venice: 'V',
}

export function ModelCard({
  model,
  rank,
}: {
  model: {
    id: string
    provider: string
    ctx: string
    logo: ModelLogo
    inputPricePer1M: number
    outputPricePer1M: number
  }
  rank: number
}) {
  return (
    <m.div
      variants={scaleInSafe}
      className="h-full"
    >
      <Link
        href="/models"
        className="tilt-card card-hover-lift group relative block rounded-xl border border-border bg-panel/40 p-4 pb-7 hover:border-accent/40 hover:bg-panel/80 hover:glow-accent-sm transition-all h-full focus-ring"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-void text-[10px] font-mono text-accent">
              {MONOGRAM[model.logo]}
            </span>
            <m.span
              className="text-[10px] text-text-tertiary font-mono tabular-nums"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: rank * 0.2 }}
            >
              #{String(rank + 1).padStart(2, '0')}
            </m.span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            {model.ctx}
          </span>
        </div>
        <p className="text-sm font-mono text-text-bright truncate mb-1" title={model.id}>
          {model.id}
        </p>
        <p className="text-[11px] text-text-tertiary mb-3 truncate">
          {model.provider}
        </p>
        <div className="flex items-baseline gap-1.5 text-[11px] font-mono">
          <span className="text-accent tabular-nums">
            {formatPrice(model.inputPricePer1M)}
          </span>
          <span className="text-text-tertiary">/</span>
          <span className="text-accent tabular-nums">
            {formatPrice(model.outputPricePer1M)}
          </span>
          <span className="text-text-tertiary ml-auto">per 1M</span>
        </div>
        <span className="pointer-events-none absolute right-4 bottom-2 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-text-tertiary opacity-0 group-hover:opacity-100 group-hover:text-accent transition-all">
          details
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </span>
      </Link>
    </m.div>
  )
}
