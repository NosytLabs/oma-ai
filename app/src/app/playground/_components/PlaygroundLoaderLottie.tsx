'use client'

/**
 * PlaygroundLoaderLottie — pure-CSS loader (three bouncing dots).
 *
 * Replaces a single-dot opacity-pulse Lottie (~1.4 KB JSON + lottie-react
 * runtime overhead) with three staggered bouncing dots. Zero JavaScript
 * at runtime, GPU-composited animation.
 */

export function PlaygroundLoaderLottie() {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="h-3 w-3 rounded-full bg-accent animate-bounce" />
      <div className="h-3 w-3 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0.15s' }} />
      <div className="h-3 w-3 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0.3s' }} />
    </div>
  )
}
