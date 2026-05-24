'use client'

import { useState, useEffect } from 'react'
import { Gauge, Plus, Trash2, RefreshCw, Save, AlertTriangle, Clock, Key, User } from 'lucide-react'
import { format } from 'date-fns'

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

export default function AdminRateLimitsPage() {
  const [_config, setConfig] = useState<RateLimitConfig | null>(null)
  const [overrides, setOverrides] = useState<RateLimitOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'tiers' | 'overrides'>('tiers')

  const [editTiers, setEditTiers] = useState<Record<string, RateLimitTier>>({})

  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [overrideForm, setOverrideForm] = useState({
    targetType: 'user' as 'user' | 'api_key',
    targetId: '',
    rpm: '',
    tpm: '',
    expiresAt: '',
  })

  const fetchConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const [configRes, overridesRes] = await Promise.all([
        fetch('/api/admin/config/rate-limits'),
        fetch('/api/admin/rate-limit-overrides'),
      ])
      const [configData, overridesData] = await Promise.all([
        configRes.json(),
        overridesRes.json(),
      ])
      if (configData.config) {
        setConfig(configData.config)
        setEditTiers(configData.config.tiers)
      }
      if (overridesData.overrides) {
        setOverrides(overridesData.overrides)
      }
    } catch (_err) {
      setError('Failed to fetch rate limit configuration')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleSaveTiers = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/config/rate-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { tiers: editTiers } }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message || 'Failed to save')
      } else {
        setSuccess('Rate limit tiers saved successfully')
        setConfig({ tiers: editTiers })
      }
    } catch (_err) {
      setError('Failed to save rate limit configuration')
    }
    setSaving(false)
  }

  const handleCreateOverride = async () => {
    if (!overrideForm.targetId) {
      setError('Target ID is required')
      return
    }
    if (!overrideForm.rpm && !overrideForm.tpm) {
      setError('At least RPM or TPM must be set')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/rate-limit-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: overrideForm.targetType,
          targetId: overrideForm.targetId,
          rpm: overrideForm.rpm ? parseInt(overrideForm.rpm) : undefined,
          tpm: overrideForm.tpm ? parseInt(overrideForm.tpm) : undefined,
          expiresAt: overrideForm.expiresAt || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message || 'Failed to create override')
      } else {
        setSuccess('Rate limit override created successfully')
        setShowOverrideForm(false)
        setOverrideForm({ targetType: 'user', targetId: '', rpm: '', tpm: '', expiresAt: '' })
        fetchConfig()
      }
    } catch (_err) {
      setError('Failed to create rate limit override')
    }
    setSaving(false)
  }

  const handleDeleteOverride = async (id: string) => {
    if (!confirm('Delete this rate limit override?')) return

    try {
      const res = await fetch(`/api/admin/rate-limit-overrides?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || 'Failed to delete')
      } else {
        setOverrides(overrides.filter(o => o.id !== id))
        setSuccess('Override deleted successfully')
      }
    } catch (_err) {
      setError('Failed to delete rate limit override')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display">Rate Limits</h1>
            <p className="text-sm text-zinc-500">Configure API rate limits and overrides</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfig}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
          <Save className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="flex gap-1 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('tiers')}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'tiers'
              ? 'text-cyan-400 border-cyan-400'
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
        >
          <Gauge className="w-4 h-4 inline mr-2" />
          Tiers
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'overrides'
              ? 'text-cyan-400 border-cyan-400'
              : 'text-zinc-500 border-transparent hover:text-zinc-300'
          }`}
        >
          <Key className="w-4 h-4 inline mr-2" />
          Overrides ({overrides.length})
        </button>
      </div>

      {activeTab === 'tiers' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="font-medium text-white">Rate Limit Tiers</h2>
              <p className="text-xs text-zinc-500 mt-1">RPM = Requests per minute, TPM = Tokens per minute</p>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {DEFAULT_TIERS.map((tierId) => {
                const info = TIER_INFO[tierId]
                const tier = editTiers[tierId] || { rpm: 60, tpm: 10000 }
                return (
                  <div key={tierId} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium text-white">{info.name}</p>
                        <p className="text-xs text-zinc-500">{info.description}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-2">RPM</label>
                        <input
                          type="number"
                          min={1}
                          value={tier.rpm}
                          onChange={(e) => setEditTiers({
                            ...editTiers,
                            [tierId]: { ...editTiers[tierId], rpm: parseInt(e.target.value) || 1 }
                          })}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-2">TPM</label>
                        <input
                          type="number"
                          min={100}
                          value={tier.tpm}
                          onChange={(e) => setEditTiers({
                            ...editTiers,
                            [tierId]: { ...editTiers[tierId], tpm: parseInt(e.target.value) || 100 }
                          })}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleSaveTiers}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-zinc-900 font-medium hover:bg-cyan-400 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Tier Changes'}
          </button>
        </div>
      )}

      {activeTab === 'overrides' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Overrides allow setting custom limits for specific users or API keys
            </p>
            <button
              onClick={() => setShowOverrideForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-zinc-900 font-medium hover:bg-cyan-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Override
            </button>
          </div>

          {showOverrideForm && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
              <h3 className="font-medium text-white">Create Rate Limit Override</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-2">Target Type</label>
                  <select
                    value={overrideForm.targetType}
                    onChange={(e) => setOverrideForm({ ...overrideForm, targetType: e.target.value as 'user' | 'api_key' })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="user">User</option>
                    <option value="api_key">API Key</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-2">
                    {overrideForm.targetType === 'user' ? 'User ID (UUID)' : 'API Key ID (UUID)'}
                  </label>
                  <input
                    type="text"
                    value={overrideForm.targetId}
                    onChange={(e) => setOverrideForm({ ...overrideForm, targetId: e.target.value })}
                    placeholder="Enter UUID"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-2">RPM (optional)</label>
                  <input
                    type="number"
                    min={1}
                    value={overrideForm.rpm}
                    onChange={(e) => setOverrideForm({ ...overrideForm, rpm: e.target.value })}
                    placeholder="Requests per minute"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-2">TPM (optional)</label>
                  <input
                    type="number"
                    min={100}
                    value={overrideForm.tpm}
                    onChange={(e) => setOverrideForm({ ...overrideForm, tpm: e.target.value })}
                    placeholder="Tokens per minute"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-500 mb-2">Expires At (optional)</label>
                  <input
                    type="datetime-local"
                    value={overrideForm.expiresAt}
                    onChange={(e) => setOverrideForm({ ...overrideForm, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleCreateOverride}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-zinc-900 font-medium hover:bg-cyan-400 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Creating...' : 'Create Override'}
                </button>
                <button
                  onClick={() => setShowOverrideForm(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            {overrides.length === 0 ? (
              <div className="px-4 py-8 text-center text-zinc-500">
                No rate limit overrides configured
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-4 py-3 font-medium text-zinc-400">Target</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">RPM</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">TPM</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Expires</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Created</th>
                    <th className="px-4 py-3 font-medium text-zinc-400"></th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((override) => (
                    <tr key={override.id} className="border-b border-zinc-800/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {override.targetType === 'user' ? (
                            <User className="w-4 h-4 text-zinc-500" />
                          ) : (
                            <Key className="w-4 h-4 text-zinc-500" />
                          )}
                          <span className="text-white">{override.targetType}</span>
                          <span className="font-mono text-xs text-zinc-500">
                            {override.targetId.slice(0, 8)}...
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-cyan-400">
                        {override.rpm || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-cyan-400">
                        {override.tpm || '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {override.expiresAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(override.expiresAt), 'MMM d, yyyy HH:mm')}
                          </div>
                        ) : (
                          <span className="text-zinc-600">Never</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {format(new Date(override.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteOverride(override.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}