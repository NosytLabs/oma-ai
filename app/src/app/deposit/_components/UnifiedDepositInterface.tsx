'use client'

import { useState, useEffect, useCallback, useRef, useId, useMemo } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { useWriteContract, usePublicClient, useAccount } from 'wagmi'
import { parseUnits } from 'viem'
import {
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Sparkles,
  Check,
  ShieldCheck,
  Rocket,
  Link2,
} from 'lucide-react'

import { StaggerReveal, Magnetic, scaleIn, scaleInSpring } from '@/lib/motion'

import { CryptoLogo } from '@/components/ui/CryptoLogo'
import { useToast } from '@/components/ui/Toast'
import { useWallet } from '@/components/wallet-provider'
import { api, type DepositStatus } from '@/lib/api'
import { useCryptoPrices, calculateUsdValue } from '@/lib/prices'

import { CoinSelector } from './CoinSelector'
import {
  type CoinOption,
  type RouteInfo,
  type DepositStep,
  ERC20_ABI,
  USDC_ADDRESS,
  treasuryAddress,
  ROUTES,
} from '../_constants'

export interface PendingDeposit {
  id: string
  status: DepositStatus['status']
  amountCents: string
  coin: string
  createdAt: string
}

interface PaymentLinkInfo {
  id: string
  url: string
  amount: string
  token: string
  chain: string
  expiresAt: string
  depositId: string
}

