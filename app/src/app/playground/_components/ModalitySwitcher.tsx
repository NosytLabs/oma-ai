'use client'

import { motion } from 'framer-motion'
import { MessageSquare, Image as ImageIcon, Film } from 'lucide-react'

export type Modality = 'chat' | 'image' | 'video'

const MODALITIES: { id: Modality; label: string; icon: typeof MessageSquare; shortcut: string; description: string }[] = [
  { id: 'chat', label: 'CHAT', icon: MessageSquare, shortcut: '1', description: 'text generation' },
  { id: 'image', label: 'IMAGE', icon: ImageIcon, shortcut: '2', description: 'image synthesis' },
  { id: 'video', label: 'VIDEO', icon: Film, shortcut: '3', description: 'video synthesis' },
]

interface ModalitySwitcherProps {
  modality: Modality
  setModality: (m: Modality) => void
}

export function ModalitySwitcher({ modality, setModality }: ModalitySwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Generation modality"
      className="relative flex items-center bg-[var(--color-void)] border border-[var(--color-border)] rounded-sm overflow-hidden"
    >
      {MODALITIES.map(({ id, label, icon: Icon, shortcut, description }) => {
        const active = modality === id
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => setModality(id)}
            className={`group relative flex items-center gap-2 px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-widest transition-colors border-r border-[var(--color-border)] last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-void)] ${
              active
                ? 'text-[var(--color-success)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]/60'
            }`}
          >
            {active && (
              <motion.span
                layoutId="modality-pill"
                aria-hidden="true"
                className="absolute inset-0 bg-[var(--color-surface)] border-b-2 border-b-[var(--color-success)]"
                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="hidden md:inline text-[9px] text-[var(--color-text-tertiary)] normal-case tracking-normal group-hover:text-[var(--color-text-muted)]">
                {description}
              </span>
              <kbd className={`hidden lg:inline text-[9px] px-1 py-0.5 font-mono border rounded-sm ${
                active
                  ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/30'
                  : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] border-[var(--color-border)]'
              }`}>
                ⌘{shortcut}
              </kbd>
            </span>
          </button>
        )
      })}
    </div>
  )
}
