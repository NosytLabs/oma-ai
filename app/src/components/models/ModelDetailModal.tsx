'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Brain, DollarSign, Terminal, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Model, PROVIDER_COLORS, TIER_COLORS, formatPrice, formatPricePerToken } from '@/lib/prices'

interface ModelDetailModalProps {
  model: Model
  onClose: () => void
}

export function ModelDetailModal({ model, onClose }: ModelDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleEsc)
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      triggerRef.current?.focus()
    }
  }, [onClose])

  const TIER_LABELS = {
    budget: 'Budget',
    mid: 'Mid-Range',
    premium: 'Premium',
    frontier: 'Frontier',
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)]/85 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-[var(--color-panel)] border-b border-[var(--color-border)]">
            <div>
              <h2 id="modal-title" className="text-2xl font-bold text-[var(--color-text-bright)]">{model.name}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{model.id}</p>
            </div>
            <button onClick={onClose} className="model-modal-close" aria-label="Close modal">
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
              <h3 className="text-sm font-medium mb-2 uppercase tracking-wide text-[var(--color-text-muted)]">Description</h3>
              <p className="text-[var(--color-text-secondary)]">{model.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="model-stat-card">
                <p className="text-xs mb-1 text-[var(--color-text-muted)]">Input Price</p>
                <p className="text-2xl font-bold font-mono text-[var(--color-accent)]">{formatPrice(model.inputPricePer1M)}</p>
                <p className="text-xs mt-1 text-[var(--color-text-muted)]">per 1M tokens</p>
              </div>
              <div className="model-stat-card">
                <p className="text-xs mb-1 text-[var(--color-text-muted)]">Output Price</p>
                <p className="text-2xl font-bold font-mono text-[var(--color-text-secondary)]">{formatPrice(model.outputPricePer1M)}</p>
                <p className="text-xs mt-1 text-[var(--color-text-muted)]">per 1M tokens</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3 bg-[var(--color-surface)] p-3 rounded-lg">
                <Brain className="h-5 w-5 text-[var(--color-accent)] opacity-60" />
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Context Window</p>
                  <p className="font-semibold text-[var(--color-text-bright)]">{model.contextLength}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[var(--color-surface)] p-3 rounded-lg">
                <DollarSign className="h-5 w-5 text-[var(--color-accent)] opacity-60" />
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Per Token</p>
                  <p className="font-semibold text-[var(--color-text-bright)]">{formatPricePerToken(model.inputPricePer1M)}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium uppercase tracking-wide mb-3 text-[var(--color-text-muted)]">Capabilities</h3>
              <div className="flex flex-wrap gap-2">
                {model.capabilities.map((cap) => (
                  <span key={cap} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-lg">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium uppercase tracking-wide mb-3 text-[var(--color-text-muted)]">Sample Request</h3>
              <div className="relative">
                <div className="absolute left-4 top-3">
                  <Terminal className="h-5 w-5 text-[var(--color-text-muted)]" />
                </div>
                <pre className="w-full overflow-x-auto font-mono text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 pl-12">
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

            <div className="flex gap-3 pt-4 border-t border-[var(--color-border)]">
              <Link href="/playground" className="btn-primary flex-1 justify-center">
                Use in Playground
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
              <Link href="/dashboard" className="btn-secondary flex-1 justify-center">
                Get API Key
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
