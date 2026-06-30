'use client'

import { useState, useEffect, useCallback, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calculator, RefreshCw, Save, AlertTriangle, Terminal } from 'lucide-react'
import { m } from 'framer-motion'

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
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [editValues, setEditValues] = useState<Record<string, number>>({})
  const [calculatorInput, setCalculatorInput] = useState({
    baseCost: 0.01,
    markup: 10,
  })
  const _id = useId()

  const feesQuery = useQuery<FeeConfig>({
    queryKey: ['adminFeesConfig'],
    queryFn: async () => {
      const res = await fetch('/api/admin/config/fees')
      if (!res.ok) throw new Error('Failed to fetch fee configuration')
      const data = await res.json()
      if (data.config) {
        const values: Record<string, number> = {}
        for (const [key, val] of Object.entries(data.config.providers)) {
          values[key] = (val as { markupPercent: number }).markupPercent
        }
        setEditValues(values)
      }
      return data.config
    },
    staleTime: 30_000,
  })

  const saveMutation = useMutation({
    mutationFn: async (newConfig: FeeConfig) => {
      const res = await fetch('/api/admin/config/fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: newConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Failed to save')
      return newConfig
    },
    onSuccess: (newConfig) => {
      setSuccess('Fee configuration saved successfully')
      queryClient.setQueryData(['adminFeesConfig'], newConfig)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save fee configuration')
    },
  })

  const handleSave = useCallback(async () => {
    setError(null)
    setSuccess(null)
    const newConfig: FeeConfig = { providers: {} as FeeConfig['providers'] }
    for (const [key, val] of Object.entries(editValues)) {
      newConfig.providers[key] = { markupPercent: val }
    }
    saveMutation.mutate(newConfig)
  }, [editValues, saveMutation])

  const calculateMargin = () => {
    const base = calculatorInput.baseCost
    const markupMultiplier = 1 + calculatorInput.markup / 100
    const totalCost = base * markupMultiplier
    const margin = totalCost - base
    const marginPercent = (margin / base) * 100
    return { totalCost, margin, marginPercent }
  }

  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 4000)
      return () => clearTimeout(t)
    }
  }, [success, error])

  if (feesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <m.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border border-success border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded border border-success/30 bg-success/10 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-success" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-display tracking-tight text-text-bright">Fee Configuration</h1>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">Manage provider markups</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <m.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['adminFeesConfig'] })}
            className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text hover:border-border-bright transition-colors text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </m.button>
          <m.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors text-sm font-mono"
          >
            <Save className="w-3.5 h-3.5" />
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-panel">
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">Provider Markups</h2>
            <p className="text-[10px] text-text-muted font-mono mt-1">Set markup percentage per provider (5-200%)</p>
          </div>
          <div className="divide-y divide-border/50">
            {PROVIDERS.map((provider) => (
              <div key={provider.id} className="px-4 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-bright text-sm">{provider.name}</p>
                  <p className="text-[10px] text-text-muted">{provider.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label htmlFor={`${_id}-${provider.id}-markup`} className="sr-only">{provider.name} markup percent</label>
                  <input
                    id={`${_id}-${provider.id}-markup`}
                    type="number"
                    min={5}
                    max={200}
                    value={editValues[provider.id] || 10}
                    onChange={(e) => setEditValues({ ...editValues, [provider.id]: parseInt(e.target.value, 10) || 10 })}
                    className="w-24 px-3 py-2 rounded border border-border bg-panel text-text text-right font-mono text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                  />
                  <span className="text-text-muted font-mono w-6 text-right">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-panel">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">Margin Calculator</h2>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor={`${_id}-base`} className="block text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Base Cost ($)</label>
              <input
                id={`${_id}-base`}
                type="number"
                step="0.001"
                min="0"
                value={calculatorInput.baseCost}
                onChange={(e) => setCalculatorInput({ ...calculatorInput, baseCost: parseFloat(e.target.value) || 0 })}
                className="w-full sm:max-w-[160px] px-3 py-2 rounded border border-border bg-panel text-text font-mono text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
              />
            </div>
            <div>
              <label htmlFor={`${_id}-markup`} className="block text-[10px] text-text-muted font-mono uppercase tracking-wider mb-2">Markup (%)</label>
              <input
                id={`${_id}-markup`}
                type="number"
                min={5}
                max={200}
                value={calculatorInput.markup}
                onChange={(e) => setCalculatorInput({ ...calculatorInput, markup: parseInt(e.target.value, 10) || 10 })}
                className="w-full sm:max-w-[160px] px-3 py-2 rounded border border-border bg-panel text-text font-mono text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
              />
            </div>
            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-mono uppercase tracking-wider">Total Cost</span>
                <span className="font-mono text-text-bright">${calculateMargin().totalCost.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-mono uppercase tracking-wider">Margin</span>
                <span className="font-mono text-success">${calculateMargin().margin.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-mono uppercase tracking-wider">Margin %</span>
                <span className="font-mono text-accent">{calculateMargin().marginPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-5">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary mb-4">Quick Examples</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded border border-border bg-panel">
            <p className="text-xs text-text-muted font-mono uppercase tracking-wider mb-2">10% Markup</p>
            <p className="text-lg font-mono text-text-bright">$0.011 → $0.0121</p>
            <p className="text-[10px] text-success font-mono mt-1">+${(0.01 * 0.1).toFixed(4)} per call</p>
          </div>
          <div className="p-4 rounded border border-border bg-panel">
            <p className="text-xs text-text-muted font-mono uppercase tracking-wider mb-2">50% Markup</p>
            <p className="text-lg font-mono text-text-bright">$0.01 → $0.015</p>
            <p className="text-[10px] text-success font-mono mt-1">+${(0.01 * 0.5).toFixed(4)} per call</p>
          </div>
          <div className="p-4 rounded border border-border bg-panel">
            <p className="text-xs text-text-muted font-mono uppercase tracking-wider mb-2">100% Markup</p>
            <p className="text-lg font-mono text-text-bright">$0.01 → $0.02</p>
            <p className="text-[10px] text-success font-mono mt-1">+${(0.01 * 1).toFixed(4)} per call</p>
          </div>
        </div>
      </div>
    </div>
  )
}