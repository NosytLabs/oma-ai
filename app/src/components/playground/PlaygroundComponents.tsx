'use client'

import type { Message } from './index'
import { MODELS } from '@/lib/models-data'

export const btnBase = "relative inline-flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-all border rounded-full " +
  "bg-[var(--color-void)] border-[var(--color-border)] text-[var(--color-text-muted)] " +
  "hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] hover:brightness-125 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-success)]/50 focus-visible:-outline-offset-1 focus-visible:bg-[var(--color-surface)] " +
  "active:translate-y-[1px] " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-void)] disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-text-muted)] disabled:active:translate-y-0 " +
  "data-[state=loading]:text-transparent data-[state=loading]:pointer-events-none " +
  "data-[state=error]:border-[var(--color-pink)]/30 data-[state=error]:text-[var(--color-pink)] data-[state=error]:bg-[var(--color-pink)]/10 " +
  "data-[state=success]:border-[var(--color-success)]/30 data-[state=success]:text-[var(--color-success)] data-[state=success]:bg-[var(--color-success)]/10"

interface StatsBarProps {
  messages: Message[]
  model?: string
}

function getModelPricing(modelId: string): { inputPer1M: number; outputPer1M: number } {
  const model = MODELS.find(m => m.id === modelId || m.modelId === modelId)
  if (model) {
    return {
      inputPer1M: model.inputPricePer1M,
      outputPer1M: model.outputPricePer1M,
    }
  }
  return { inputPer1M: 0.15, outputPer1M: 0.60 }
}

export function StatsBar({ messages, model = 'deepseek-v4-pro' }: StatsBarProps) {
  const { inputPer1M, outputPer1M } = getModelPricing(model)
  const totalTokens = messages.reduce((acc, m) => acc + (m.tokens || 0), 0)
  const totalCost = messages.reduce((acc, m) => {
    if (m.inputTokens && m.outputTokens) {
      const inputCost = (m.inputTokens / 1_000_000) * inputPer1M
      const outputCost = (m.outputTokens / 1_000_000) * outputPer1M
      return acc + inputCost + outputCost
    }
    return acc
  }, 0)

  if (messages.length === 0) return null

  return (
    <div className="flex items-center gap-4 text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
      <span>MSG:{messages.filter(m => m.role === 'user').length.toString().padStart(2, '0')}</span>
      {totalTokens > 0 && (
        <>
          <span>TOK:{totalTokens.toString().padStart(4, '0')}</span>
          <span className="text-[var(--color-success)]">CST:${totalCost.toFixed(4)}</span>
        </>
      )}
    </div>
  )
}

export function MobileStatsBar({ messages, model = 'deepseek-v4-pro' }: StatsBarProps) {
  const { inputPer1M, outputPer1M } = getModelPricing(model)
  const totalTokens = messages.reduce((acc, m) => acc + (m.tokens || 0), 0)
  const totalCost = messages.reduce((acc, m) => {
    if (m.inputTokens && m.outputTokens) {
      const inputCost = (m.inputTokens / 1_000_000) * inputPer1M
      const outputCost = (m.outputTokens / 1_000_000) * outputPer1M
      return acc + inputCost + outputCost
    }
    return acc
  }, 0)

  if (messages.length === 0) return null

  const msgCount = messages.filter(m => m.role === 'user').length

  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
      <span className="bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
        {msgCount}{msgCount === 1 ? ' msg' : ' msgs'}
      </span>
      {totalTokens > 0 && (
        <>
          <span className="bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
            {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens} tok
          </span>
          <span className="bg-[var(--color-success-dim)] text-[var(--color-success)] px-1.5 py-0.5 rounded border border-[var(--color-success)]/30">
            ${totalCost.toFixed(4)}
          </span>
        </>
      )}
    </div>
  )
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
