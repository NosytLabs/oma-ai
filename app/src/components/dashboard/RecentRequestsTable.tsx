'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatTime } from '@/lib/utils'
import type { UsageRecord } from '@/lib/api'

interface RecentRequestsTableProps {
  usage: UsageRecord[]
  loading: boolean
  page: number
  limit: number
  onPageChange: (page: number) => void
}

export function RecentRequestsTable({ usage, loading, page, limit, onPageChange }: RecentRequestsTableProps) {
  const totalPages = Math.ceil(usage.length / limit)

  return (
    <div className="p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">RECENT_REQUESTS</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th scope="col" className="py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Model</th>
              <th scope="col" className="py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Input</th>
              <th scope="col" className="py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Output</th>
              <th scope="col" className="py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Cost</th>
              <th scope="col" className="py-3 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading && usage.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <span className="inline-block h-4 w-4 border border-[var(--color-border-bright)] border-t-[var(--color-success)] rounded-full animate-spin" />
                </td>
              </tr>
            ) : usage.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-[var(--color-text-muted)]">
                  No inference calls yet. <Link href="/playground" className="text-[var(--color-success)] hover:underline">Try the playground</Link>
                </td>
              </tr>
            ) : (
              usage.slice((page - 1) * limit, page * limit).map((row, i) => (
                <motion.tr
                  key={row.id}
                  className="border-b border-[var(--color-border)] bg-[var(--color-void)] transition-colors hover:bg-[var(--color-surface)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--color-success)]">{row.model}</td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{row.promptTokens.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{row.completionTokens.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-[var(--color-secondary)]">${(parseFloat(String(row.costCents)) / 100).toFixed(4)}</td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">{formatTime(row.createdAt)}</td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && usage.length > limit && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, usage.length)} of {usage.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              aria-label="Go to previous page"
              className="flex items-center justify-center border border-[var(--color-border-bright)] bg-[var(--color-surface)] w-8 h-8 text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-xs text-[var(--color-text)] px-2" aria-current="page">Page {page} of {totalPages}</span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              aria-label="Go to next page"
              className="flex items-center justify-center border border-[var(--color-border-bright)] bg-[var(--color-surface)] w-8 h-8 text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-void)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}