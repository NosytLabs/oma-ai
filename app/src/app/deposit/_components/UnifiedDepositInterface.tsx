'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
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

export function UnifiedDepositInterface({ onDeposit }: { onDeposit: (d: PendingDeposit) => void }) {
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
    if (selectedCoin.chain === 'solana') return ROUTES['usdc-sol']
    return ROUTES['houdini-swap']
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
        const balanceCents = parseInt(bal.balanceCents || '0');
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

  const handleStartDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setError('')

    if (!treasuryAddress) {
      const errMsg = 'Treasury address not configured. Please set NEXT_PUBLIC_BASE_TREASURY in your environment variables. Deposits are disabled until treasury is configured.'
      setError(errMsg)
      toast.error('Treasury misconfiguration detected')
      setStep('error')
      return
    }

    setStep('processing')

    try {
      if (selectedCoin?.id === 'usdc-base') {
        setProcessingStep('Requesting deposit nonce...')

        const sessionToken = document.cookie.match(/oma_session=([^;]+)/)?.[1] || '';

        const chainId = await publicClient!.getChainId()

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

        await publicClient!.waitForTransactionReceipt({ hash: tx })

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

        onDeposit({ id: result.depositId, status: 'completed', amountCents: String(result.credits), coin: 'USDC', createdAt: new Date().toISOString() })
        toast.success(`Successfully deposited $${amount} USDC`)
        setStep('complete')
      } else {
        const sessionToken = document.cookie.match(/oma_session=([^;]+)/)?.[1] || '';

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
  }

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

  return (
    <div className="space-y-4">
      <motion.div
        className="rounded-lg border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.25 }}
      >
        {step === 'select' && (
          <div className="space-y-5">
            <CoinSelector selected={selectedCoin} onSelect={setSelectedCoin} />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)] font-mono">Amount</label>
                {selectedCoin && <span className="text-xs text-[var(--color-text-muted)] font-mono">Balance: {coinBalance ?? '--'}</span>}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full text-xl font-semibold bg-[var(--color-surface)] border border-[var(--color-border-bright)] rounded-lg px-4 py-4
                    placeholder:text-[var(--color-text-muted)]
                    focus:outline-none focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]/20
                    hover:border-[var(--color-accent)]/30"
                />
                {selectedCoin && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <CryptoLogo symbol={selectedCoin.symbol} size={20} />
                    <span className="text-sm font-semibold text-[var(--color-text-bright)]">{selectedCoin.symbol}</span>
                  </div>
                )}
              </div>
              {usdValue !== null && selectedCoin && (
                <div className="mt-2 text-sm text-[var(--color-text-muted)] font-mono">
                  ≈ ${usdValue.toFixed(2)} USD
                </div>
              )}
            </div>

            {selectedCoin && (
              <div className="flex gap-2">
                {quickAmounts.map((q) => (
                  <motion.button
                    key={q}
                    onClick={() => setAmount(q.toString())}
                    className="flex-1 rounded border border-[var(--color-border-bright)] py-2 text-sm font-medium
                      text-[var(--color-text-secondary)] bg-[var(--color-surface)]
                      hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-bright)]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30
                      active:translate-y-0
                      transition-colors duration-150"
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    ${q}
                  </motion.button>
                ))}
              </div>
            )}

            {selectedCoin && amount && parseFloat(amount) > 0 && (
              <motion.div
                className="rounded border border-[var(--color-border-bright)] bg-[var(--color-surface)] p-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[var(--color-text-secondary)] font-medium">Route</span>
                  {route.badge && (
                    <span className="rounded px-2 py-0.5 text-xs font-mono font-semibold text-[var(--color-accent)] border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10">
                      {route.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-[var(--color-border-bright)] bg-[var(--color-surface)]">
                    <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[var(--color-text-bright)]">{route.label}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{route.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[var(--color-text-muted)]">Est. time</div>
                    <div className="text-sm font-medium text-[var(--color-text-bright)]">{route.estimatedTime}</div>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.button
              onClick={handleStartDeposit}
              disabled={!selectedCoin || !amount || parseFloat(amount) <= 0 || !treasuryAddress}
              className="w-full py-4 text-sm font-semibold rounded-full
                bg-[var(--color-accent)] text-[var(--color-void)]
                hover:bg-[var(--color-accent-bright)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50
                disabled:opacity-40 disabled:cursor-not-allowed
                active:translate-y-0
                transition-colors duration-150"
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.98 }}
            >
              {!treasuryAddress ? 'Treasury not configured' : !selectedCoin ? 'Select an asset to continue' : !amount || parseFloat(amount) <= 0 ? 'Enter an amount' : 'Continue'}
            </motion.button>
          </div>
        )}

        {step === 'route' && (
          <div className="space-y-5">
            <motion.div
              className="text-left"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded border border-[var(--color-border-bright)] bg-[var(--color-surface)]">
                  <ArrowRightLeft className="h-5 w-5 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-text-bright)]">Swap Required</h3>
                  <p className="text-[var(--color-text-secondary)] text-sm">
                    {selectedCoin?.symbol} is not directly supported. Use HoudiniSwap to convert to USDC.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="rounded border border-[var(--color-border-bright)] bg-[var(--color-surface)] p-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-[var(--color-amber)]" />
                <span className="text-sm font-medium text-[var(--color-text-bright)]">HoudiniSwap Integration</span>
              </div>
              <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[var(--color-green)]" />
                  <span>100+ cryptocurrencies supported</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[var(--color-green)]" />
                  <span>Cross-chain swaps</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[var(--color-green)]" />
                  <span>Privacy enhanced routing via Monero tunnel</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="rounded border border-[var(--color-border-bright)] bg-[var(--color-surface)] p-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Rocket className="h-4 w-4 text-[var(--color-pink)]" />
                <span className="text-sm font-medium text-[var(--color-text-bright)]">x402 Pay-Per-Request</span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                Create a payment link and share it with users. They can pay without connecting a wallet directly.
              </p>
              <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[var(--color-green)]" />
                  <span>Gasless transactions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[var(--color-green)]" />
                  <span>Works on Solana and Base</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-[var(--color-green)]" />
                  <span>Automatic token conversion</span>
                </div>
              </div>
            </motion.div>

            <div className="flex gap-3">
              <motion.button
                onClick={handleReset}
                className="flex-1 py-3 text-sm font-medium rounded-lg border border-[var(--color-border-bright)]
                  text-[var(--color-text-secondary)] bg-transparent
                  hover:bg-[var(--color-surface)] hover:text-[var(--color-text-bright)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30
                  active:translate-y-0
                  transition-colors duration-150"
                whileHover={{ scale: 1 }}
                whileTap={{ scale: 0.98 }}
              >
                Back
              </motion.button>
              <motion.button
                onClick={handleCreatePaymentLink}
                disabled={creatingPaymentLink}
                className="flex-1 py-3 text-sm font-semibold rounded-lg
                  bg-[var(--color-accent)] text-[var(--color-void)]
                  hover:bg-[var(--color-accent-bright)]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50
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
              </motion.button>
            </div>

            <div className="text-left">
              <a
                href="https://app.houdiniswap.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-bright)] underline"
              >
                Open HoudiniSwap →
              </a>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <motion.div
            className="text-left py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {paymentLinkInfo ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-[var(--color-border-bright)] bg-[var(--color-surface)]">
                    <Link2 className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--color-text-bright)]">Payment Link Created</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm">Share this link with anyone to receive payment</p>
                  </div>
                </div>

                <div className="rounded border border-[var(--color-border-bright)] bg-[var(--color-surface)] p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Amount</span>
                    <span className="font-bold text-lg text-[var(--color-text-bright)]">${paymentLinkInfo.amount} {paymentLinkInfo.token}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">Chain</span>
                    <span className="font-medium text-[var(--color-text-bright)] capitalize">{paymentLinkInfo.chain}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">Expires</span>
                    <span className="text-sm text-[var(--color-text-bright)]">{new Date(paymentLinkInfo.expiresAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="rounded border border-[var(--color-border-bright)] bg-[var(--color-surface)] p-3 mb-4 break-all">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1 font-mono">Payment Link</div>
                  <div className="text-sm font-mono text-[var(--color-accent)]">{paymentLinkInfo.url}</div>
                </div>

                <div className="flex gap-3">
                  <motion.button
                    onClick={async () => {
                      await navigator.clipboard.writeText(paymentLinkInfo.url)
                      toast.success('Copied to clipboard!')
                    }}
                    className="py-3 px-5 text-sm font-medium rounded-lg border border-[var(--color-border-bright)]
                      text-[var(--color-text-secondary)] bg-transparent
                      hover:bg-[var(--color-surface)] hover:text-[var(--color-text-bright)]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30
                      active:translate-y-0
                      transition-colors duration-150"
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Copy Link
                    </span>
                  </motion.button>
                  <motion.button
                    onClick={handleReset}
                    className="py-3 px-5 text-sm font-semibold rounded-lg
                      bg-[var(--color-accent)] text-[var(--color-void)]
                      hover:bg-[var(--color-accent-bright)]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50
                      active:translate-y-0
                      transition-colors duration-150"
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Done
                  </motion.button>
                </div>

                <p className="text-xs text-[var(--color-text-muted)] mt-5 font-mono">
                  Deposit ID: {paymentLinkInfo.depositId}<br/>
                  Credits will be added to your account once payment is confirmed via webhook.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center mb-6">
                  <motion.div
                    className="h-14 w-14 rounded border border-[var(--color-border-bright)] bg-[var(--color-surface)] flex items-center justify-center"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="h-7 w-7 text-[var(--color-accent)]" />
                  </motion.div>
                </div>
                <h3 className="text-lg font-bold text-[var(--color-text-bright)] text-center mb-2">Processing Deposit</h3>
                <p className="text-[var(--color-text-secondary)] text-sm text-center mb-4">{processingStep}</p>
                {txHash && (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)] font-mono">Tx:</span>
                    <span className="text-xs font-mono text-[var(--color-accent)]">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                    <a href={`https://basescan.io/tx/${txHash}`} target="_blank" rel="noopener" className="text-[var(--color-accent)] hover:text-[var(--color-accent-bright)]">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {step === 'complete' && (
          <motion.div
            className="text-left py-6"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-green)]/30 bg-[var(--color-green)]/10">
                <CheckCircle2 className="h-6 w-6 text-[var(--color-green)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-bright)]">Deposit Complete!</h3>
                <p className="text-[var(--color-text-secondary)] text-sm">Your credits have been added to your account.</p>
              </div>
            </div>
            <motion.button
              onClick={handleReset}
              className="py-3 px-6 text-sm font-semibold rounded-lg
                bg-[var(--color-accent)] text-[var(--color-void)]
                hover:bg-[var(--color-accent-bright)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50
                active:translate-y-0
                transition-colors duration-150"
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.98 }}
            >
              Make Another Deposit
            </motion.button>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div
            className="text-left py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-red)]/30 bg-[var(--color-red)]/10">
                <AlertTriangle className="h-6 w-6 text-[var(--color-red)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-bright)]">Deposit Failed</h3>
                <p className="text-[var(--color-text-secondary)] text-sm">{error}</p>
              </div>
            </div>
            <motion.button
              onClick={handleReset}
              className="py-3 px-6 text-sm font-semibold rounded-lg
                bg-[var(--color-accent)] text-[var(--color-void)]
                hover:bg-[var(--color-accent-bright)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50
                active:translate-y-0
                transition-colors duration-150"
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.98 }}
            >
              Try Again
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
