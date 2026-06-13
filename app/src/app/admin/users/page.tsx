'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Users, RefreshCw, Eye, Terminal, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { formatUsd } from '@/lib/utils'
import { api } from "@/lib/api/index"
import { Skeleton } from '@/components/ui/Skeleton'

type AdminUser = {
  id: string
  address: string
  accountNumber: string | null
  createdAt: string
  lastActivityAt: string | null
  balanceCredits: number
  totalDeposited: number
  totalUsed: number
  totalRequests: number
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  const usersQuery = useQuery({
    queryKey: ['adminUsers', page],
    queryFn: () => api.admin.getUsers(page, 50),
    staleTime: 30_000,
  })

  const users: AdminUser[] = useMemo(
    () => usersQuery.data?.users ?? [],
    [usersQuery.data?.users],
  )
  const total = usersQuery.data?.pagination?.total ?? 0
  const pageCount = usersQuery.data?.pagination?.pages ?? 1
  const loading = usersQuery.isLoading

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users
    const q = searchQuery.toLowerCase()
    return users.filter(
      (u) =>
        u.address.toLowerCase().includes(q) ||
        u.accountNumber?.toLowerCase().includes(q),
    )
  }, [users, searchQuery])

  const formatAddress = (addr: string) =>
    addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] flex items-center justify-center">
            <Users className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-syne tracking-tight text-[var(--color-text-bright)]">Users</h1>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">All registered accounts</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['adminUsers'] })}
          aria-label="Refresh users"
          className="oma-btn oma-btn--secondary"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </motion.button>
      </div>

      {usersQuery.isError && (
        <div role="alert" className="flex items-center gap-3 p-4 rounded border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-[var(--color-error)]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-mono flex-1">
            {usersQuery.error instanceof Error ? usersQuery.error.message : 'Failed to load users'}
          </span>
          <button onClick={() => usersQuery.refetch()} className="oma-btn oma-btn--primary">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="search"
            placeholder="Search by address or account number..."
            aria-label="Search users by address or account number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/50"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-mono">
          <Terminal className="w-3.5 h-3.5" />
          <span>{total} total</span>
        </div>
      </div>

      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider">Address</th>
                <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider text-right">Balance</th>
                <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider text-right">Deposited</th>
                <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider text-right">Used</th>
                <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider text-right">Requests</th>
                <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider">Last Active</th>
                <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && filteredUsers.length === 0 && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-b border-[var(--color-border)]/50">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-6" /></td>
                  </tr>
                ))
              )}
              {!loading && filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface)]/50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm text-[var(--color-text-secondary)]">{formatAddress(user.address)}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--color-accent)] tabular-nums">{formatUsd(user.balanceCredits)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--color-success)] tabular-nums">{formatUsd(user.totalDeposited)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--color-amber)] tabular-nums">{formatUsd(user.totalUsed)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--color-text-muted)] tabular-nums">{user.totalRequests?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs">{user.lastActivityAt ? formatDate(user.lastActivityAt) : 'Never'}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="p-1.5 rounded hover:bg-[var(--color-panel)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors inline-flex"
                      aria-label={`View user ${formatAddress(user.address)}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Users className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
                    <p className="text-[var(--color-text-muted)] font-mono text-sm">
                      {searchQuery ? `No users match "${searchQuery}"` : 'No users found'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="oma-btn oma-btn--secondary"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>
        <span className="text-xs text-[var(--color-text-muted)] font-mono">Page {page} of {pageCount || 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= pageCount}
          className="oma-btn oma-btn--secondary"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
