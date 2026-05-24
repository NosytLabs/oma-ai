'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Calculator, RefreshCw, Save, AlertTriangle } from 'lucide-react'

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
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display">Fee Configuration</h1>
            <p className="text-sm text-zinc-500">Manage provider markups and pricing</p>
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-zinc-900 font-medium hover:bg-cyan-400 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="font-medium text-white">Provider Markups</h2>
            <p className="text-xs text-zinc-500 mt-1">Set markup percentage per provider (5-200%)</p>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {PROVIDERS.map((provider) => (
              <div key={provider.id} className="px-4 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{provider.name}</p>
                  <p className="text-xs text-zinc-500">{provider.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={editValues[provider.id] || 10}
                    onChange={(e) => setEditValues({ ...editValues, [provider.id]: parseInt(e.target.value) || 10 })}
                    className="w-24 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-right font-mono focus:outline-none focus:border-cyan-500/50"
                  />
                  <span className="text-zinc-500 w-8">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" />
              <h2 className="font-medium text-white">Margin Calculator</h2>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Base Cost ($)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={calculatorInput.baseCost}
                onChange={(e) => setCalculatorInput({ ...calculatorInput, baseCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Markup (%)</label>
              <input
                type="number"
                min={5}
                max={200}
                value={calculatorInput.markup}
                onChange={(e) => setCalculatorInput({ ...calculatorInput, markup: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Total Cost</span>
                <span className="font-mono text-white">${calculateMargin().totalCost.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Margin</span>
                <span className="font-mono text-emerald-400">${calculateMargin().margin.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Margin %</span>
                <span className="font-mono text-cyan-400">{calculateMargin().marginPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="font-medium text-white mb-4">Quick Examples</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-zinc-800/50">
            <p className="text-sm text-zinc-400 mb-2">10% Markup</p>
            <p className="text-lg font-mono text-white">$0.011 → $0.0121</p>
            <p className="text-xs text-emerald-400 mt-1">+$0.001 per call</p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/50">
            <p className="text-sm text-zinc-400 mb-2">50% Markup</p>
            <p className="text-lg font-mono text-white">$0.01 → $0.015</p>
            <p className="text-xs text-emerald-400 mt-1">+$0.005 per call</p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/50">
            <p className="text-sm text-zinc-400 mb-2">100% Markup</p>
            <p className="text-lg font-mono text-white">$0.01 → $0.02</p>
            <p className="text-xs text-emerald-400 mt-1">+$0.01 per call</p>
          </div>
        </div>
      </div>
    </div>
  )
}