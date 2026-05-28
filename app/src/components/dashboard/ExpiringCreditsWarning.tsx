'use client'

import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { CreditBatch } from '@/lib/api'

interface ExpiringCreditsWarningProps {
  creditBatches: CreditBatch[]
}

export function ExpiringCreditsWarning({ creditBatches }: ExpiringCreditsWarningProps) {
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiringBatches = creditBatches.filter(b => {
    const expDate = new Date(b.expiresAt)
    return expDate <= thirtyDaysFromNow && expDate > now
  })

  if (expiringBatches.length === 0) return null

  return (
    <motion.div
      className="p-4 bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-5 w-5 items-center justify-center text-[var(--color-secondary)] mt-0.5">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-secondary)] mb-2">CREDITS_EXPIRING</h3>
          <div className="space-y-2">
            {expiringBatches.map(batch => {
              const expDate = new Date(batch.expiresAt)
              const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
              return (
                <div key={batch.id} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">
                    ${(parseInt(batch.remainingCents) / 100).toFixed(2)}
                  </span>
                  <span className="text-[var(--color-secondary)] font-medium">
                    {daysLeft === 0 ? 'EXPIRES TODAY' : daysLeft === 1 ? 'EXPIRES TOMORROW' : `EXPIRES IN ${daysLeft}d`}
                  </span>
                </div>
              )
            })}
          </div>
          <Link href="/dashboard/credits" className="mt-2 inline-block text-[10px] uppercase tracking-widest text-[var(--color-secondary)] hover:text-[var(--color-secondary)]/80 transition-colors">
            BUY MORE Credits_
          </Link>
        </div>
      </div>
    </motion.div>
  )
}