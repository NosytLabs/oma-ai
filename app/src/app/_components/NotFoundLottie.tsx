'use client'

/**
 * NotFoundLottie — client-only loader for the 404 page lottie.
 * Mirrors FeaturedX402Lottie: server renders a placeholder, hydration
 * mounts the LottiePlayer client-side.
 */

import { useEffect, useState } from 'react'
import { LottiePlayer } from '@/components/LottiePlayer'

export function NotFoundLottie() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="mx-auto mb-6 w-40 sm:w-48" aria-label="404 not found animation container">
      {mounted ? (
        <LottiePlayer
          src="/lottie-404.json"
          loop
          autoplay
          ariaLabel="Route not found: animated 404 indicator"
          className="w-full h-auto"
        />
      ) : (
        <div
          className="w-full aspect-square bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
