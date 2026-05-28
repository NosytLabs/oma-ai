'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'

interface DepositRecord {
  id: string
  type: string
  status: string
  amountUsd: string
  creditsIssued: string
  txHash: string | null
  createdAt: string
  completedAt: string | null
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning)]/10', label: 'Pending' },
  settling: { icon: RefreshCw, color: 'text-[var(--color-info)]', bg: 'bg-[var(--color-info)]/10', label: 'Settling' },
  completed: { icon: CheckCircle2, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/10', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-[var(--color-error)]', bg: 'bg-[var(--color-error)]/10', label: 'Failed' },
  expired: { icon: AlertTriangle, color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-text-muted)]/10', label: 'Expired' },
  refunded: { icon: RefreshCw, color: 'text-[var(--color-violet)]', bg: 'bg-[var(--color-violet)]/10', label: 'Refunded' },
}

const TYPE_LABELS: Record<string, string> = {
  usdc_direct: 'USDC Direct',
  usdc_solana: 'USDC Solana',
  houdini_swap: 'HoudiniSwap',
  cctp_crosschain: 'CCTP Cross-Chain',
  lifi_swap: 'LiFi Swap',
  jupiter_swap: 'Jupiter Swap',
  solana_direct: 'Solana Direct',
  payment_link: 'Payment Link',
  wrong_network_recovery: 'Recovery',
}

export function DepositStatusTracker() {
  const [deposits, setDeposits] = useState<DepositRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchDeposits = useCallback(async () => {
    try {
      setError(null)
      const response = await api.deposit.getStatus()
      setDeposits(response.deposits)
    } catch (err) {
      console.error('Failed to fetch deposits:', err)
      setError('Failed to load deposit history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeposits()
    const interval = setInterval(fetchDeposits, 30000)
    return () => clearInterval(interval)
  }, [fetchDeposits])

  const handleRetry = async (depositId: string) => {
    setRetryingId(depositId)
    try {
      await api.deposit.retry(depositId)
      await fetchDeposits()
    } catch (err) {
      console.error('Failed to retry deposit:', err)
      setError('Failed to retry deposit')
    } finally {
      setRetryingId(null)
    }
  }

  const getExplorerUrl = (txHash: string, type: string) => {
    if (type.includes('solana')) {
      return `https://solscan.io/tx/${txHash}`
    }
    return `https://basescan.io/tx/${txHash}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-cyan)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--color-error)] text-sm mb-3">{error}</p>
        <button
          onClick={fetchDeposits}
          className="text-sm text-[var(--color-cyan)] hover:text-[var(--color-cyan-bright)]"
        >
          Try again
        </button>
      </div>
    )
  }

  if (deposits.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--color-text-muted)] text-sm">No deposit history yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Recent Deposits</h3>
        <button
          onClick={fetchDeposits}
          className="p-1.5 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {deposits.slice(0, 10).map((deposit) => {
        const config = STATUS_CONFIG[deposit.status]
        const StatusIcon = config.icon
        const isExpanded = expandedId === deposit.id

        return (
          <motion.div
            key={deposit.id}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => setExpandedId(isExpanded ? null : deposit.id)}
              className="w-full p-4 flex items-center gap-3 text-left hover:bg-[var(--color-surface-elevated)] transition-colors"
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.bg}`}>
                <StatusIcon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-text-bright)]">
                    ${parseFloat(deposit.amountUsd).toFixed(2)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {TYPE_LABELS[deposit.type] || deposit.type} • {formatDate(deposit.createdAt)}
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {deposit.creditsIssued} credits
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-[var(--color-border)] p-4 bg-[var(--color-surface-elevated)]"
                >
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Deposit ID</span>
                      <span className="font-mono text-xs text-[var(--color-text-secondary)]">{deposit.id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Credits Issued</span>
                      <span className="text-[var(--color-text-secondary)]">{deposit.creditsIssued}</span>
                    </div>
                    {deposit.txHash && (
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--color-text-muted)]">Transaction</span>
                        <a
                          href={getExplorerUrl(deposit.txHash, deposit.type)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[var(--color-cyan)] hover:text-[var(--color-cyan-bright)]"
                        >
                          <span className="font-mono text-xs">{deposit.txHash.slice(0, 10)}...</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {deposit.completedAt && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Completed</span>
                        <span className="text-[var(--color-text-secondary)]">{formatDate(deposit.completedAt)}</span>
                      </div>
                    )}
                    {deposit.status === 'pending' && (
                      <div className="pt-2 border-t border-[var(--color-border)]">
                        <button
                          onClick={() => handleRetry(deposit.id)}
                          disabled={retryingId === deposit.id}
                          className="w-full py-2 px-4 rounded text-sm font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] disabled:opacity-50"
                        >
                          {retryingId === deposit.id ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Retrying...
                            </span>
                          ) : (
                            'Retry Deposit'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}
