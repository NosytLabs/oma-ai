import { motion } from 'framer-motion'

export function formatCents(cents: string | number): string {
  const n = typeof cents === 'string' ? parseFloat(cents) : cents
  return (n / 100).toFixed(2)
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

export function maskKey(prefix: string): string {
  return `${prefix}****`
}

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