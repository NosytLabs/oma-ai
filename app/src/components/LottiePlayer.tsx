'use client'

/**
 * LottiePlayer — loads a Lottie JSON from /public and renders it via lottie-react.
 *
 * The JSONs were authored for Skia's Skottie (canvaskit-wasm) per the text-to-lottie
 * skill, but they use only standard Lottie shape-layer primitives (no Skottie-only
 * features), so lottie-react's underlying lottie-web runtime renders them correctly.
 *
 * The bgColor slot from the JSON is editable via the `bgColor` prop (default matches
 * the OMA dark void).
 */

import { useEffect, useState } from 'react'
import Lottie from 'lottie-react'

export interface LottiePlayerProps {
  /** Path under /public, e.g. "/lottie-x402-flow.json" */
  src: string
  /** Background color slot. OMA void = [10, 10, 15] = [0.04, 0.04, 0.06] in 0-1 RGBA */
  bgColor?: [number, number, number, number]
  /** Loop the animation (default true) */
  loop?: boolean
  /** Autoplay on mount (default true) */
  autoplay?: boolean
  /** Render with a className for sizing */
  className?: string
  /** Optional aria label for accessibility */
  ariaLabel?: string
}

export function LottiePlayer({
  src,
  bgColor = [0.04, 0.04, 0.06, 1],
  loop = true,
  autoplay = true,
  className,
  ariaLabel,
}: LottiePlayerProps) {
  const [animationData, setAnimationData] = useState<object | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${src}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setAnimationData(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [src])

  const bgCss = `rgba(${Math.round(bgColor[0] * 255)}, ${Math.round(bgColor[1] * 255)}, ${Math.round(bgColor[2] * 255)}, ${bgColor[3]})`

  if (loadError) {
    return (
      <div
        className={className}
        role="img"
        aria-label={ariaLabel ?? 'Animation unavailable'}
        style={{ backgroundColor: bgCss }}
      />
    )
  }

  if (!animationData) {
    return (
      <div
        className={className}
        role="img"
        aria-label={ariaLabel ?? 'Loading animation'}
        style={{ backgroundColor: bgCss }}
      />
    )
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
      aria-label={ariaLabel}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
