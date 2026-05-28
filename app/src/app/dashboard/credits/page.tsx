'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type BalanceResponse } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { BarChartComponent, generateCostData, DonutChart, generateModelData } from '@/components/ui/charts'
import {
  Wallet,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  History,
  Settings,
  Zap,
} from 'lucide-react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { formatCents } from '@/lib/utils'

interface CreditHistoryItem {
  id: string
  type: 'deposit' | 'usage' | 'refund'
  amount: number
  source?: string
  status: 'completed' | 'pending' | 'failed'
  createdAt: string
}

const AMOUNT_PRESETS = [10, 25, 50, 100, 250]

export default function CreditsPage() {
  const { isConnected, connectEvm } = useWallet()
  const toast = useToast()

  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [buyAmount, setBuyAmount] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<'usdc' | 'sol'>('usdc')
  const [processing, setProcessing] = useState(false)

  const [autoReload, setAutoReload] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [history, setHistory] = useState<CreditHistoryItem[]>([])

  const costData = useMemo(() => generateCostData(30), [])
  const modelData = useMemo(() => generateModelData(), [])

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const bal = await api.oma.getBalance()
      setBalance(bal)
      setHistory([
        { id: '1', type: 'deposit', amount: 5000, source: 'USDC(Base)', status: 'completed', createdAt: new Date(Date.now() - 86400000).toISOString() },
        { id: '2', type: 'usage', amount: -127, source: 'GPT-4o', status: 'completed', createdAt: new Date(Date.now() - 43200000).toISOString() },
        { id: '3', type: 'deposit', amount: 2500, source: 'USDC(Solana)', status: 'completed', createdAt: new Date(Date.now() - 172800000).toISOString() },
        { id: '4', type: 'usage', amount: -89, source: 'Claude Sonnet', status: 'completed', createdAt: new Date(Date.now() - 259200000).toISOString() },
      ])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load credits data'
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isConnected) return
    fetchData(true)
  }, [isConnected, fetchData])

