'use client'

import { m } from 'framer-motion'

import { UnifiedDepositHeader } from './_components/UnifiedDepositHeader'
import { UnifiedDepositInterface } from './_components/UnifiedDepositInterface'

export default function DepositPage() {
  return (
    <m.div
      className="relative mx-auto max-w-3xl px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient depth layers */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-grid-animated opacity-[0.12] mask-radial" />
        <div className="absolute inset-0 aurora opacity-25" />
      </div>

      <UnifiedDepositHeader />
      <UnifiedDepositInterface onDeposit={(_deposit) => {}} />
    </m.div>
  )
}
