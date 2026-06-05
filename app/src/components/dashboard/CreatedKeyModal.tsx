'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Key, Copy, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { ApiKeyWithSecret } from '@/lib/api'

interface CreatedKeyModalProps {
  createdKey: ApiKeyWithSecret | null
  copied: string | null
  onCopy: (text: string, id: string) => void
  onDismiss: () => void
}

export function CreatedKeyModal({ createdKey, copied, onCopy, onDismiss }: CreatedKeyModalProps) {
  const [revealed, setRevealed] = useState(false)
  const [autoHideTimer, setAutoHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (revealed) {
      const timer = setTimeout(() => {
        setRevealed(false)
      }, 10000)
      setAutoHideTimer(timer)
      return () => {
        if (timer) clearTimeout(timer)
      }
    }
  }, [revealed])

  const handleReveal = () => {
    if (autoHideTimer) clearTimeout(autoHideTimer)
    setRevealed(!revealed)
  }

  if (!createdKey) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]/80 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-lg border border-[var(--color-accent)]/20 bg-[var(--color-void)] p-6"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border border-[var(--color-accent)]/20 bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text-bright)]">KEY_CREATED</h3>
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">Copy now - not shown again</p>
            </div>
          </div>

          <div id="key-warning" className="mb-4 flex items-center gap-2 border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-warning)]" />
            <span className="text-sm text-[var(--color-warning)]">This key will only be shown once. Copy it now.</span>
          </div>

          {!revealed ? (
            <div className="mb-4 flex items-center gap-2 border border-[var(--color-border)] bg-[var(--color-void)] p-4">
              <code className="flex-1 break-all text-sm text-[var(--color-text-muted)] font-mono">{'*'.repeat(32)}</code>
              <button
                onClick={handleReveal}
                className="shrink-0 flex items-center justify-center w-10 h-10 border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] focus-visible:border-[var(--color-accent)] focus-visible:text-[var(--color-accent)]"
                aria-label="Reveal API key"
              >
                <Eye className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2 border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-warning)]" />
                <span className="text-xs text-[var(--color-warning)]">Key visible. Auto-hides in 10 seconds.</span>
              </div>
              <div className="mb-4 flex items-center gap-2 border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] p-4">
                <code className="flex-1 break-all text-sm text-[var(--color-accent)] font-mono">{createdKey.key}</code>
                <button
                  onClick={() => onCopy(createdKey.key, `full-${createdKey.id}`)}
                  aria-label="Copy full API key"
                  className="shrink-0 flex items-center justify-center w-10 h-10 border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] focus-visible:border-[var(--color-accent)] focus-visible:text-[var(--color-accent)]"
                >
                  {copied === `full-${createdKey.id}` ? <Check className="h-5 w-5 text-[var(--color-accent)]" /> : <Copy className="h-5 w-5" />}
                </button>
                <button
                  onClick={handleReveal}
                  className="shrink-0 flex items-center justify-center w-10 h-10 border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-error)] hover:text-[var(--color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] focus-visible:border-[var(--color-error)] focus-visible:text-[var(--color-error)]"
                  aria-label="Hide API key"
                >
                  <EyeOff className="h-5 w-5" />
                </button>
              </div>
            </>
          )}

          <button
            onClick={onDismiss}
            aria-describedby="key-warning"
            className="w-full border border-[var(--color-accent)] bg-[var(--color-accent-dim)] py-3 text-sm uppercase tracking-widest text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] active:translate-y-[1px]"
          >
            I HAVE COPIED THIS KEY
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}