const handleBuyCredits = async () => {
    if (!buyAmount || parseFloat(buyAmount) <= 0) return;
    setProcessing(true);
    try {
      const amountCents = Math.round(parseFloat(buyAmount) * 100);
      const result = await api.oma.purchaseCredits(amountCents, selectedPayment);
      toast.success(`Successfully purchased ${result.creditsAdded} credits!`);
      setBuyAmount('');
      fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to process payment';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  }

  if (!isConnected) {
    return (
      <motion.div 
        className="flex min-h-[calc(100vh-4rem)] items-center justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center max-w-md px-4">
          <motion.div 
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--color-cyan)]/30 bg-gradient-to-br from-[var(--color-cyan)]/10 to-[var(--color-warning)]/10"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
          >
            <Wallet className="h-10 w-10 text-[var(--color-cyan)]" />
          </motion.div>
          <h2 className="mb-3 text-2xl font-bold">Connect Your Wallet</h2>
          <p className="mb-6 text-[var(--color-text-muted)]">Connect your wallet to view your credit balance and history.</p>
          <motion.button
            onClick={() => connectEvm()}
            className="btn-primary flex items-center gap-2 mx-auto py-3 px-8"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap className="h-4 w-4" />
            Connect Wallet
          </motion.button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="mx-auto max-w-6xl px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div 
        className="mb-8 flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-cyan)]">Dashboard</Link>
            <span className="text-[var(--color-text-muted)]">/</span>
            <span className="text-sm text-white">Credits</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Credits</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Balance, purchases, and usage breakdown</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-secondary flex items-center gap-2 py-2 px-4"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Settings className="h-4 w-4" />
            Settings
          </motion.button>
          <motion.button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2 py-2 px-4"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div 
            className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-error)]" />
            <span className="text-sm text-[var(--color-error)]">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <motion.div
          className="lg:col-span-2 rounded-2xl border border-[var(--color-border)]/50 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Current Balance</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Available credits</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-5xl font-bold tracking-tight text-white mb-1">
              {loading && !balance ? (
                <span className="text-[var(--color-text-muted)]">$0.00</span>
              ) : (
                <AnimatedNumber value={parseFloat(formatCents(balance?.balanceCents ?? '0'))} />
              )}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">
              {balance ? `${formatCents(balance.totalDepositedCents)} total deposited` : 'No deposits'}
            </div>
          </div>

          {balance && parseFloat(formatCents(balance.balanceCents)) > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-[var(--color-cyan)]/5 border border-[var(--color-cyan)]/20">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Last activity</span>
                <span className="text-[var(--color-cyan)]">{balance.lastActivityAt ? new Date(balance.lastActivityAt).toLocaleString() : 'N/A'}</span>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Buy Credits</h2>
              <p className="text-xs text-[var(--color-text-muted)]">USDC or SOL payment</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Amount (USD)</label>
              <input
                type="text"
                value={buyAmount}
                onChange={(e) => {
                  if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setBuyAmount(e.target.value)
                }}
                placeholder="0.00"
                className="w-full text-2xl font-bold bg-[var(--color-void)] border border-[var(--color-border)] rounded-xl px-4 py-3 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-cyan)]/50"
              />
            </div>

            <div className="flex gap-2">
              {AMOUNT_PRESETS.map((preset) => (
                <motion.button
                  key={preset}
                  onClick={() => setBuyAmount(preset.toString())}
                  className="flex-1 rounded-lg border border-[var(--color-border)] py-2 text-sm font-medium hover:bg-[var(--color-surface-elevated)] transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  ${preset}
                </motion.button>
              ))}
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  onClick={() => setSelectedPayment('usdc')}
                  className={`flex items-center gap-2 rounded-xl border py-3 px-4 transition-all ${
                    selectedPayment === 'usdc' 
                      ? 'border-[var(--color-cyan)] bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]' 
                      : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:brightness-125'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[var(--color-cyan)] to-[var(--color-blue)]" />
                  USDC
                </motion.button>
                <motion.button
                  onClick={() => setSelectedPayment('sol')}
                  className={`flex items-center gap-2 rounded-xl border py-3 px-4 transition-all ${
                    selectedPayment === 'sol' 
                      ? 'border-[var(--color-cyan)] bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]' 
                      : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:brightness-125'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[var(--color-violet)] to-[var(--color-violet)]" />
                  SOL
                </motion.button>
              </div>
            </div>

            <motion.button
              onClick={handleBuyCredits}
              disabled={!buyAmount || parseFloat(buyAmount) <= 0 || processing}
              className="btn-primary w-full py-4 disabled:opacity-40 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {processing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Zap className="h-5 w-5 mr-2" />
                  Buy ${buyAmount || '0'} Credits
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="mb-8 rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Auto-Reload Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Auto-reload credits</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Automatically purchase credits when balance falls below threshold</p>
                </div>
                <motion.button
                  onClick={async () => {
                    try {
                      await api.oma.updateAutoReload({ enabled: !autoReload });
                      setAutoReload(!autoReload);
                      toast.success(`Auto-reload ${!autoReload ? 'enabled' : 'disabled'}`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to update auto-reload');
                    }
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    autoReload ? 'bg-[var(--color-cyan)]' : 'bg-[var(--color-surface-elevated)]'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${
                    autoReload ? 'translate-x-5' : ''
                  }`} />
                </motion.button>
              </div>
              {autoReload && (
                <div className="space-y-3 pt-3 border-t border-[var(--color-border)]/50">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Threshold ($)</label>
                    <input
                      type="text"
                      placeholder="10.00"
                      className="w-full text-sm font-medium bg-[var(--color-void)] border border-[var(--color-border)] rounded-lg px-4 py-2 focus:outline-none focus:border-[var(--color-cyan)]/50"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Reload amount ($)</label>
                    <input
                      type="text"
                      placeholder="50.00"
                      className="w-full text-sm font-medium bg-[var(--color-void)] border border-[var(--color-border)] rounded-lg px-4 py-2 focus:outline-none focus:border-[var(--color-cyan)]/50"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div
          className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">30-Day Costs</h3>
            <div className="text-sm text-[var(--color-text-muted)]">${costData.reduce((sum, d) => sum + d.cost, 0).toFixed(2)} total</div>
          </div>
          <BarChartComponent data={costData} />
        </motion.div>

        <motion.div
          className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Usage by Model</h3>
          </div>
          <DonutChart data={modelData} />
          <div className="mt-4 flex flex-wrap gap-3">
            {modelData.map((model) => (
              <div key={model.name} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: model.color }} />
                <span className="text-xs text-[var(--color-text-muted)]">{model.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--color-border)]/50">
          <History className="h-5 w-5 text-[var(--color-cyan)]" />
          <h3 className="text-lg font-semibold text-white">Credit History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--color-border)]/50 bg-[var(--color-surface-elevated)]">
                <th className="px-6 py-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Source</th>
                <th className="px-6 py-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--color-cyan)]" />
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-[var(--color-text-muted)]">
                    No credit history yet
                  </td>
                </tr>
              ) : (
                history.map((item, i) => (
                  <motion.tr
                    key={item.id}
                    className="border-b border-[var(--color-border)]/30 transition-colors hover:bg-[var(--color-surface-elevated)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 text-sm ${
                        item.type === 'deposit' ? 'text-[var(--color-green)]' : 
                        item.type === 'refund' ? 'text-[var(--color-cyan)]' : 'text-[var(--color-warning)]'
                      }`}>
                        {item.type === 'deposit' ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : item.type === 'refund' ? (
                          <RefreshCw className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        <span className="capitalize">{item.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{item.source || '-'}</td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <span className={item.amount > 0 ? 'text-[var(--color-green)]' : 'text-[var(--color-warning)]'}>
                        {item.amount > 0 ? '+' : ''}{item.amount > 0 ? '$' : '-$'}{Math.abs(item.amount / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.status === 'completed' ? 'bg-[var(--color-green)]/10 text-[var(--color-green)]' :
                        item.status === 'pending' ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' :
                        'bg-[var(--color-error)]/10 text-[var(--color-error)]'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}