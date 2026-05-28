'use client'

import { useState, useEffect } from 'react'
import { Calculator, RefreshCw, Save, AlertTriangle, Terminal } from 'lucide-react'
import { motion } from 'framer-motion'

type FeeConfig = {
  providers: Record<string, { markupPercent: number }>
}

type ProviderInfo = {
  id: string
  name: string
  description: string
}

const PROVIDERS: ProviderInfo[] = [
  { id: 'venice', name: 'Venice AI', description: 'Primary provider with advanced models' },
  { id: 'openrouter', name: 'OpenRouter', description: 'Access to 100+ models' },
  { id: 'together', name: 'Together AI', description: 'Open source models' },
  { id: 'deepinfra', name: 'DeepInfra', description: 'Fast inference at low cost' },
  { id: 'litellm', name: 'LiteLLM', description: 'Unified API for multiple providers' },
  { id: 'antseed', name: 'AntSeed', description: 'Privacy-focused inference' },
  { id: 'tinyfish', name: 'TinyFish', description: 'Efficient small models' },
]

export default function AdminFeesPage() {
  const [_config, setConfig] = useState<FeeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [editValues, setEditValues] = useState<Record<string, number>>({})
  const [calculatorInput, setCalculatorInput] = useState({
    baseCost: 0.01,
    markup: 10,
  })

  const fetchConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/config/fees')
      const data = await res.json()
      if (data.config) {
        setConfig(data.config)
        const values: Record<string, number> = {}
        for (const [key, val] of Object.entries(data.config.providers)) {
          values[key] = (val as { markupPercent: number }).markupPercent
        }
        setEditValues(values)
      }
    } catch (_err) {
      setError('Failed to fetch fee configuration')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const newConfig = { providers: {} }
      for (const [key, val] of Object.entries(editValues)) {
        (newConfig.providers as Record<string, { markupPercent: number }>)[key] = { markupPercent: val }
      }
      const res = await fetch('/api/admin/config/fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: newConfig }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error?.message || 'Failed to save')
      } else {
        setSuccess('Fee configuration saved successfully')
        setConfig(newConfig)
      }
    } catch (_err) {
      setError('Failed to save fee configuration')
    }
    setSaving(false)
  }

  const calculateMargin = () => {
    const base = calculatorInput.baseCost
    const markupMultiplier = 1 + calculatorInput.markup / 100
    const totalCost = base * markupMultiplier
    const margin = totalCost - base
    const marginPercent = (margin / base) * 100
    return { totalCost, margin, marginPercent }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border border-[var(--color-success)] border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-[var(--color-success)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-syne tracking-tight text-[var(--color-text-bright)]">Fee Configuration</h1>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">Manage provider markups</p>
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
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)] hover:bg-[var(--color-cyan)]/20 disabled:opacity-50 transition-colors text-sm font-mono"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Provider Markups</h2>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1">Set markup percentage per provider (5-200%)</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]/50">
            {PROVIDERS.map((provider) => (
              <div key={provider.id} className="px-4 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--color-text-bright)] text-sm">{provider.name}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{provider.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={editValues[provider.id] || 10}
                    onChange={(e) => setEditValues({ ...editValues, [provider.id]: parseInt(e.target.value) || 10 })}
                    className="w-24 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] text-right font-mono text-sm focus:outline-none focus:border-[var(--color-cyan)]/50 focus:ring-1 focus:ring-[var(--color-cyan)]/20"
                  />
                  <span className="text-[var(--color-text-muted)] font-mono w-6 text-right">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--color-cyan)]" />
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Margin Calculator</h2>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Base Cost ($)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={calculatorInput.baseCost}
                onChange={(e) => setCalculatorInput({ ...calculatorInput, baseCost: parseFloat(e.target.value) || 0 })}
                className="w-full max-w-[160px] px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] font-mono text-sm focus:outline-none focus:border-[var(--color-cyan)]/50 focus:ring-1 focus:ring-[var(--color-cyan)]/20"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Markup (%)</label>
              <input
                type="number"
                min={5}
                max={200}
                value={calculatorInput.markup}
                onChange={(e) => setCalculatorInput({ ...calculatorInput, markup: parseInt(e.target.value) || 10 })}
                className="w-full max-w-[160px] px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] font-mono text-sm focus:outline-none focus:border-[var(--color-cyan)]/50 focus:ring-1 focus:ring-[var(--color-cyan)]/20"
              />
            </div>
            <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Total Cost</span>
                <span className="font-mono text-[var(--color-text-bright)]">${calculateMargin().totalCost.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Margin</span>
                <span className="font-mono text-[var(--color-success)]">${calculateMargin().margin.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Margin %</span>
                <span className="font-mono text-[var(--color-cyan)]">{calculateMargin().marginPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">Quick Examples</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded border border-[var(--color-border)] bg-[var(--color-panel)]">
            <p className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">10% Markup</p>
            <p className="text-lg font-mono text-[var(--color-text-bright)]">$0.011 → $0.0121</p>
            <p className="text-[10px] text-[var(--color-success)] font-mono mt-1">+${(0.01 * 0.1).toFixed(4)} per call</p>
          </div>
          <div className="p-4 rounded border border-[var(--color-border)] bg-[var(--color-panel)]">
            <p className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">50% Markup</p>
            <p className="text-lg font-mono text-[var(--color-text-bright)]">$0.01 → $0.015</p>
            <p className="text-[10px] text-[var(--color-success)] font-mono mt-1">+${(0.01 * 0.5).toFixed(4)} per call</p>
          </div>
          <div className="p-4 rounded border border-[var(--color-border)] bg-[var(--color-panel)]">
            <p className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">100% Markup</p>
            <p className="text-lg font-mono text-[var(--color-text-bright)]">$0.01 → $0.02</p>
            <p className="text-[10px] text-[var(--color-success)] font-mono mt-1">+${(0.01 * 1).toFixed(4)} per call</p>
          </div>
        </div>
      </div>
    </div>
  )
}