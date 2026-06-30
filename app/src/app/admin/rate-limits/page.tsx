'use client'

import { useState, useEffect, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Gauge, Plus, Trash2, RefreshCw, Save, AlertTriangle, Key, Terminal } from 'lucide-react'
import { format } from 'date-fns'
import { m } from 'framer-motion'

type RateLimitTier = {
  rpm: number
  tpm: number
}

type RateLimitConfig = {
  tiers: Record<string, RateLimitTier>
}

type RateLimitOverride = {
  id: string
  targetType: string
  targetId: string
  rpm: number | null
  tpm: number | null
  expiresAt: string | null
  createdAt: string
}

const DEFAULT_TIERS = ['free', 'basic', 'pro', 'enterprise']

const TIER_INFO: Record<string, { name: string; description: string }> = {
  free: { name: 'Free', description: 'Default tier for new users' },
  basic: { name: 'Basic', description: 'Paid tier with moderate limits' },
  pro: { name: 'Pro', description: 'High volume users' },
  enterprise: { name: 'Enterprise', description: 'Maximum performance' },
}

async function fetchRateLimitsConfig(): Promise<RateLimitConfig> {
  const res = await fetch('/api/admin/config/rate-limits')
  if (!res.ok) throw new Error('Failed to fetch rate limit configuration')
  const data = await res.json()
  return data.config as RateLimitConfig
}

async function fetchRateLimitOverrides(): Promise<RateLimitOverride[]> {
  const res = await fetch('/api/admin/rate-limit-overrides')
  if (!res.ok) throw new Error('Failed to fetch rate limit overrides')
  const data = await res.json()
  return (data.overrides as RateLimitOverride[]) ?? []
}

