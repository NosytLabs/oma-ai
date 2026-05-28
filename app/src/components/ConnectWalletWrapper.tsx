'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const WalletSkeleton = () => (
  <div className="animate-pulse flex items-center gap-2 px-4 py-2.5">
    <div className="h-2 w-2 rounded-full bg-[var(--color-text-muted)]/30" />
    <div className="h-4 w-20 rounded bg-[var(--color-text-muted)]/30" />
  </div>
)

const WalletProvider = dynamic(
  () => import('./wallet-provider').then(mod => mod.WalletProvider),
  {
    ssr: false,
    loading: () => <WalletSkeleton />
  }
)

interface ConnectWalletWrapperProps {
  children: React.ReactNode
}

export function ConnectWalletWrapper({ children }: ConnectWalletWrapperProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <WalletSkeleton />
  }

  return <WalletProvider>{children}</WalletProvider>
}