export function UnifiedDepositInterface({ onDeposit }: { onDeposit?: (d: PendingDeposit) => void }) {
  const [step, setStep] = useState<DepositStep>('select')
  const [selectedCoin, setSelectedCoin] = useState<CoinOption | null>(null)
  const [amount, setAmount] = useState('')
  const [processingStep, setProcessingStep] = useState('')
  const [txHash, setTxHash] = useState('')
  const [error, setError] = useState('')
  const [paymentLinkInfo, setPaymentLinkInfo] = useState<PaymentLinkInfo | null>(null)
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false)
  const [coinBalance, setCoinBalance] = useState<string | null>(null)
  const toast = useToast()
  const id = useId()

  const stepOrder = useMemo<DepositStep[]>(() => ['select', 'route', 'processing', 'complete', 'error'], [])
  const prevStepRef = useRef<DepositStep>('select')
  const [slideDirection, setSlideDirection] = useState(1)

  useEffect(() => {
    const prevIdx = stepOrder.indexOf(prevStepRef.current)
    const currIdx = stepOrder.indexOf(step)
    if (prevIdx !== -1 && currIdx !== -1 && prevIdx !== currIdx) {
      setSlideDirection(currIdx > prevIdx ? 1 : -1)
    }
    prevStepRef.current = step
  }, [step, stepOrder])

  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const { prices } = useCryptoPrices()
  const { address: walletAddress } = useAccount()
  const { signMessage } = useWallet()

  const usdValue = selectedCoin && amount ? calculateUsdValue(selectedCoin.symbol, parseFloat(amount) || 0, prices) : null

  const detectRoute = useCallback((): RouteInfo => {
    if (!selectedCoin) return ROUTES['usdc-base']
    if (selectedCoin.id === 'usdc-base') return ROUTES['usdc-base']
    if (selectedCoin.id === 'usdc-sol') return ROUTES['usdc-sol']
    
    // HoudiniSwap is not configured on this server. Disable the route.
    // Users should use Direct USDC deposit or contact support.
    return ROUTES['usdc-base']
  }, [selectedCoin])

  const route = detectRoute()

  useEffect(() => {
    if (!selectedCoin) {
      setCoinBalance(null);
      return;
    }
    const fetchBalance = async () => {
      try {
        const bal = await api.oma.getBalance();
        const balanceCents = parseInt(bal.balanceCents || '0', 10);
        setCoinBalance((balanceCents / 100).toFixed(2));
      } catch {
        setCoinBalance(null);
      }
    };
    fetchBalance();
  }, [selectedCoin]);

  const handleAmountChange = (value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) setAmount(value)
  }

  const handleStartDeposit = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setError('')

    if (!treasuryAddress) {
      const errMsg = 'Treasury address not configured. Please set NEXT_PUBLIC_TREASURY_BASE_ADDRESS in your environment variables. Deposits are disabled until treasury is configured.'
      setError(errMsg)
      toast.error('Treasury misconfiguration detected')
      setStep('error')
      return
    }

    setStep('processing')

    const sessionToken = document.cookie.match(/oma_session=([^;]+)/)?.[1] || '';

    try {
      if (selectedCoin?.id === 'usdc-base') {

        if (!publicClient) {
          throw new Error('Wallet not connected. Please connect your wallet to continue.')
        }
        const chainId = await publicClient.getChainId()

        const nonceResponse = await fetch('/api/v1/deposit/usdc/nonce', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            amount: parseFloat(amount),
            walletAddress,
            chainId,
          }),
        })

        if (!nonceResponse.ok) {
          const errorData = await nonceResponse.json().catch(() => ({}))
          throw new Error(errorData.error?.message || 'Failed to get deposit nonce')
        }

        const { nonce } = await nonceResponse.json()

        setProcessingStep('Requesting wallet signature...')
        const parsedAmount = parseUnits(amount, 6)

        const tx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [treasuryAddress as `0x${string}`, parsedAmount],
        })

        setProcessingStep('Transaction broadcasting...')
        setTxHash(tx)

        await publicClient.waitForTransactionReceipt({ hash: tx })

        setProcessingStep('Verifying deposit and crediting account...')

        const messageToSign = `Deposit ${amount} USDC to OMA\nTx: ${tx}\nChain: ${chainId}\nNonce: ${nonce}\nWallet: ${walletAddress}\n\nSigning this message confirms the deposit.`

        let signature: string
        try {
          signature = await signMessage(messageToSign)
        } catch (signErr) {
          const signError = signErr instanceof Error ? signErr.message : 'Signing failed'
          if (signError.includes('User denied') || signError.includes('rejected')) {
            throw new Error('Signature denied. Please sign the message to confirm your deposit.')
          }
          throw new Error(`Failed to sign deposit message: ${signError}`)
        }

        const signatureResponse = await fetch('/api/v1/deposit/usdc/signature', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            amount: parseFloat(amount),
            txHash: tx,
            signature,
            nonce,
            walletAddress,
            chainId,
          }),
        })

        if (!signatureResponse.ok) {
          const errorData = await signatureResponse.json().catch(() => ({}))
          throw new Error(errorData.error?.message || 'Signature verification failed')
        }

        const result = await fetch('/api/v1/deposit/usdc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            amount: parseFloat(amount),
            txHash: tx,
            signature,
            nonce,
            walletAddress,
            chainId,
          }),
        }).then(async res => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}))
            throw new Error(errorData.error?.message || 'Deposit failed')
          }
          return res.json()
        })

        onDeposit?.({ id: result.depositId, status: 'completed', amountCents: String(result.credits), coin: 'USDC', createdAt: new Date().toISOString() })
        toast.success(`Successfully deposited $${amount} USDC`)
        setStep('complete')
      } else {
          let tokensResponse: Response | null = null;
          try {
            tokensResponse = await fetch('/api/v1/deposit/houdini/tokens', {
              headers: { 'Authorization': `Bearer ${sessionToken}` },
            });
          } catch {
            // Network error - Houdini service unreachable
          }

          if (!tokensResponse?.ok) {
            const errorMsg = 'HoudiniSwap is not currently configured on this server. Please try using Direct USDC deposit or contact support.'
            setError(errorMsg)
            toast.error('Service unavailable')
            setStep('error')
            return
          }

          setStep('route')
        }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Deposit failed'
      setError(errMsg)
      toast.error(errMsg)
      setStep('error')
    }
  // treasuryAddress is a module-level constant (never changes), so including
  // it in deps is unnecessary but harmless for correctness — the linter
  // warns because it can't be a dependency that triggers re-renders.
   
  }, [amount, selectedCoin, publicClient, walletAddress, onDeposit, toast, writeContractAsync, signMessage])

  const handleCreatePaymentLink = async () => {
    if (!amount || parseFloat(amount) <= 0 || !selectedCoin) return
    setCreatingPaymentLink(true)
    try {
      setProcessingStep('Creating payment link...')
      const chain = selectedCoin.chain === 'solana' ? 'solana' : 'base'
      const response = await fetch('/api/pricing/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-payment-link',
          amount: parseFloat(amount),
          chain,
          token: selectedCoin.symbol,
        }),
      })

      const result = await response.json()

      if (result.success && result.paymentLink) {
        setPaymentLinkInfo({
          id: result.paymentLink.id,
          url: result.paymentLink.url,
          amount: result.paymentLink.amount,
          token: result.paymentLink.token,
          chain: result.paymentLink.chain,
          expiresAt: result.paymentLink.expiresAt,
          depositId: result.paymentLink.depositId,
        })
        toast.success('Payment link created!')
        setStep('processing')
      } else {
        throw new Error(result.error || 'Failed to create payment link')
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Failed to create payment link'
      toast.error(errMsg)
      setStep('error')
    } finally {
      setCreatingPaymentLink(false)
    }
  }

  const handleReset = () => {
    setStep('select')
    setSelectedCoin(null)
    setAmount('')
    setTxHash('')
    setProcessingStep('')
    setError('')
  }

  const quickAmounts = [10, 50, 100, 500]

  const STEPS = [
    { key: 'select' as const, label: 'Select Asset' },
    { key: 'route' as const, label: 'Choose Route' },
    { key: 'processing' as const, label: 'Process' },
    { key: 'complete' as const, label: 'Complete' },
  ]

  const slideVariants = {
    enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir * -40, opacity: 0, transition: { duration: 0.12 } }),
  }

  const currentStepIdx = STEPS.findIndex(s => s.key === step)

  return (
    <div className="space-y-6">
      {step !== 'error' && (
        <nav aria-label="Deposit progress" className="flex items-center justify-center gap-0">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className="flex flex-col items-center gap-1.5"
              aria-current={i === currentStepIdx ? 'step' : undefined}
            >
              <div
                className={`relative flex h-8 w-8 items-center justify-center rounded-full border text-xs font-mono font-semibold transition-colors duration-300 ${
                  i === currentStepIdx
                    ? 'border-accent bg-accent/10 text-accent'
                    : i < currentStepIdx
                      ? 'border-success/40 bg-success/10 text-success'
                      : 'border-border-bright bg-surface text-text-muted'
                }`}
              >
                {i < currentStepIdx ? <Check className="h-4 w-4" /> : i + 1}
                {i === currentStepIdx && (
                  <m.div
                    className="absolute inset-0 rounded-full border border-accent"
                    layoutId="step-indicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </div>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider ${
                  i === currentStepIdx
                    ? 'text-accent'
                    : i < currentStepIdx
                      ? 'text-success'
                      : 'text-text-muted'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </nav>
      )}

      <AnimatePresence mode="wait" custom={slideDirection}>
        <m.div
          key={step}
          className="rounded-lg border border-border-bright bg-panel p-6"
          custom={slideDirection}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
        {step === 'select' && (
          <div className="space-y-5">
            <CoinSelector selected={selectedCoin} onSelect={setSelectedCoin} />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-text-secondary font-mono">Amount</label>
                {selectedCoin && <span className="text-xs text-text-muted font-mono">Balance: {coinBalance ?? '--'}</span>}
              </div>
              <div className="relative glow-accent-sm">
                <input
                  id={id}
                  type="text"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full text-xl font-semibold bg-surface border border-border-bright rounded-lg px-4 py-4
                    placeholder:text-text-muted
                    focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20
                    hover:border-accent/30"
                />
                {selectedCoin && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <CryptoLogo symbol={selectedCoin.symbol} size={20} />
                    <span className="text-sm font-semibold text-text-bright">{selectedCoin.symbol}</span>
                  </div>
                )}
              </div>
              {usdValue !== null && selectedCoin && (
                <div className="mt-2 text-sm text-text-muted font-mono">
                  ≈ ${usdValue.toFixed(2)} USD
                </div>
              )}
            </div>

            {selectedCoin && (
              <div className="flex gap-2">
                {quickAmounts.map((q) => (
                  <Magnetic key={q} strength={4}>
                    <m.button
                      onClick={() => setAmount(q.toString())}
                      className="flex-1 rounded border border-border-bright py-2 text-sm font-medium
                        text-text-secondary bg-surface
                        hover:bg-surface-elevated hover:text-text-bright
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30
                        transition-colors duration-150"
                      whileTap={{ scale: 0.97 }}
                    >
                      ${q}
                    </m.button>
                  </Magnetic>
                ))}
              </div>
            )}

            {selectedCoin && amount && parseFloat(amount) > 0 && (
              <m.div
                className="rounded border border-border-bright bg-surface/50 p-4 glass tilt-card sheen"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-secondary font-medium">Route</span>
                  {route.badge && (
                    <span className="rounded px-2 py-0.5 text-xs font-mono font-semibold text-accent border border-accent/20 bg-accent/10">
                      {route.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-border-bright bg-surface">
                    <ShieldCheck className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-text-bright">{route.label}</div>
                    <div className="text-xs text-text-secondary">{route.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-muted">Est. time</div>
                    <div className="text-sm font-medium text-text-bright">{route.estimatedTime}</div>
                  </div>
                </div>
              </m.div>
            )}

            <m.button
              onClick={handleStartDeposit}
              disabled={!selectedCoin || !amount || parseFloat(amount) <= 0 || !treasuryAddress}
              className="w-full py-4 text-sm font-semibold rounded-full
                bg-accent text-void
                hover:bg-accent-bright
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                disabled:opacity-40 disabled:cursor-not-allowed
                active:translate-y-0
                transition-colors duration-150"
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.98 }}
            >
              {!treasuryAddress ? 'Treasury not configured' : !selectedCoin ? 'Select an asset to continue' : !amount || parseFloat(amount) <= 0 ? 'Enter an amount' : 'Continue'}
            </m.button>
          </div>
        )}

        {step === 'route' && (
          <div className="space-y-5">
            <m.div
              className="text-left"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded border border-border-bright bg-surface">
                  <ArrowRightLeft className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-bright">Swap Required</h3>
                  <p className="text-text-secondary text-sm">
                    {selectedCoin?.symbol} is not directly supported. Use HoudiniSwap to convert to USDC.
                  </p>
                </div>
              </div>
            </m.div>

            <StaggerReveal stagger={0.07} className="space-y-3">
              <m.div
                variants={scaleIn}
                className="rounded border border-border-bright bg-surface/50 p-4 tilt-card sheen glass"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-amber" />
                  <span className="text-sm font-medium text-text-bright">HoudiniSwap Integration</span>
                </div>
                <div className="space-y-2 text-sm text-text-secondary">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>100+ cryptocurrencies supported</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>Cross-chain swaps</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>Privacy enhanced routing via Monero tunnel</span>
                  </div>
                </div>
              </m.div>

              <m.div
                variants={scaleIn}
                className="rounded border border-border-bright bg-surface/50 p-4 tilt-card sheen glass"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Rocket className="h-4 w-4 text-pink" />
                  <span className="text-sm font-medium text-text-bright">x402 Pay-Per-Request</span>
                </div>
                <p className="text-sm text-text-secondary mb-3">
                  Create a payment link and share it with users. They can pay without connecting a wallet directly.
                </p>
                <div className="space-y-2 text-sm text-text-secondary">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>Gasless transactions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>Works on Solana and Base</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>Automatic token conversion</span>
                  </div>
                </div>
              </m.div>
            </StaggerReveal>

            <div className="flex gap-3">
              <m.button
                onClick={handleReset}
                className="flex-1 py-3 text-sm font-medium rounded-lg border border-border-bright
                  text-text-secondary bg-transparent
                  hover:bg-surface hover:text-text-bright
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30
                  active:translate-y-0
                  transition-colors duration-150"
                whileHover={{ scale: 1 }}
                whileTap={{ scale: 0.98 }}
              >
                Back
              </m.button>
              <m.button
                onClick={handleCreatePaymentLink}
                disabled={creatingPaymentLink}
                className="flex-1 py-3 text-sm font-semibold rounded-lg
                  bg-accent text-void
                  hover:bg-accent-bright
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                  disabled:opacity-40 disabled:cursor-not-allowed
                  active:translate-y-0
                  transition-colors duration-150"
                whileHover={{ scale: 1 }}
                whileTap={{ scale: 0.98 }}
              >
                {creatingPaymentLink ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Create Link
                  </span>
                )}
              </m.button>
            </div>

            <div className="text-left">
              <a
                href="https://app.houdiniswap.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:text-accent-bright underline"
              >
                Open HoudiniSwap →
              </a>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <m.div
            className="text-left py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {paymentLinkInfo ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-border-bright bg-surface">
                    <Link2 className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-text-bright">Payment Link Created</h3>
                    <p className="text-text-secondary text-sm">Share this link with anyone to receive payment</p>
                  </div>
                </div>

                <div className="rounded border border-border-bright bg-surface/50 glass-strong float p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-secondary">Amount</span>
                    <span className="font-bold text-lg text-text-bright">${paymentLinkInfo.amount} {paymentLinkInfo.token}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-secondary">Chain</span>
                    <span className="font-medium text-text-bright capitalize">{paymentLinkInfo.chain}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Expires</span>
                    <span className="text-sm text-text-bright">{new Date(paymentLinkInfo.expiresAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="rounded border border-border-bright bg-surface/50 glass p-3 mb-4 break-all">
                  <div className="text-xs text-text-muted mb-1 font-mono">Payment Link</div>
                  <div className="text-sm font-mono text-accent">{paymentLinkInfo.url}</div>
                </div>

                <div className="flex gap-3">
                  <m.button
                    onClick={async () => {
                      await navigator.clipboard.writeText(paymentLinkInfo.url)
                      toast.success('Copied to clipboard!')
                    }}
                    className="py-3 px-5 text-sm font-medium rounded-lg border border-border-bright
                      text-text-secondary bg-transparent
                      hover:bg-surface hover:text-text-bright
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30
                      active:translate-y-0
                      transition-colors duration-150"
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Copy Link
                    </span>
                  </m.button>
                  <m.button
                    onClick={handleReset}
                    className="py-3 px-5 text-sm font-semibold rounded-lg
                      bg-accent text-void
                      hover:bg-accent-bright
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                      active:translate-y-0
                      transition-colors duration-150"
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Done
                  </m.button>
                </div>

                <p className="text-xs text-text-muted mt-5 font-mono">
                  Deposit ID: {paymentLinkInfo.depositId}<br/>
                  Credits will be added to your account once payment is confirmed via webhook.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center mb-6">
                  <div className="pulse-ring">
                    <m.div
                      className="h-14 w-14 rounded border border-border-bright bg-surface flex items-center justify-center"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="h-7 w-7 text-accent" />
                    </m.div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-text-bright text-center mb-2">Processing Deposit</h3>
                <p className="text-text-secondary text-sm text-center mb-4">{processingStep}</p>
                {txHash && (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-text-muted font-mono">Tx:</span>
                    <span className="text-xs font-mono text-accent">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                    <a href={`https://basescan.io/tx/${txHash}`} target="_blank" rel="noopener" className="text-accent hover:text-accent-bright">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </>
            )}
          </m.div>
        )}

        {step === 'complete' && (
          <m.div
            className="text-left py-6"
            variants={scaleInSpring}
            initial="hidden"
            animate="show"
            viewport={undefined}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-success/30 bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-bright">Deposit Complete!</h3>
                <p className="text-text-secondary text-sm">Your credits have been added to your account.</p>
              </div>
            </div>
            <m.button
              onClick={handleReset}
              className="py-3 px-6 text-sm font-semibold rounded-lg
                bg-accent text-void
                hover:bg-accent-bright
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                active:translate-y-0
                transition-colors duration-150"
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.98 }}
            >
              Make Another Deposit
            </m.button>
          </m.div>
        )}

        {step === 'error' && (
          <m.div
            className="text-left py-6"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red/30 bg-red/10">
                <AlertTriangle className="h-6 w-6 text-red" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-bright">Deposit Failed</h3>
                <p className="text-text-secondary text-sm">{error}</p>
              </div>
            </div>
            <m.button
              onClick={handleReset}
              className="py-3 px-6 text-sm font-semibold rounded-lg
                bg-accent text-void
                hover:bg-accent-bright
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                active:translate-y-0
                transition-colors duration-150"
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.98 }}
            >
              Try Again
            </m.button>
          </m.div>
        )}
        </m.div>
      </AnimatePresence>
    </div>
  )
}
