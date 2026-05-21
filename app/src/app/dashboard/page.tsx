'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type ApiKey, type ApiKeyWithSecret, type BalanceResponse, type UsageRecord } from '@/lib/api'
import {
  Wallet,
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Coins,
  ShieldCheck,
  Terminal,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

const STAKING_TIERS = [
  { stake: 0, discount: 0, label: 'None' },
  { stake: 1000, discount: 3, label: 'Bronze' },
  { stake: 10000, discount: 6, label: 'Silver' },
  { stake: 50000, discount: 10, label: 'Gold' },
  { stake: 100000, discount: 15, label: 'Platinum' },
]

function getTier(discount: number) {
  for (let i = STAKING_TIERS.length - 1; i >= 0; i--) {
    if (discount >= STAKING_TIERS[i].discount) return STAKING_TIERS[i]
  }
  return STAKING_TIERS[0]
}

function getNextTier(discount: number) {
  for (const tier of STAKING_TIERS) {
    if (tier.discount > discount) return tier
  }
  return null
}

function formatCents(cents: string | number): string {
  const n = typeof cents === 'string' ? parseFloat(cents) : cents
  return `$${(n / 100).toFixed(2)}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

function maskKey(prefix: string): string {
  return `${prefix}****`
}

export default function DashboardPage() {
  const { isConnected, connectEvm } = useWallet()

  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [usage, setUsage] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null)

  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [bal, keyList, usageData] = await Promise.all([
        api.getBalance(),
        api.getApiKeys(),
        api.getUsage(),
      ])
      setBalance(bal)
      setKeys(keyList)
      setUsage(usageData.usage)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const [bal, keyList, usageData] = await Promise.all([
          api.getBalance(),
          api.getApiKeys(),
          api.getUsage(),
        ])
        if (cancelled) return
        setBalance(bal)
        setKeys(keyList)
        setUsage(usageData.usage)
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load dashboard data'
        setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [isConnected])

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const key = await api.createApiKey(newKeyName.trim())
      setCreatedKey(key)
      setNewKeyName('')
      setShowCreateForm(false)
      setKeys((prev) => [...prev, { id: key.id, name: key.name, prefix: key.prefix, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt }])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create key'
      setError(msg)
    } finally {
      setCreating(false)
    }
  }, [newKeyName])

  const handleRevokeKey = useCallback(async (keyId: string) => {
    setRevokingId(keyId)
    try {
      await api.revokeApiKey(keyId)
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to revoke key'
      setError(msg)
    } finally {
      setRevokingId(null)
    }
  }, [])

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-bg-card">
            <Wallet className="h-8 w-8 text-accent" />
          </div>
          <h2 className="mono mb-2 text-xl font-bold">CONNECT WALLET</h2>
          <p className="mono mb-6 text-sm text-text-secondary">
            Authenticate to access the OMA terminal.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => connectEvm()} className="btn-primary mono text-sm">
              EVM / BASE
            </button>
          </div>
        </div>
      </div>
    )
  }

  const tier = getTier(balance?.stakingDiscount ?? 0)
  const nextTier = getNextTier(balance?.stakingDiscount ?? 0)
  const tierProgress = nextTier
    ? ((balance?.stakingDiscount ?? 0) / nextTier.discount) * 100
    : 100

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-mono">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mono text-2xl font-bold tracking-tight">DASHBOARD</h1>
          <p className="mono mt-1 text-xs text-text-secondary">
            OMA TERMINAL -- STATUS: {loading ? 'SYNCING' : error ? 'DEGRADED' : 'NOMINAL'}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn-secondary mono flex items-center gap-2 py-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <span className="mono text-xs text-danger">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-text-secondary hover:text-text-primary">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Row: Balance + Quick Start */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Balance Card */}
        <div className="card glow lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs text-text-secondary">
                <Coins className="h-3.5 w-3.5" />
                CREDIT BALANCE
              </div>
              <div className="mono text-4xl font-bold text-accent">
                {loading ? '---' : balance ? formatCents(balance.balanceCents) : '$0.00'}
              </div>
              <div className="mono mt-1 text-xs text-text-secondary">USD CREDITS</div>
            </div>
            <a
              href="/deposit"
              className="btn-primary mono flex items-center gap-1.5 py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              DEPOSIT
            </a>
          </div>

          {/* Staking Tier */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
                <ShieldCheck className="h-4.5 w-4.5 text-accent" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="mono text-sm font-semibold">
                      {tier.label.toUpperCase()} TIER
                    </span>
                    {tier.discount > 0 && (
                      <span className="mono ml-2 text-sm text-accent">
                        -{tier.discount}%
                      </span>
                    )}
                  </div>
                  {nextTier && (
                    <span className="mono text-xs text-text-secondary">
                      NEXT: {nextTier.label.toUpperCase()} ({nextTier.stake.toLocaleString()} OMA)
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${tierProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start Card */}
        <div className="card">
          <div className="mb-3 flex items-center gap-2 text-xs text-text-secondary">
            <Terminal className="h-3.5 w-3.5" />
            QUICK START
          </div>
          <div className="rounded-lg border border-border bg-bg-primary p-3">
            <pre className="mono overflow-x-auto text-xs leading-relaxed text-text-secondary">
              <span className="text-accent">curl</span> https://api.oma-ai.com/v1/chat/completions {'\n'}
              <span className="text-accent">-H</span> <span className="text-warning">&quot;Authorization: Bearer oma_sk_...&quot;</span>{' \n'}
              <span className="text-accent">-H</span> <span className="text-warning">&quot;Content-Type: application/json&quot;</span>{' \n'}
              <span className="text-accent">-d</span> <span className="text-warning">{`'{"model":"deepseek-r1",`}</span>{'\n'}
              <span className="text-warning">{`  "messages":[{"role":"user",`}</span>{'\n'}
              <span className="text-warning">{`  "content":"Hello"}]}'`}</span>
            </pre>
          </div>
          <p className="mono mt-2 text-[10px] text-text-secondary">
            OpenAI-compatible endpoint. Use any SDK.
          </p>
        </div>
      </div>

      {/* API Keys Section */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="mono text-lg font-bold tracking-tight">API KEYS</h2>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary mono flex items-center gap-1.5 py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              CREATE KEY
            </button>
          )}
        </div>

        {/* Create Key Inline Form */}
        {showCreateForm && (
          <div className="card mb-4 border-accent/30 bg-bg-card">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                placeholder="Key name (e.g. production)"
                className="mono flex-1 text-sm"
                autoFocus
                disabled={creating}
              />
              <button
                onClick={handleCreateKey}
                disabled={creating || !newKeyName.trim()}
                className="btn-primary mono flex items-center gap-1.5 py-1.5 text-xs disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Key className="h-3.5 w-3.5" />
                )}
                GENERATE
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setNewKeyName('')
                }}
                className="btn-secondary mono py-1.5 text-xs"
                disabled={creating}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* Key List */}
        {keys.length === 0 && !loading ? (
          <div className="card flex items-center justify-center py-8 text-text-secondary">
            <span className="mono text-sm">No API keys. Create one above.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="card flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg-secondary">
                    <Key className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <div className="mono text-sm font-medium">{key.name}</div>
                    <div className="mono text-xs text-text-secondary">
                      {maskKey(key.prefix)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="mono text-[10px] text-text-secondary">
                    CREATED {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                  {key.lastUsedAt && (
                    <span className="mono text-[10px] text-text-secondary">
                      USED {formatTime(key.lastUsedAt)}
                    </span>
                  )}
                  <button
                    onClick={() => handleCopy(key.prefix, `prefix-${key.id}`)}
                    className="rounded p-1.5 transition-colors hover:bg-bg-secondary hover:text-accent"
                    title="Copy prefix"
                  >
                    {copied === `prefix-${key.id}` ? (
                      <Check className="h-3.5 w-3.5 text-accent" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    disabled={revokingId === key.id}
                    className="rounded p-1.5 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                    title="Revoke key"
                  >
                    {revokingId === key.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Table */}
      <div className="mb-8">
        <h2 className="mono mb-4 text-lg font-bold tracking-tight">RECENT USAGE</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="mono px-4 py-3 text-xs font-medium text-text-secondary">MODEL</th>
                  <th className="mono px-4 py-3 text-xs font-medium text-text-secondary">INPUT</th>
                  <th className="mono px-4 py-3 text-xs font-medium text-text-secondary">OUTPUT</th>
                  <th className="mono px-4 py-3 text-xs font-medium text-text-secondary">COST</th>
                  <th className="mono px-4 py-3 text-xs font-medium text-text-secondary">TIME</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-text-secondary" />
                    </td>
                  </tr>
                ) : usage.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="mono px-4 py-8 text-center text-sm text-text-secondary">
                      No inference calls yet.
                    </td>
                  </tr>
                ) : (
                  usage.slice(0, 20).map((row, i) => (
                    <tr
                      key={row.id}
                      className={`border-b border-border/50 transition-colors hover:bg-bg-card ${i % 2 === 1 ? 'bg-bg-secondary/30' : ''}`}
                    >
                      <td className="mono px-4 py-3 text-xs text-accent">{row.model}</td>
                      <td className="mono px-4 py-3 text-xs">{row.promptTokens.toLocaleString()}</td>
                      <td className="mono px-4 py-3 text-xs">{row.completionTokens.toLocaleString()}</td>
                      <td className="mono px-4 py-3 text-xs">{formatCents(row.costCents)}</td>
                      <td className="mono px-4 py-3 text-xs text-text-secondary">
                        {formatTime(row.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Key Modal */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="card glow mx-4 w-full max-w-lg border-accent/30">
            <div className="mb-4 flex items-center gap-2">
              <Key className="h-5 w-5 text-accent" />
              <h3 className="mono text-lg font-bold">API KEY CREATED</h3>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span className="mono text-xs text-warning">
                This key will only be shown once. Copy it now.
              </span>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-bg-primary p-3">
              <code className="mono flex-1 break-all text-sm text-accent">
                {createdKey.key}
              </code>
              <button
                onClick={() => handleCopy(createdKey.key, `full-${createdKey.id}`)}
                className="shrink-0 rounded p-2 transition-colors hover:bg-bg-secondary hover:text-accent"
                title="Copy key"
              >
                {copied === `full-${createdKey.id}` ? (
                  <Check className="h-4 w-4 text-accent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="mono mb-4 text-xs text-text-secondary">
              Name: {createdKey.name} | Prefix: {createdKey.prefix}
            </div>

            <button
              onClick={() => setCreatedKey(null)}
              className="btn-primary mono w-full text-sm"
            >
              I HAVE COPIED THIS KEY -- DISMISS
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
