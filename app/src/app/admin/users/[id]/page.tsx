'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { ArrowLeft, CreditCard, DollarSign, Key, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

type UserDetail = {
  user: {
    id: string
    address: string
    solanaAddress: string | null
    accountNumber: string | null
    createdAt: string
  }
  balance: {
    balanceCredits: number
    totalDeposited: number
    totalUsed: number
  }
  apiKeys: Array<{
    id: string
    keyPrefix: string
    name: string
    active: boolean
    createdAt: string
    totalRequests: number
    totalSpend: number
  }>
  recentUsage: Array<{
    id: string
    model: string
    provider: string
    inputTokens: number
    outputTokens: number
    cost: number
    createdAt: string
  }>
  recentDeposits: Array<{
    id: string
    type: string
    amount: number
    credits: number
    status: string
    txHash: string | null
    createdAt: string
    completedAt: string | null
  }>
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUserDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${id}`)
      if (!res.ok) {
        throw new Error('User not found')
      }
      const data = await res.json()
      setUserDetail(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user')
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchUserDetail()
  }, [fetchUserDetail])

  const formatCredits = (cents: number) => {
    return `${cents.toLocaleString()} credits`
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
          <span className="text-zinc-400">Loading user details...</span>
        </div>
      </div>
    )
  }

  if (error || !userDetail) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link href="/admin" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
            <p className="text-xl font-bold text-white mb-2">User Not Found</p>
            <p className="text-zinc-500 mb-4">{error || 'The requested user does not exist.'}</p>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
            >
              Return to Admin
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { user, balance, apiKeys, recentUsage, recentDeposits } = userDetail

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold font-display">User Details</h1>
                <p className="text-xs text-zinc-500 font-mono">{user.address}</p>
              </div>
            </div>
            <button
              onClick={fetchUserDetail}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Current Balance</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400">{formatCredits(balance.balanceCredits)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Total Deposited</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(balance.totalDeposited)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Total Used</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(balance.totalUsed)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-lg font-medium text-white mb-4">Account Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Wallet Address (EVM)</label>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-white">{user.address}</p>
                  <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white">
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {user.solanaAddress && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Solana Address</label>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm text-white">{user.solanaAddress}</p>
                    <button className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white">
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              {user.accountNumber && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Account Number</label>
                  <p className="font-mono text-sm text-cyan-400">{user.accountNumber}</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Member Since</label>
                <p className="text-sm text-white">{formatDate(user.createdAt)}</p>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">API Keys</label>
                <p className="text-sm text-white">{apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">API Keys ({apiKeys.length})</h2>
          </div>
          {apiKeys.length === 0 ? (
            <div className="px-5 py-8 text-center text-zinc-500">No API keys found</div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {apiKeys.map((key) => (
                <div key={key.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Key className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-mono text-sm text-cyan-400">{key.keyPrefix}***</p>
                      <p className="text-xs text-zinc-500">{key.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Total Requests</p>
                      <p className="text-sm font-mono text-white">{key.totalRequests.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Total Spend</p>
                      <p className="text-sm font-mono text-amber-400">{formatCurrency(key.totalSpend)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Created</p>
                      <p className="text-sm text-zinc-400">{formatDateShort(key.createdAt)}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      key.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'
                    }`}>
                      {key.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-lg font-medium text-white">Recent Usage (Last 100 Requests)</h2>
          </div>
          {recentUsage.length === 0 ? (
            <div className="px-5 py-8 text-center text-zinc-500">No usage records found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/30">
                    <th className="px-4 py-3 font-medium text-zinc-400">Model</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Provider</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Input Tokens</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Output Tokens</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Cost</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsage.map((usage) => (
                    <tr key={usage.id} className="border-b border-zinc-800/50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-white">{usage.model}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-500 capitalize">{usage.provider}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">{usage.inputTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">{usage.outputTokens.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-cyan-400">{formatCurrency(usage.cost)}</td>
                      <td className="px-4 py-3 text-zinc-500">{format(usage.createdAt, 'MMM d, h:mm a')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-lg font-medium text-white">Deposit History</h2>
          </div>
          {recentDeposits.length === 0 ? (
            <div className="px-5 py-8 text-center text-zinc-500">No deposits found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/30">
                    <th className="px-4 py-3 font-medium text-zinc-400">Type</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Amount</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Credits</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Status</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">TX Hash</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDeposits.map((deposit) => (
                    <tr key={deposit.id} className="border-b border-zinc-800/50">
                      <td className="px-4 py-3">
                        <span className="text-sm text-white capitalize">{deposit.type}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(deposit.amount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-cyan-400">{deposit.credits.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          deposit.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          deposit.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                          deposit.status === 'settling' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-zinc-700 text-zinc-500'
                        }`}>
                          {deposit.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {deposit.txHash ? (
                          <span className="font-mono text-xs text-zinc-500">{deposit.txHash.slice(0, 10)}...</span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{formatDate(deposit.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}