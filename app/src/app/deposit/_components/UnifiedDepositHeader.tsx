'use client'

import { motion } from 'framer-motion'
import { Coins, Hexagon } from 'lucide-react'

export function UnifiedDepositHeader() {
  return (
    <motion.div
      className="mb-8"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center gap-4 mb-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-border-bright)] bg-[var(--color-surface)]">
          <Coins className="h-6 w-6 text-[var(--color-cyan)]" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--color-text-bright)]">Deposit Credits</h1>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Crypto-friendly credit system. Fund with USDC or swap from 100+ cryptocurrencies via Houdini-powered flow.
          </p>
        </div>
        <motion.span
          className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono font-semibold text-[var(--color-cyan)] border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <Hexagon className="h-3 w-3" />
          BASE
        </motion.span>
      </div>
    </motion.div>
  )
}
