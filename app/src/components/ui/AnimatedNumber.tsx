'use client'

import { m, useReducedMotion } from 'framer-motion'

export function AnimatedNumber({ value, prefix = '$' }: { value: number; prefix?: string }) {
  const prefersReducedMotion = useReducedMotion()
  
  return (
    <m.span
      initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      animate={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, type: 'spring' }}
    >
      {prefix}{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </m.span>
  )
}
