'use client'

/**
 * LottiePlayer — loads a Lottie JSON from /public and renders it via lottie-react.
 *
 * Pauses off-screen via IntersectionObserver to save CPU/GPU, and respects
 * prefers-reduced-motion (via framer-motion's useReducedMotion) by disabling
 * autoplay when the user has set the system preference.
 */

import { useEffect, useRef, useState } from 'react'
import Lottie, { type LottieRefCurrentProps } from 'lottie-react'
import { useReducedMotion } from 'framer-motion'

export interface LottiePlayerProps {
  src: string
  bgColor?: [number, number, number, number]
  loop?: boolean
  autoplay?: boolean
  className?: string
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
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<LottieRefCurrentProps | null>(null)
  const reducedMotion = useReducedMotion()
  const effectiveAutoplay = autoplay && !reducedMotion

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
    return () => { cancelled = true }
  }, [src])

  useEffect(() => {
    if (!animationData) return
    const node = containerRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const instance = animationRef.current
        if (!instance) return
        if (entry.isIntersecting) {
          if (!reducedMotion) instance.play()
        } else {
          instance.pause()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [animationData, reducedMotion])

  const bgCss = `rgba(${Math.round(bgColor[0] * 255)}, ${Math.round(bgColor[1] * 255)}, ${Math.round(bgColor[2] * 255)}, ${bgColor[3]})`

  if (loadError) {
    return (
      <div
        ref={containerRef}
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
        ref={containerRef}
        className={className}
        role="img"
        aria-label={ariaLabel ?? 'Loading animation'}
        style={{ backgroundColor: bgCss }}
      />
    )
  }

  return (
    <div ref={containerRef} className={className}>
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay={effectiveAutoplay}
        lottieRef={animationRef}
        aria-label={ariaLabel}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
