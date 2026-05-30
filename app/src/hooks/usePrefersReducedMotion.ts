'use client'

import { useEffect, useState } from 'react'

export function usePrefersReducedMotion(): boolean | null {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean | null>(null)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

// Memoized version for components that call this in render
export function usePrefersReducedMotionMemo(): boolean {
  const prefersReducedMotionState = usePrefersReducedMotion()
  return prefersReducedMotionState ?? false
}
