'use client'

import { useState, useEffect } from 'react'
import { Gauge, Plus, Trash2, RefreshCw, Save, AlertTriangle, Key, Terminal } from 'lucide-react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'

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
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border border-[var(--color-amber)] border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-[var(--color-amber)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-syne tracking-tight text-[var(--color-text-bright)]">Rate Limits</h1>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">Configure API rate limits</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchConfig}
            className="flex items-center gap-2 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-bright)] transition-colors text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </motion.button>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-[var(--color-error)]"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-mono">{error}</span>
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded border border-[var(--color-success)]/30 bg-[var(--color-success-dim)] text-[var(--color-success)]"
        >
          <Save className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-mono">{success}</span>
        </motion.div>
      )}

      <div className="flex gap-0.5 border-b border-[var(--color-border)]">
        <button
          onClick={() => setActiveTab('tiers')}
          className={`px-4 py-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'tiers'
              ? 'text-[var(--color-cyan)] border-[var(--color-cyan)] bg-[var(--color-accent-dim)]/30'
              : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Gauge className="w-3.5 h-3.5 inline mr-1.5" />
          Tiers
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'overrides'
              ? 'text-[var(--color-cyan)] border-[var(--color-cyan)] bg-[var(--color-accent-dim)]/30'
              : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Key className="w-3.5 h-3.5 inline mr-1.5" />
          Overrides ({overrides.length})
        </button>
      </div>

      {activeTab === 'tiers' && (
        <div className="space-y-6">
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Rate Limit Tiers</h2>
              <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1">RPM = Requests per minute, TPM = Tokens per minute</p>
            </div>
            <div className="divide-y divide-[var(--color-border)]/50">
              {DEFAULT_TIERS.map((tierId) => {
                const info = TIER_INFO[tierId]
                const tier = editTiers[tierId] || { rpm: 60, tpm: 10000 }
                return (
                  <div key={tierId} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium text-[var(--color-text-bright)] text-sm">{info.name}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{info.description}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">RPM</label>
                        <input
                          type="number"
                          min={1}
                          value={tier.rpm}
                          onChange={(e) => setEditTiers({ ...editTiers, [tierId]: { ...tier, rpm: parseInt(e.target.value) || 60 } })}
                          className="w-full max-w-[160px] px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] font-mono text-sm focus:outline-none focus:border-[var(--color-accent)]/50 focus:ring-1 focus:ring-[var(--color-accent)]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">TPM</label>
                        <input
                          type="number"
                          min={1}
                          value={tier.tpm}
                          onChange={(e) => setEditTiers({ ...editTiers, [tierId]: { ...tier, tpm: parseInt(e.target.value) || 10000 } })}
                          className="w-full max-w-[160px] px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] font-mono text-sm focus:outline-none focus:border-[var(--color-accent)]/50 focus:ring-1 focus:ring-[var(--color-accent)]/20"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleSaveTiers}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-50 transition-colors text-sm font-mono"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </motion.button>
        </div>
      )}

      {activeTab === 'overrides' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-mono">
              <span>{overrides.length} active overrides</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowOverrideForm(!showOverrideForm)}
              className="flex items-center gap-2 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm font-mono transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Override
            </motion.button>
          </div>

          {showOverrideForm && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4"
            >
              <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Create Override</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Target Type</label>
                  <select
                    value={overrideForm.targetType}
                    onChange={(e) => setOverrideForm({ ...overrideForm, targetType: e.target.value as 'user' | 'api_key' })}
                    className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-accent)]/50"
                  >
                    <option value="user">User</option>
                    <option value="api_key">API Key</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Target ID</label>
                  <input
                    type="text"
                    value={overrideForm.targetId}
                    onChange={(e) => setOverrideForm({ ...overrideForm, targetId: e.target.value })}
                    placeholder="Enter user ID or API key ID"
                    className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">RPM (optional)</label>
                  <input
                    type="number"
                    min={1}
                    value={overrideForm.rpm}
                    onChange={(e) => setOverrideForm({ ...overrideForm, rpm: e.target.value })}
                    placeholder="No limit"
                    className="w-full max-w-[160px] px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]/50 focus:ring-1 focus:ring-[var(--color-accent)]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">TPM (optional)</label>
                  <input
                    type="number"
                    min={1}
                    value={overrideForm.tpm}
                    onChange={(e) => setOverrideForm({ ...overrideForm, tpm: e.target.value })}
                    placeholder="No limit"
                    className="w-full max-w-[160px] px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]/50 focus:ring-1 focus:ring-[var(--color-accent)]/20"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Expires At (optional)</label>
                  <input
                    type="datetime-local"
                    value={overrideForm.expiresAt}
                    onChange={(e) => setOverrideForm({ ...overrideForm, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]/50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleCreateOverride}
                  disabled={saving}
                  className="px-4 py-2 rounded border border-[var(--color-success)]/30 bg-[var(--color-success-dim)] text-[var(--color-success)] hover:bg-[var(--color-success)]/20 disabled:opacity-50 text-sm font-mono transition-colors"
                >
                  {saving ? 'Creating...' : 'Create Override'}
                </motion.button>
                <button
                  onClick={() => setShowOverrideForm(false)}
                  className="px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm font-mono transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Target</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Type</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">RPM</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">TPM</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Expires</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Created</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]"></th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((override) => (
                    <tr key={override.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface)]/50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-[var(--color-text-secondary)] truncate max-w-[150px] block">{override.targetId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                          override.targetType === 'user' ? 'bg-[var(--color-blue)]/10 text-[var(--color-blue)]' : 'bg-[var(--color-violet)]/10 text-[var(--color-violet)]'
                        }`}>
                          {override.targetType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-text-muted)]">{override.rpm || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-text-muted)]">{override.tpm || '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs">
                        {override.expiresAt ? format(new Date(override.expiresAt), 'MMM d, yyyy') : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs">
                        {format(new Date(override.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteOverride(override.id)}
                          className="p-1.5 rounded hover:bg-[var(--color-error)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {overrides.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)] font-mono">No overrides configured</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}