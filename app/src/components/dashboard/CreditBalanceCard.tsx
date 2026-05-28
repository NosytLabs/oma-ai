'use client'

import { memo } from 'react'
import Link from 'next/link'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { formatCents } from '@/lib/utils'
import type { BalanceResponse } from '@/lib/api'

interface CreditBalanceCardProps {
  balance: BalanceResponse | null
  loading: boolean
}

function CreditBalanceCardComponent({ balance, loading }: CreditBalanceCardProps) {
  return (
    <div className="flex flex-col justify-between p-6 bg-[var(--color-void)]">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">CREDIT_BALANCE</h2>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">SYS.FUNDS.CURRENT</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 text-[var(--color-success)]">
          <span className="text-xs font-mono">$$</span>
        </div>
      </div>

      <div className="mb-8">
        <div className="text-4xl font-light tracking-tight text-[var(--color-text)] mb-2">
          {loading && !balance ? (
            <span className="text-[var(--color-text-muted)]">$0.00</span>
          ) : (
            <AnimatedNumber value={parseFloat(formatCents(balance?.balanceCents ?? '0'))} />
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          <span className="inline-block h-1.5 w-1.5 bg-[var(--color-text-muted)]" />
          {balance ? `DEPOSITED: ${formatCents(balance.totalDepositedCents)}` : 'DEPOSITED: $0.00'}
        </div>
      </div>

      <div className="flex gap-4 border-t border-[var(--color-border)] pt-4">
        <Link 
          href="/dashboard/credits" 
          aria-label="Purchase credits"
          className="group flex flex-1 items-center justify-center border border-[var(--color-border-bright)] bg-[var(--color-surface)] px-4 py-2 text-xs uppercase tracking-widest text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-success)] hover:text-[var(--color-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] active:bg-[var(--color-surface-elevated)]"
        >
          [ PURCHASE ]
        </Link>
        <Link 
          href="/deposit" 
          aria-label="Deposit funds"
          className="group flex flex-1 items-center justify-center border border-[var(--color-border-bright)] bg-[var(--color-void)] px-4 py-2 text-xs uppercase tracking-widest text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)] active:bg-[var(--color-surface)]"
        >
          [ DEPOSIT ]
        </Link>
      </div>
    </div>
  )
}

export const CreditBalanceCard = memo(CreditBalanceCardComponent, (prev, next) => {
  return prev.balance === next.balance && prev.loading === next.loading
})