export default function AdminRateLimitsPage() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'tiers' | 'overrides'>('tiers')
  const [pendingDelete, setPendingDelete] = useState<RateLimitOverride | null>(null)

  const [editTiers, setEditTiers] = useState<Record<string, RateLimitTier>>({})
  const _id = useId()

  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [overrideForm, setOverrideForm] = useState({
    targetType: 'user' as 'user' | 'api_key',
    targetId: '',
    rpm: '',
    tpm: '',
    expiresAt: '',
  })

  useEffect(() => {
    if (!success && !error) return
    const t = setTimeout(() => {
      setSuccess(null)
      setError(null)
    }, 4000)
    return () => clearTimeout(t)
  }, [success, error])

  const configQuery = useQuery({
    queryKey: ['adminRateLimitsConfig'],
    queryFn: fetchRateLimitsConfig,
    staleTime: 30_000,
  })

  const overridesQuery = useQuery({
    queryKey: ['adminRateLimitOverrides'],
    queryFn: fetchRateLimitOverrides,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (configQuery.data?.tiers) {
      setEditTiers(configQuery.data.tiers)
    }
  }, [configQuery.data])

  const saveTiersMutation = useMutation({
    mutationFn: async (tiers: Record<string, RateLimitTier>) => {
      const res = await fetch('/api/admin/config/rate-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { tiers } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed to save')
      return { tiers }
    },
    onSuccess: ({ tiers }) => {
      queryClient.setQueryData<RateLimitConfig>(['adminRateLimitsConfig'], { tiers })
      setSuccess('Rate limit tiers saved successfully')
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to save rate limit configuration')
    },
  })

  const handleSaveTiers = () => {
    saveTiersMutation.mutate(editTiers)
  }

  const createOverrideMutation = useMutation({
    mutationFn: async (payload: {
      targetType: 'user' | 'api_key'
      targetId: string
      rpm?: number
      tpm?: number
      expiresAt?: string
    }) => {
      const res = await fetch('/api/admin/rate-limit-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create override')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRateLimitOverrides'] })
      setSuccess('Rate limit override created successfully')
      setShowOverrideForm(false)
      setOverrideForm({ targetType: 'user', targetId: '', rpm: '', tpm: '', expiresAt: '' })
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create rate limit override')
    },
  })

  const handleCreateOverride = () => {
    if (!overrideForm.targetId) {
      setError('Target ID is required')
      return
    }
    if (!overrideForm.rpm && !overrideForm.tpm) {
      setError('At least RPM or TPM must be set')
      return
    }
    createOverrideMutation.mutate({
      targetType: overrideForm.targetType,
      targetId: overrideForm.targetId,
      rpm: overrideForm.rpm ? parseInt(overrideForm.rpm, 10) : undefined,
      tpm: overrideForm.tpm ? parseInt(overrideForm.tpm, 10) : undefined,
      expiresAt: overrideForm.expiresAt || undefined,
    })
  }

  const deleteOverrideMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/rate-limit-overrides?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed to delete')
      return id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<RateLimitOverride[]>(['adminRateLimitOverrides'], (prev) =>
        (prev ?? []).filter((o) => o.id !== id)
      )
      setSuccess('Override deleted successfully')
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to delete rate limit override')
    },
  })

  const handleDeleteOverride = (override: RateLimitOverride) => {
    setPendingDelete(override)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteOverrideMutation.mutate(pendingDelete.id)
    setPendingDelete(null)
  }

  const overrides = overridesQuery.data ?? []
  const loading = configQuery.isLoading || overridesQuery.isLoading
  const saving =
    saveTiersMutation.isPending ||
    createOverrideMutation.isPending ||
    deleteOverrideMutation.isPending

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <m.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border border-amber border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded border border-amber/30 bg-amber/10 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-amber" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display tracking-tight text-text-bright">Rate Limits</h1>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">Configure API rate limits</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <m.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['adminRateLimitsConfig'] })
              queryClient.invalidateQueries({ queryKey: ['adminRateLimitOverrides'] })
            }}
            aria-label="Refresh rate limits"
            className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text hover:border-border-bright transition-colors text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </m.button>
        </div>
      </div>

      {error && (
        <m.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded border border-error/30 bg-error/10 text-error"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-mono">{error}</span>
        </m.div>
      )}

      {success && (
        <m.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded border border-success/30 bg-success-dim text-success"
        >
          <Save className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-mono">{success}</span>
        </m.div>
      )}

      <div className="flex gap-0.5 border-b border-border" role="tablist">
        <button type="button"
          role="tab"
          aria-selected={activeTab === 'tiers'}
          onClick={() => setActiveTab('tiers')}
          className={`px-4 py-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'tiers'
              ? 'text-accent border-accent bg-accent-dim/30'
              : 'text-text-muted border-transparent hover:text-text-secondary'
          }`}
        >
          <Gauge className="w-3.5 h-3.5 inline mr-1.5" />
          Tiers
        </button>
        <button type="button"
          role="tab"
          aria-selected={activeTab === 'overrides'}
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'overrides'
              ? 'text-accent border-accent bg-accent-dim/30'
              : 'text-text-muted border-transparent hover:text-text-secondary'
          }`}
        >
          <Key className="w-3.5 h-3.5 inline mr-1.5" />
          Overrides ({overrides.length})
        </button>
      </div>

      {activeTab === 'tiers' && (
        <div className="space-y-6">
          <div className="rounded border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-panel">
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">Rate Limit Tiers</h2>
              <p className="text-[10px] text-text-muted font-mono mt-1">RPM = Requests per minute, TPM = Tokens per minute</p>
            </div>
            <div className="divide-y divide-border/50">
              {DEFAULT_TIERS.map((tierId) => {
                const info = TIER_INFO[tierId]
                const tier = editTiers[tierId] || { rpm: 60, tpm: 10000 }
                return (
                  <div key={tierId} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium text-text-bright text-sm">{info.name}</p>
                        <p className="text-[10px] text-text-muted">{info.description}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor={`${_id}-${tierId}-rpm`} className="block text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">RPM</label>
                        <input
                          id={`${_id}-${tierId}-rpm`}
                          type="number"
                          min={1}
                          value={tier.rpm}
                          onChange={(e) => setEditTiers({ ...editTiers, [tierId]: { ...tier, rpm: parseInt(e.target.value, 10) || 60 } })}
                          className="w-full sm:max-w-[160px] px-3 py-2 rounded border border-border bg-panel text-text font-mono text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                        />
                      </div>
                      <div>
                        <label htmlFor={`${_id}-${tierId}-tpm`} className="block text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">TPM</label>
                        <input
                          id={`${_id}-${tierId}-tpm`}
                          type="number"
                          min={1}
                          value={tier.tpm}
                          onChange={(e) => setEditTiers({ ...editTiers, [tierId]: { ...tier, tpm: parseInt(e.target.value, 10) || 10000 } })}
                          className="w-full sm:max-w-[160px] px-3 py-2 rounded border border-border bg-panel text-text font-mono text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <m.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleSaveTiers}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded border border-accent/30 bg-accent-dim text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors text-sm font-mono"
          >
            <Save className="w-3.5 h-3.5" />
            {saveTiersMutation.isPending ? 'Saving...' : 'Save Changes'}
          </m.button>
        </div>
      )}

      {activeTab === 'overrides' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
              <span>{overrides.length} active overrides</span>
            </div>
            <m.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowOverrideForm(!showOverrideForm)}
              className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text text-sm font-mono transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Override
            </m.button>
          </div>

          {showOverrideForm && (
            <m.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded border border-border bg-surface p-5 space-y-4"
            >
              <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">Create Override</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`${_id}-target-type`} className="block text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Target Type</label>
                  <select
                    id={`${_id}-target-type`}
                    value={overrideForm.targetType}
                    onChange={(e) => setOverrideForm({ ...overrideForm, targetType: e.target.value as 'user' | 'api_key' })}
                    className="w-full px-3 py-2 rounded border border-border bg-panel text-text text-sm focus:outline-none focus:border-accent/50"
                  >
                    <option value="user">User</option>
                    <option value="api_key">API Key</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`${_id}-target-id`} className="block text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Target ID</label>
                  <input
                    id={`${_id}-target-id`}
                    type="text"
                    autoComplete="off"
                    value={overrideForm.targetId}
                    onChange={(e) => setOverrideForm({ ...overrideForm, targetId: e.target.value })}
                    placeholder="Enter user ID or API key ID"
                    className="w-full px-3 py-2 rounded border border-border bg-panel text-text text-sm font-mono focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label htmlFor={`${_id}-override-rpm`} className="block text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">RPM (optional)</label>
                  <input
                    id={`${_id}-override-rpm`}
                    type="number"
                    min={1}
                    value={overrideForm.rpm}
                    onChange={(e) => setOverrideForm({ ...overrideForm, rpm: e.target.value })}
                    placeholder="No limit"
                    className="w-full sm:max-w-[160px] px-3 py-2 rounded border border-border bg-panel text-text text-sm font-mono focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label htmlFor={`${_id}-override-tpm`} className="block text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">TPM (optional)</label>
                  <input
                    id={`${_id}-override-tpm`}
                    type="number"
                    min={1}
                    value={overrideForm.tpm}
                    onChange={(e) => setOverrideForm({ ...overrideForm, tpm: e.target.value })}
                    placeholder="No limit"
                    className="w-full sm:max-w-[160px] px-3 py-2 rounded border border-border bg-panel text-text text-sm font-mono focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor={`${_id}-expires`} className="block text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Expires At (optional)</label>
                  <input
                    id={`${_id}-expires`}
                    type="datetime-local"
                    autoComplete="off"
                    value={overrideForm.expiresAt}
                    onChange={(e) => setOverrideForm({ ...overrideForm, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-border bg-panel text-text text-sm font-mono focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <m.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleCreateOverride}
                  disabled={saving}
                  className="px-4 py-2 rounded border border-success/30 bg-success-dim text-success hover:bg-success/20 disabled:opacity-50 text-sm font-mono transition-colors"
                >
                  {createOverrideMutation.isPending ? 'Creating...' : 'Create Override'}
                </m.button>
                <button type="button"
                  onClick={() => setShowOverrideForm(false)}
                  className="px-4 py-2 rounded border border-border bg-surface text-text-muted hover:text-text text-sm font-mono transition-colors"
                >
                  Cancel
                </button>
              </div>
            </m.div>
          )}

          <div className="rounded border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-panel">
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Target</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Type</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">RPM</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">TPM</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Expires</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Created</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((override) => (
                    <tr key={override.id} className="border-b border-border/50 hover:bg-surface/50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-text-secondary truncate max-w-[150px] block">{override.targetId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                          override.targetType === 'user' ? 'bg-blue/10 text-blue' : 'bg-violet/10 text-violet'
                        }`}>
                          {override.targetType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-text-muted">{override.rpm || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-text-muted">{override.tpm || '—'}</td>
                      <td className="px-4 py-3 text-text-muted font-mono text-xs">
                        {override.expiresAt ? format(new Date(override.expiresAt), 'MMM d, yyyy') : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-text-muted font-mono text-xs">
                        {format(new Date(override.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <button type="button"
                          onClick={() => handleDeleteOverride(override)}
                          aria-label={`Delete override for ${override.targetId}`}
                          className="p-1.5 rounded hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {overrides.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-text-muted font-mono">No overrides configured</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 backdrop-blur-sm"
          onClick={() => setPendingDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-border max-w-md w-full mx-4 p-6"
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <div>
                <h2
                  id="delete-confirm-title"
                  className="text-sm font-mono uppercase tracking-widest text-text-bright mb-1"
                >
                  Delete rate limit override
                </h2>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  Remove the override for{' '}
                  <span className="font-mono text-text-bright">
                    {pendingDelete.targetType}:{pendingDelete.targetId}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-text-muted hover:text-text-bright border border-border hover:border-text-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteOverrideMutation.isPending}
                className="px-3 py-1.5 text-xs font-mono uppercase tracking-widest bg-error text-text-bright hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleteOverrideMutation.isPending ? 'Deleting…' : 'Delete override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
