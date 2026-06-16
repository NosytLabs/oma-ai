'use client'

import { useState, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { X, Sparkles, MessageSquare, Send, Coins, ArrowRight } from 'lucide-react'

const STORAGE_KEY = 'oma-pg-welcome-dismissed'

interface WelcomeBannerProps {
  onSelectExample: () => void
  onGetStarted: () => void
}

const STEPS = [
  { id: 1, label: 'Pick a model', icon: Sparkles },
  { id: 2, label: 'Type a prompt', icon: MessageSquare },
  { id: 3, label: 'Hit Enter', icon: Send },
  { id: 4, label: 'See cost', icon: Coins },
] as const

export function WelcomeBanner({ onSelectExample, onGetStarted }: WelcomeBannerProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      const wasDismissed = localStorage.getItem(STORAGE_KEY) === '1'
      setDismissed(wasDismissed)
      if (!wasDismissed) setVisible(true)
    } catch {}
  }, [])

  const handleDismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setDismissed(true)
    setVisible(false)
  }

  const handleGetStarted = () => {
    handleDismiss()
    onGetStarted()
  }

  const handleViewExamples = () => {
    handleDismiss()
    onSelectExample()
  }

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <m.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          role="region"
          aria-label="Welcome to OMA Playground"
          className="flex-none border-b border-border bg-surface/50"
        >
          <div className="max-w-4xl mx-auto px-4 md:px-8 py-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-mono font-bold text-text uppercase tracking-widest">
                  {'>'} WELCOME TO OMA PLAYGROUND
                </h2>
                <p className="text-xs text-text-muted font-mono mt-1">
                  {/* QUERY THE GATEWAY · FOUR STEPS TO YOUR FIRST RESPONSE */}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                aria-label="Dismiss welcome banner"
                className="p-1 text-text-muted hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {STEPS.map((step) => {
                const Icon = step.icon
                return (
                  <li
                    key={step.id}
                    className="flex items-center gap-2 px-3 py-2 border border-border bg-void"
                  >
                    <span className="flex items-center justify-center w-6 h-6 border border-success/30 text-success text-[10px] font-mono font-bold shrink-0">
                      {step.id}
                    </span>
                    <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="text-xs font-mono text-text-secondary truncate">
                      {step.label}
                    </span>
                  </li>
                )
              })}
            </ol>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleGetStarted}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-text-inverse text-[11px] font-mono font-bold uppercase tracking-widest hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                GET STARTED
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={handleViewExamples}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-[11px] font-mono font-bold uppercase tracking-widest hover:bg-surface hover:border-success/30 hover:text-success transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                VIEW EXAMPLES
              </button>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
