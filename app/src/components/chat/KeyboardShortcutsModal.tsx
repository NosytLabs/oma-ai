'use client'

import { m, AnimatePresence } from 'framer-motion'
import { X, Keyboard, Command } from 'lucide-react'

export interface Shortcut {
  keys: string[]
  description: string
}

export const SHORTCUTS: Shortcut[] = [
  { keys: ['Cmd', 'K'], description: 'Open model picker' },
  { keys: ['Cmd', '/'], description: 'Toggle settings panel' },
  { keys: ['Cmd', 'Enter'], description: 'Send message' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Shift', 'Enter'], description: 'New line in input' },
  { keys: ['Esc'], description: 'Close modals' },
]

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 border border-border bg-surface text-text-secondary text-[11px] font-mono font-bold uppercase">
      {children}
    </kbd>
  )
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
      <span className="text-xs font-mono text-text-secondary">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-text-muted text-[10px]">+</span>}
            <KeyCap>{key}</KeyCap>
          </span>
        ))}
      </div>
    </div>
  )
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-overlay/80 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <m.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-void border border-border shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-success" />
                <h2 className="text-xs font-mono font-bold text-text uppercase tracking-widest">
                  KEYBOARD SHORTCUTS
                </h2>
              </div>
              <button type="button"
                onClick={onClose}
                aria-label="Close keyboard shortcuts"
                className="p-1 text-text-muted hover:text-text-secondary transition-colors focus-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-[11px] font-mono text-text-muted mb-3 leading-relaxed">
                <Command className="w-3 h-3 inline mr-1 -mt-0.5" />
                On macOS. On Linux/Windows use Ctrl instead of Cmd.
              </p>
              <div>
                {SHORTCUTS.map((s) => (
                  <ShortcutRow key={s.description} shortcut={s} />
                ))}
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
