'use client'

import { useState, useCallback } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'success' | 'error'>('idle')

  const handleClick = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setState('error')
      setTimeout(() => setState('idle'), 1500)
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setState('success')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 1500)
  }, [text])

  const label = state === 'success' ? 'copied' : state === 'error' ? 'failed' : 'copy'
  // WCAG 2.5.3: the accessible name (aria-label) must START with the visible label
  // so voice-control users ("click copy") and screen-reader users agree on the name.
  const ariaLabel =
    state === 'success'
      ? 'Copied to clipboard'
      : state === 'error'
        ? 'Failed to copy; try again'
        : 'Copy snippet to clipboard'
  const colorClass =
    state === 'success'
      ? 'text-[var(--color-success)]'
      : state === 'error'
        ? 'text-[var(--color-error)]'
        : 'text-[var(--color-text-muted)]'

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      className={`text-[10px] uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-95 rounded-sm px-1.5 py-0.5 transition-colors ${colorClass}`}
    >
      {label}
    </button>
  )
}
