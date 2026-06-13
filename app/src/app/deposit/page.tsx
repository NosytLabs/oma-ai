'use client'

import { useWallet } from '@/components/wallet-provider'
import { Wallet, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

import { UnifiedDepositHeader } from './_components/UnifiedDepositHeader'
import { UnifiedDepositInterface } from './_components/UnifiedDepositInterface'

export default function DepositPage() {
  const { isConnected, connectEvm } = useWallet()

  if (!isConnected) {
    return (
      <motion.div
        className="flex min-h-[calc(100vh-4rem)] items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-left max-w-md px-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--color-border-bright)] bg-[var(--color-surface)]">
              <Wallet className="h-7 w-7 text-[var(--color-accent)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-bright)]">Connect Your Wallet</h1>
              <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                Connect an EVM wallet to deposit funds and generate API credits for AI inference services.
              </p>
            </div>
          </div>
          <motion.button
            onClick={() => connectEvm()}
            className="inline-flex items-center gap-2 py-3 px-6 rounded-full bg-[var(--color-accent)] text-[var(--color-void)] font-semibold text-sm
              hover:bg-[var(--color-accent-bright)]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50
              active:translate-y-0
              transition-colors duration-150"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap className="h-4 w-4" />
            Connect Base Wallet
          </motion.button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="mx-auto max-w-3xl px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <UnifiedDepositHeader />
      <UnifiedDepositInterface onDeposit={(_deposit) => {}} />
    </motion.div>
  )
}
