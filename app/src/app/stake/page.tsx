'use client'

import { useWallet } from '@/components/wallet-provider'
import { api } from '@/lib/api'
import {
  Wallet,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Loader2,
  AlertTriangle,
  Hexagon,
  Flame,
  Award,
  Crown,
  Gem,
  Info,
  X,
  Lock,
  Unlock,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

const STAKING_TIERS = [
  { key: 'none', label: 'None', stake: 0, discount: 0, icon: ShieldCheck, color: 'text-text-dim', border: 'border-border', bg: 'bg-surface' },
  { key: 'bronze', label: 'Bronze', stake: 1000, discount: 3, icon: Award, color: 'text-amber', border: 'border-amber/40', bg: 'bg-amber/10' },
  { key: 'silver', label: 'Silver', stake: 10000, discount: 6, icon: Gem, color: 'text-text', border: 'border-text-dim/40', bg: 'bg-surface' },
  { key: 'gold', label: 'Gold', stake: 50000, discount: 10, icon: Crown, color: 'text-amber', border: 'border-amber/40', bg: 'bg-amber/10' },
  { key: 'platinum', label: 'Platinum', stake: 100000, discount: 15, icon: Flame, color: 'text-cyan', border: 'border-cyan/40', bg: 'bg-cyan/10' },
]

const REVENUE_SPLIT = [
  { label: 'Buyback + Burn', pct: 40, color: 'bg-pink' },
  { label: 'Staker Yield', pct: 30, color: 'bg-cyan' },
  { label: 'Treasury', pct: 20, color: 'bg-amber' },
  { label: 'Emissions', pct: 10, color: 'bg-text-dim' },
]

function formatOma(n: number): string {
  return n.toLocaleString()
}

function getTierForStake(staked: number) {
  for (let i = STAKING_TIERS.length - 1; i >= 0; i--) {
    if (staked >= STAKING_TIERS[i].stake) return STAKING_TIERS[i]
  }
  return STAKING_TIERS[0]
}

function getNextTierForStake(staked: number) {
  for (const tier of STAKING_TIERS) {
    if (tier.stake > staked) return tier
  }
  return null
}

export default function StakePage() {
  const { isConnected, connectEvm, evmAddress } = useWallet()

  const [stakedAmount, setStakedAmount] = useState(0)
  const [stakeInput, setStakeInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staking, setStaking] = useState(false)
  const [unstaking, setUnstaking] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [showUnstakeConfirm, setShowUnstakeConfirm] = useState(false)
  const [unstakeCooldownEnd, setUnstakeCooldownEnd] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const info = await api.staking.info()
      setStakedAmount(Number(info.stakedAmount))
      setUnstakeCooldownEnd(info.cooldownUntil)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load staking data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isConnected) return
    loadData()
  }, [isConnected, loadData])

  const handleStake = async () => {
    const amount = parseFloat(stakeInput)
    if (!amount || amount <= 0) return
    setStaking(true)
    setError(null)
    try {
      // Generate simulated/mock transaction hash for development verification
      const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
      const res = await api.staking.stake(amount, txHash)
      setStakedAmount(Number(res.stakedAmount))
      setStakeInput('')
      await loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Staking failed')
    } finally {
      setStaking(false)
    }
  }

  const handleUnstake = async () => {
    setUnstaking(true)
    setError(null)
    try {
      const res = await api.staking.unstake()
      setUnstakeCooldownEnd(res.cooldownUntil)
      await loadData()
      setShowUnstakeConfirm(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unstaking failed')
    } finally {
      setUnstaking(false)
    }
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    setError(null)
    try {
      await api.staking.withdraw()
      await loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Withdrawal failed')
    } finally {
      setWithdrawing(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-panel">
            <Wallet className="h-8 w-8 text-cyan" />
          </div>
          <h2 className="mono mb-2 text-xl font-bold">CONNECT WALLET</h2>
          <p className="mono mb-6 text-sm text-text-dim">
            Authenticate to access OMA staking.
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

  const currentTier = getTierForStake(stakedAmount)
  const nextTier = getNextTierForStake(stakedAmount)
  const progressPct = nextTier
    ? Math.min(((stakedAmount - currentTier.stake) / (nextTier.stake - currentTier.stake)) * 100, 100)
    : 100
  const omaRemaining = nextTier ? nextTier.stake - stakedAmount : 0

  const isInCooldown = unstakeCooldownEnd && new Date(unstakeCooldownEnd) > new Date()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 font-mono">
      <div className="mb-8">
        <h1 className="mono text-2xl font-bold tracking-tight">STAKE OMA</h1>
        <p className="mono mt-1 text-xs text-text-dim">
          OMA STAKING TERMINAL -- STATUS: {loading ? 'SYNCING' : error ? 'DEGRADED' : 'NOMINAL'}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-pink/30 bg-pink/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-pink" />
          <span className="mono text-xs text-pink">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-text-dim hover:text-text">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isInCooldown && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber/30 bg-amber/5 px-4 py-3">
          <Clock className="h-4 w-4 shrink-0 text-amber" />
          <span className="mono text-xs text-amber">
            Unstake cooldown active until {new Date(unstakeCooldownEnd!).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Current Tier */}
      <div className="card mb-6 border-cyan/20">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${currentTier.border} ${currentTier.bg}`}>
            <currentTier.icon className={`h-6 w-6 ${currentTier.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="mono text-lg font-bold">{currentTier.label.toUpperCase()} TIER</span>
              {currentTier.discount > 0 && (
                <span className="badge border-cyan/30 text-cyan">
                  <ShieldCheck className="h-3 w-3" />
                  {currentTier.discount}% DISCOUNT
                </span>
              )}
            </div>
            <div className="mono mt-1 text-xs text-text-dim">
              {stakedAmount.toLocaleString()} OMA staked
              {currentTier.discount > 0 && (
                <span className="ml-3 text-cyan">
                  OMA bonus: 5% + Staking: {currentTier.discount}% = {5 + currentTier.discount}% max combined
                  {5 + currentTier.discount > 20 && (
                    <span className="text-amber"> (capped at 20%)</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="mono text-2xl font-bold text-cyan">{stakedAmount.toLocaleString()}</div>
            <div className="mono text-xs text-text-dim">OMA STAKED</div>
          </div>
        </div>

        {nextTier && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="mono text-xs text-text-dim">
                Progress to {nextTier.label.toUpperCase()} ({formatOma(nextTier.stake)} OMA)
              </span>
              <span className="mono text-xs text-cyan">
                {omaRemaining.toLocaleString()} OMA remaining
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-cyan transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {!nextTier && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-center gap-2 text-xs text-cyan">
              <Crown className="h-3.5 w-3.5" />
              <span className="mono">MAXIMUM TIER REACHED -- PLATINUM ELITE</span>
            </div>
          </div>
        )}
      </div>

      {/* Tier Cards */}
      <div className="mb-6">
        <h2 className="mono mb-4 text-lg font-bold tracking-tight">STAKING TIERS</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STAKING_TIERS.map((tier) => {
            const isActive = currentTier.key === tier.key
            const Icon = tier.icon
            return (
              <div
                key={tier.key}
                className={`card transition-all ${
                  isActive
                    ? `border-cyan/40 ${tier.bg} ring-1 ring-cyan/20`
                    : 'hover:border-border-bright'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-cyan' : tier.color}`} />
                  <span className={`mono text-sm font-bold ${isActive ? 'text-cyan' : ''}`}>
                    {tier.label.toUpperCase()}
                  </span>
                </div>
                <div className="mono text-2xl font-bold mb-1">
                  {tier.discount > 0 ? `${tier.discount}%` : '--'}
                </div>
                <div className="mono text-xs text-text-dim mb-2">
                  {tier.stake > 0 ? `${formatOma(tier.stake)} OMA` : 'No stake'}
                </div>
                {isActive && (
                  <div className="flex items-center gap-1 text-[10px] text-cyan font-bold uppercase">
                    <Lock className="h-3 w-3" />
                    ACTIVE
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Stake Input */}
        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-xs text-text-dim">
            <ArrowUpRight className="h-3.5 w-3.5" />
            STAKE OMA TOKENS
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-dim">
              Amount (OMA)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="0.00"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-void px-4 py-3 text-sm text-text placeholder:text-text-dim/50 focus:border-cyan/50 focus:outline-none"
              />
              <span className="shrink-0 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-bold text-cyan">
                OMA
              </span>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            {[100, 1000, 5000, 10000].map((amt) => (
              <button
                key={amt}
                onClick={() => setStakeInput(String(amt))}
                className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-[10px] font-bold uppercase text-text-dim transition-colors hover:border-cyan/30 hover:text-cyan"
              >
                {amt.toLocaleString()}
              </button>
            ))}
          </div>

          {stakeInput && parseFloat(stakeInput) > 0 && (
            <div className="mb-4 rounded-lg border border-border bg-surface p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-text-dim">Staking</span>
                <span>{parseFloat(stakeInput).toLocaleString()} OMA</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-text-dim">New total</span>
                <span className="text-cyan">{(stakedAmount + parseFloat(stakeInput)).toLocaleString()} OMA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim">New tier</span>
                <span className="text-cyan">
                  {getTierForStake(stakedAmount + parseFloat(stakeInput)).label.toUpperCase()}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleStake}
            disabled={!stakeInput || parseFloat(stakeInput) <= 0 || staking}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {staking ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> STAKING...</>
            ) : (
              <><ArrowUpRight className="mr-2 h-4 w-4 inline" /> STAKE OMA</>
            )}
          </button>
        </div>

        {/* Unstake */}
        <div className="card">
          <div className="mb-4 flex items-center gap-2 text-xs text-text-dim">
            <ArrowDownRight className="h-3.5 w-3.5" />
            UNSTAKE OMA TOKENS
          </div>

          {stakedAmount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-dim">
              <Unlock className="h-8 w-8 mb-2" />
              <span className="mono text-sm">No OMA staked</span>
              <span className="mono text-xs mt-1">Stake OMA to earn tier discounts</span>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-lg border border-border bg-surface p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-text-dim">Currently staked</span>
                  <span className="text-sm font-bold text-cyan">{stakedAmount.toLocaleString()} OMA</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-text-dim">Current tier</span>
                  <span className="text-sm font-bold">{currentTier.label.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-text-dim">Discount</span>
                  <span className="text-sm font-bold text-cyan">{currentTier.discount}%</span>
                </div>
              </div>

              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/5 px-3 py-2">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber" />
                <div>
                  <span className="mono text-xs font-bold text-amber">20-DAY COOLDOWN</span>
                  <p className="mono text-[10px] text-text-dim mt-0.5">
                    Unstaking triggers a 20-day cooldown period. Tier benefits are lost immediately.
                    OMA tokens will be available for withdrawal after cooldown expires.
                  </p>
                </div>
              </div>

              {isInCooldown ? (
                <div className="rounded-lg border border-amber/40 bg-amber/5 p-4 text-center">
                  <Clock className="h-6 w-6 text-amber mx-auto mb-2 animate-pulse" />
                  <span className="mono text-xs text-amber font-bold">COOLDOWN ACTIVE</span>
                  <p className="mono text-[10px] text-text-dim mt-1">
                    Your OMA tokens are locked until the cooldown expires on {new Date(unstakeCooldownEnd!).toLocaleString()}.
                  </p>
                </div>
              ) : unstakeCooldownEnd ? (
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="btn-primary w-full"
                >
                  {withdrawing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> WITHDRAWING...</>
                  ) : (
                    <><Unlock className="mr-2 h-4 w-4 inline" /> WITHDRAW OMA TOKENS</>
                  )}
                </button>
              ) : !showUnstakeConfirm ? (
                <button
                  onClick={() => setShowUnstakeConfirm(true)}
                  disabled={isInCooldown as boolean}
                  className="btn-danger w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowDownRight className="mr-2 h-4 w-4 inline" /> UNSTAKE ALL
                </button>
              ) : (
                <div className="rounded-lg border border-pink/40 bg-pink/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-pink" />
                    <span className="mono text-sm font-bold text-pink">CONFIRM UNSTAKE</span>
                  </div>
                  <p className="mono text-xs text-text-dim mb-4">
                    You will lose your {currentTier.label.toUpperCase()} tier benefits immediately.
                    {stakedAmount.toLocaleString()} OMA enters 20-day cooldown.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUnstake}
                      disabled={unstaking}
                      className="btn-danger flex-1 disabled:opacity-40"
                    >
                      {unstaking ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> PROCESSING...</>
                      ) : (
                        'CONFIRM UNSTAKE'
                      )}
                    </button>
                    <button
                      onClick={() => setShowUnstakeConfirm(false)}
                      disabled={unstaking}
                      className="btn-secondary flex-1"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Revenue Split */}
      <div className="card mt-6">
        <div className="mb-4 flex items-center gap-2 text-xs text-text-dim">
          <Info className="h-3.5 w-3.5" />
          REVENUE DISTRIBUTION
        </div>
        <div className="mb-3">
          <div className="flex h-4 overflow-hidden rounded-full">
            {REVENUE_SPLIT.map((seg) => (
              <div
                key={seg.label}
                className={`${seg.color} transition-all`}
                style={{ width: `${seg.pct}%` }}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {REVENUE_SPLIT.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-sm ${seg.color}`} />
              <div>
                <div className="mono text-xs font-bold">{seg.pct}%</div>
                <div className="mono text-[10px] text-text-dim">{seg.label}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mono text-[11px] text-text-dim">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-pink" />
              50% of OMA burned, 50% to treasury
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
              Staker yield distributed proportionally
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber" />
              Treasury funds operations and development
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-text-dim" />
              Emissions fund community incentives
            </div>
          </div>
        </div>
      </div>

      {/* Connected Wallet */}
      <div className="card mt-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-text-dim">
          <Wallet className="h-3.5 w-3.5" />
          STAKING WALLET
        </div>
        <div className="flex items-center gap-3">
          {evmAddress ? (
            <>
              <Hexagon className="h-4 w-4 text-blue-400" />
              <span className="mono text-sm text-cyan">{evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}</span>
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">BASE</span>
            </>
          ) : (
            <span className="mono text-sm text-text-dim">No wallet connected</span>
          )}
        </div>
      </div>
    </div>
  )
}
