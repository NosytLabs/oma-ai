'use client'

import { useEffect, useRef, useState } from 'react'

export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true)
          observer.unobserve(element)
        }
      },
      { threshold: 0.1, ...options }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [options])

  return [ref, isIntersecting]
}

export function useAnimatedSection() {
  const [ref, isVisible] = useIntersectionObserver({ threshold: 0.15 })
  return { ref, isVisible }
}
