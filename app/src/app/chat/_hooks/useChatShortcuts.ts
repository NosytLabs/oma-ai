'use client'

import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'

export interface UseChatShortcutsOptions {
  sendMessageRef: RefObject<(prompt?: string) => Promise<void>>
  input: string
  loading: boolean
  shortcutsOpen: boolean
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>
  paramsOpen: boolean
  setParamsOpen: Dispatch<SetStateAction<boolean>>
  compareMode: boolean
  setCompareMode: Dispatch<SetStateAction<boolean>>
}

/**
 * Global keyboard shortcuts for the playground.
 *
 *   ? / Shift+/       → open the shortcuts modal (when not in a text field)
 *   Escape            → close shortcuts → params → compare, in that order
 *   Cmd/Ctrl + K      → focus the model picker (clicks its DOM button)
 *   Cmd/Ctrl + /      → toggle the parameters panel
 *   Cmd/Ctrl + Enter  → send the current input (ref-based so we always
 *                       see the latest sendMessage without re-binding)
 *
 * The listener binds to `window` and inspects `e.target` so it stays out
 * of the way while the user is typing in the input or any other text
 * field. `sendMessage` is held in a ref that the page updates in a
 * useEffect — see page.tsx for the P1 #10 fix.
 */
export function useChatShortcuts({
  sendMessageRef,
  input,
  loading,
  shortcutsOpen,
  setShortcutsOpen,
  paramsOpen,
  setParamsOpen,
  compareMode,
  setCompareMode,
}: UseChatShortcutsOptions): void {
  useEffect(() => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    const modKey = isMac ? 'metaKey' : 'ctrlKey'

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inTextField = !!target && (
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable
      )

      if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !inTextField) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }

      if (e.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false)
        else if (paramsOpen) setParamsOpen(false)
        else if (compareMode) setCompareMode(false)
        return
      }

      if (e[modKey as 'metaKey' | 'ctrlKey'] && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        // Focus the model selector by clicking it. We dispatch a custom event
        // that the ModelSelector listens to (or we just click the toolbar's
        // model selector button). For now, focus the first toolbar button.
        const buttons = document.querySelectorAll<HTMLButtonElement>('header[aria-label="Playground toolbar"] button[aria-label="Select AI model"]')
        buttons[0]?.click()
        return
      }

      if (e[modKey as 'metaKey' | 'ctrlKey'] && e.key === '/') {
        e.preventDefault()
        setParamsOpen((v) => !v)
        return
      }

      if (e[modKey as 'metaKey' | 'ctrlKey'] && e.key === 'Enter') {
        e.preventDefault()
        if (input.trim() && !loading) {
          void sendMessageRef.current()
        }
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [input, loading, paramsOpen, compareMode, shortcutsOpen, sendMessageRef, setShortcutsOpen, setParamsOpen, setCompareMode])
}
