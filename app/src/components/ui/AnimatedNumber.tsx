'use client'

import { motion } from 'framer-motion'

export function AnimatedNumber({ value, prefix = '$' }: { value: number; prefix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: 'spring' }}
    >
      {prefix}{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </motion.span>
  )
}
