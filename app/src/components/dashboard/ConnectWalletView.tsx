'use client'

import { m } from 'framer-motion'
import Link from 'next/link'
import { Wallet, Zap } from 'lucide-react'

interface ConnectWalletViewProps {
  onConnect: () => void
}

export function ConnectWalletView({ onConnect }: ConnectWalletViewProps) {
  return (
    <m.div
      className="relative flex min-h-screen items-center justify-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
      >
        ← Home
      </Link>
      <div className="text-center max-w-md px-4">
        <m.div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center border border-border bg-void"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
        >
          <Wallet className="h-10 w-10 text-success" />
        </m.div>
        <h2 className="mb-3 text-2xl font-bold text-text-bright">CONNECT_WALLET</h2>
        <p className="mb-6 text-sm text-text-secondary">
          Sign in to view your credits, usage stats, and manage API keys.
        </p>
        <button
          onClick={() => onConnect()}
          aria-label="Connect wallet"
          className="group flex items-center justify-center mx-auto border border-success bg-void px-8 py-3 text-sm uppercase tracking-widest text-success transition-colors hover:bg-border hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:translate-y-[1px]"
        >
          <Zap className="h-4 w-4 mr-2" />
          Connect Wallet
        </button>
      </div>
    </m.div>
  )
}