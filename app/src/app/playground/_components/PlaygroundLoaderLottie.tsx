'use client'

/**
 * PlaygroundLoaderLottie — client-only loader for the playground route
 * lottie. Mirrors FeaturedX402Lottie: server renders the existing
 * skeleton, hydration mounts the LottiePlayer client-side.
 */

import { useEffect, useState } from 'react'
import { LottiePlayer } from '@/components/LottiePlayer'

export function PlaygroundLoaderLottie() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="mx-auto mb-4 w-24 sm:w-32" aria-label="playground initializing animation container">
      {mounted ? (
        <LottiePlayer
          src="/lottie-playground-loader.json"
          loop
          autoplay
          ariaLabel="Initializing playground"
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
