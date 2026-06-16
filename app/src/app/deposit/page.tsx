'use client'

import { m } from 'framer-motion'

import { UnifiedDepositHeader } from './_components/UnifiedDepositHeader'
import { UnifiedDepositInterface } from './_components/UnifiedDepositInterface'

export default function DepositPage() {
  return (
    <m.div
      className="mx-auto max-w-3xl px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <UnifiedDepositHeader />
      <UnifiedDepositInterface onDeposit={(_deposit) => {}} />
    </m.div>
  )
}
