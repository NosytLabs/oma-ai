'use client'

import { useEffect, useRef, type RefObject } from 'react'

interface UseFocusTrapOptions {
  active: boolean
  containerRef: RefObject<HTMLElement | null>
  /**
   * Element to restore focus to when the trap closes. Required to preserve
   * WCAG 2.4.3 (focus order) when the trap was opened from a toggle button.
   */
  restoreFocusRef?: RefObject<HTMLElement | null>
  /**
   * Called on Escape. The hook has no internal "open" state of its own, so the
   * parent must drive the close (e.g. by calling its `setOpen(false)` setter).
   * Without this, Escape cannot be handled inside the trap.
   *
   * Read via a ref so callers can pass an inline arrow without forcing the
   * effect to re-subscribe on every render.
   */
  onClose?: () => void
}

/**
 * Generic focus trap for modals/menus. While `active` is true:
 *   - focuses the first tabbable element inside `containerRef` on mount
 *   - cycles Tab/Shift+Tab within the container
 *   - calls `onClose` on Escape (parent decides what "close" means)
 *   - restores focus to `restoreFocusRef.current` on close (if provided)
 *
 * Matches the behavior of the original mobile-menu focus trap exactly:
 * subscribes once on activation, unsubscribes on deactivation — independent
 * of how often `onClose` changes between renders.
 */
export function useFocusTrap({
  active,
  containerRef,
  restoreFocusRef,
  onClose,
}: UseFocusTrapOptions): void {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    const getFocusables = () =>
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )

    getFocusables()[0]?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const all = getFocusables()
      if (all.length === 0) {
        e.preventDefault()
        return
      }
      const first = all[0]
      const last = all[all.length - 1]
      const activeEl = document.activeElement
      if (e.shiftKey && activeEl === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    const savedFocusEl = restoreFocusRef?.current ?? null
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      savedFocusEl?.focus()
    }
  }, [active, containerRef, restoreFocusRef])
}