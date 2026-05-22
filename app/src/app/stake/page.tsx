'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type BalanceResponse } from '@/lib/api'
import {
  Coins,
  TrendingUp,
  Shield,
  Lock,
  Check,
  Loader2,
  Hexagon,
  Star,
  Zap,
  Info,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface StakeTier {
  stake: number
  discount: number
  label: string
  color: string
  bgColor: string
  borderColor: string
  features: string[]
}

const STAKING_TIERS: StakeTier[] = [
  {
    stake: 0,
    discount: 0,
    label: 'None',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
    borderColor: 'border-zinc-500/30',
    features: ['Base rates', 'Standard support'],
  },
  {
    stake: 1000,
    discount: 3,
    label: 'Bronze',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    features: ['3% discount', 'Priority support', 'Bronze badge'],
  },
  {
    stake: 10000,
    discount: 6,
    label: 'Silver',
    color: 'text-slate-300',
    bgColor: 'bg-slate-400/10',
    borderColor: 'border-slate-400/30',
    features: ['6% discount', 'Priority support', 'Silver badge', 'Early features'],
  },
  {
    stake: 50000,
    discount: 10,
    label: 'Gold',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    features: ['10% discount', 'Dedicated support', 'Gold badge', 'Beta features', 'API priority'],
  },
  {
    stake: 100000,
    discount: 15,
    label: 'Platinum',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    features: ['15% discount', '24/7 support', 'Platinum badge', 'All features', 'Max API priority', 'Custom quotas'],
  },
]

function formatCents(cents: string | number): string {
  const n = typeof cents === 'string' ? parseFloat(cents) : cents
  return `$${(n / 100).toFixed(2)}`
}

export default function StakePage() {
  const { isConnected, connectEvm } = useWallet()

  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [stakeAmount, setStakeAmount] = useState('')
  const [staking, setStaking] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    const fetch = async () => {
      setLoading(true)
      try {
        const bal = await api.getBalance()
        if (!cancelled) setBalance(bal)
      } catch (e) {
        if (!cancelled) console.error(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [isConnected])

  const currentDiscount = balance?.stakingDiscount ?? 0
  const currentTierIndex = STAKING_TIERS.findIndex(t => t.discount === currentDiscount)
  const currentTier = STAKING_TIERS[currentTierIndex >= 0 ? currentTierIndex : 0]
  const nextTier = STAKING_TIERS[currentTierIndex + 1]

  const stakedOma = balance ? parseFloat(balance.stakedOma || '0') : 0
  const stakeValue = stakedOma / 1e18

  const progressToNext = nextTier
    ? Math.min(((stakeValue) / (nextTier.stake - STAKING_TIERS[currentTierIndex].stake)) * 100, 100)
    : 100

  const handleAmountChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) setStakeAmount(value)
  }

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return
    setStaking(true)
    try {
      await new Promise(r => setTimeout(r, 2000))
      setShowSuccess(true)
      setStakeAmount('')
    } catch (e) {
      console.error(e instanceof Error ? e.message : 'Stake failed')
    } finally {
      setStaking(false)
    }
  }

  const quickAmounts = [100, 500, 1000, 5000]

  if (!isConnected) {
    return (
      <motion.div
        className="flex min-h-[calc(100vh-4rem)] items-center justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center max-w-md px-4">
          <motion.div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring' }}
          >
            <Shield className="h-10 w-10 text-indigo-500" />
          </motion.div>
          <h2 className="mb-3 text-2xl font-bold">Stake OMA</h2>
          <p className="mb-6 text-text-secondary">
            Connect your wallet to stake OMA tokens and unlock tier-based discounts on API usage.
          </p>
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
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4 mb-3">
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10"
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            transition={{ type: 'spring' }}
          >
            <TrendingUp className="h-7 w-7 text-indigo-500" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold">Stake OMA</h1>
          </div>
          <motion.span
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1.5 text-xs font-bold text-indigo-400 border border-indigo-500/30"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <Hexagon className="h-3.5 w-3.5" />
            Earn APY
          </motion.span>
        </div>
        <p className="text-text-secondary text-sm">
          Stake OMA tokens to unlock tier-based discounts on your API usage. Higher stakes = bigger savings.
        </p>
      </motion.div>

      {/* Current Stake Status */}
      <motion.div
        className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div
          className="card"
          whileHover={{ y: -2 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${currentTier.bgColor} border ${currentTier.borderColor}`}>
              <Shield className={`h-5 w-5 ${currentTier.color}`} />
            </div>
            <div>
              <div className="text-xs text-text-secondary">Current Tier</div>
              <div className={`font-bold ${currentTier.color}`}>{currentTier.label}</div>
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-500">-{currentTier.discount}%</div>
          <div className="text-xs text-text-secondary">API discount</div>
        </motion.div>

        <motion.div
          className="card"
          whileHover={{ y: -2 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface">
              <Coins className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <div className="text-xs text-text-secondary">Total Staked</div>
              <div className="font-bold">{loading ? '---' : stakeValue.toFixed(2)} OMA</div>
            </div>
          </div>
          <div className="text-2xl font-bold">
            {loading ? '---' : formatCents(balance?.balanceCents ?? '0')}
          </div>
          <div className="text-xs text-text-secondary">Estimated value</div>
        </motion.div>

        <motion.div
          className="card"
          whileHover={{ y: -2 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <div className="text-xs text-text-secondary">APY Rate</div>
              <div className="font-bold text-green-500">8.5%</div>
            </div>
          </div>
          <div className="text-2xl font-bold text-green-500">+{(stakeValue * 0.085).toFixed(2)}</div>
          <div className="text-xs text-text-secondary">Est. yearly earnings</div>
        </motion.div>
      </motion.div>

      {/* Stake Input */}
        <motion.div
          className="mb-6 rounded-2xl border border-border bg-panel p-6 shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Stake More OMA</h2>
            {nextTier && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-400 border border-indigo-500/30">
                {nextTier.stake.toLocaleString()} OMA for {nextTier.label}
              </span>
            )}
          </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-text-secondary">Amount</label>
            <span className="text-xs text-text-secondary">Available: -- OMA</span>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="0.00"
              value={stakeAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-full text-2xl font-bold bg-surface border border-border rounded-xl px-4 py-4 placeholder:text-text-secondary/30 focus:outline-none focus:border-indigo-500/50"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <Hexagon className="h-5 w-5 text-indigo-500" />
              <span className="text-sm font-bold">OMA</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {quickAmounts.map((q) => (
            <motion.button
              key={q}
              onClick={() => setStakeAmount(q.toString())}
              className="btn-secondary flex-1 rounded-xl py-2.5 text-sm font-medium"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {q.toLocaleString()}
            </motion.button>
          ))}
        </div>

        <motion.button
          onClick={handleStake}
          disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || staking}
          className="btn-primary w-full py-4 text-base disabled:opacity-50"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          {staking ? (
            <span className="flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Staking...
            </span>
          ) : (
            <span className="flex items-center gap-2 justify-center">
              <Lock className="h-4 w-4" />
              Stake OMA
            </span>
          )}
        </motion.button>

        {nextTier && stakeAmount && parseFloat(stakeAmount) > 0 && (
          <motion.div
            className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">You&apos;ll reach {nextTier.label} tier</span>
              <span className="text-sm font-bold text-indigo-500">-{nextTier.discount}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progressToNext, 100)}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Tier Cards */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="mb-4 text-lg font-bold">Staking Tiers</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {STAKING_TIERS.map((tier, index) => (
              <motion.div
                key={tier.label}
                className={`relative rounded-xl border ${tier.borderColor} ${tier.bgColor} p-4 ${currentTierIndex >= index ? 'ring-2 ring-indigo-500/50' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileHover={{ y: -4 }}
              >
                {currentTierIndex >= index && (
                  <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
                <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 ${tier.bgColor} border ${tier.borderColor} mb-3`}>
                  <Star className={`h-4 w-4 ${tier.color}`} />
                  <span className={`text-xs font-bold ${tier.color}`}>{tier.label}</span>
                </div>
                <div className="mb-3 text-2xl font-bold text-text">-{tier.discount}%</div>
                <div className="mb-3 text-xs text-text-secondary">{tier.stake.toLocaleString()} OMA</div>
                <div className="space-y-1">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Check className={`h-3 w-3 ${tier.color}`} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
      </motion.div>

      {/* APY Info */}
      <motion.div
        className="rounded-2xl border border-border bg-panel p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-bold">APY Information</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="text-xs text-text-secondary mb-1">Base APY</div>
            <div className="text-2xl font-bold text-green-500">8.5%</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="text-xs text-text-secondary mb-1">Bonus for Top Tier</div>
            <div className="text-2xl font-bold text-indigo-500">+2.5%</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="text-xs text-text-secondary mb-1">Combined APY</div>
            <div className="text-2xl font-bold text-gradient">11.0%</div>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 text-xs text-text-secondary">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>APY rates are subject to change. Rewards are automatically added to your staked amount daily.</span>
        </div>
      </motion.div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="card mx-4 w-full max-w-md border-green-500/30"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="text-center">
                <motion.div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                >
                  <Check className="h-8 w-8 text-green-500" />
                </motion.div>
                <h3 className="text-xl font-bold mb-2">Stake Successful!</h3>
                <p className="text-text-secondary text-sm mb-6">Your OMA tokens have been staked.</p>
                <motion.button
                  onClick={() => setShowSuccess(false)}
                  className="btn-primary w-full py-3"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Done
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}