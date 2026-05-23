'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type DepositStatus } from '@/lib/api'
import { useCryptoPrices, calculateUsdValue } from '@/lib/prices'
import { CryptoLogo } from '@/components/ui/CryptoLogo'
import { useToast } from '@/components/ui/Toast'
import {
  Wallet,
  Coins,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Loader2,
  Hexagon,
  ExternalLink,
  ChevronDown,
  Search,
  Sparkles,
  Lock,
  Check,
  ShieldCheck,
  Rocket,
  Link2,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useWriteContract, usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'

type DepositStep = 'select' | 'route' | 'processing' | 'complete' | 'error'
type RouteType = 'direct-usdc' | 'houdini-swap' | 'onramp' | 'x402-pay'

interface CoinOption {
  id: string
  symbol: string
  name: string
  network: string
  decimals: number
  isPopular?: boolean
  isNative?: boolean
  isPrivacy?: boolean
  chain: 'base' | 'solana'
}

interface RouteInfo {
  type: RouteType
  label: string
  description: string
  estimatedTime: string
  feePercent: number
  creditMultiplier: number
  badge?: string
}

const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const OMA_BASE_TREASURY = process.env.NEXT_PUBLIC_BASE_TREASURY || '0x0000000000000000000000000000000000000000'

const POPULAR_COINS: CoinOption[] = [
  { id: 'usdc-base', symbol: 'USDC', name: 'USD Coin', network: 'Base', isNative: true, decimals: 6, isPopular: true, chain: 'base' },
  { id: 'eth-base', symbol: 'ETH', name: 'Ethereum', network: 'Base', isNative: true, decimals: 18, isPopular: true, chain: 'base' },
  { id: 'weth-base', symbol: 'WETH', name: 'Wrapped Ether', network: 'Base', decimals: 18, chain: 'base' },
  { id: 'usdc-sol', symbol: 'USDC', name: 'USD Coin', network: 'Solana', isNative: true, decimals: 6, isPopular: true, chain: 'solana' },
  { id: 'sol', symbol: 'SOL', name: 'Solana', network: 'Solana', isNative: true, decimals: 9, isPopular: true, chain: 'solana' },
]

const SWAP_COINS: CoinOption[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', network: 'BTC', isPopular: true, decimals: 8, chain: 'base' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', network: 'ETH', isPopular: true, decimals: 18, chain: 'base' },
  { id: 'sol', symbol: 'SOL', name: 'Solana', network: 'SOL', isPopular: true, decimals: 9, chain: 'solana' },
  { id: 'xmr', symbol: 'XMR', name: 'Monero', network: 'XMR', isPrivacy: true, decimals: 12, chain: 'base' },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', network: 'DOGE', decimals: 8, chain: 'base' },
  { id: 'ltc', symbol: 'LTC', name: 'Litecoin', network: 'LTC', decimals: 8, chain: 'base' },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', network: 'ETH', decimals: 6, chain: 'base' },
  { id: 'usdt-sol', symbol: 'USDT', name: 'Tether', network: 'Solana', decimals: 6, chain: 'solana' },
  { id: 'ada', symbol: 'ADA', name: 'Cardano', network: 'ADA', decimals: 6, chain: 'base' },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', network: 'AVAX', decimals: 18, chain: 'base' },
]

const ROUTES: Record<string, RouteInfo> = {
  'usdc-base': {
    type: 'direct-usdc',
    label: 'Direct USDC',
    description: 'Instant deposit directly to Base treasury',
    estimatedTime: '~30s',
    feePercent: 0,
    creditMultiplier: 1.0,
  },
  'usdc-sol': {
    type: 'direct-usdc',
    label: 'Direct USDC (Solana)',
    description: 'Instant deposit via Solana with x402 facilitator',
    estimatedTime: '~2s',
    feePercent: 0,
    creditMultiplier: 1.0,
  },
  'oma-stake': {
    type: 'houdini-swap',
    label: 'Swap + Deposit',
    description: 'Convert OMA to USDC via Houdini and deposit',
    estimatedTime: '5-15 min',
    feePercent: 0.5,
    creditMultiplier: 1.0,
  },
  'houdini-swap': {
    type: 'houdini-swap',
    label: 'Swap + Deposit',
    description: 'Convert any crypto to USDC on Base via Houdini',
    estimatedTime: '5-15 min',
    feePercent: 0.5,
    creditMultiplier: 1.0,
  },
  'x402-pay': {
    type: 'x402-pay',
    label: 'x402 Pay-Per-Request',
    description: 'Gasless payments with automatic fee deduction per request',
    estimatedTime: 'Real-time',
    feePercent: 0,
    creditMultiplier: 1.0,
    badge: 'GASLESS',
  },
}

function CoinSelector({ selected, onSelect }: { selected: CoinOption | null; onSelect: (c: CoinOption) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allCoins = [
    ...POPULAR_COINS,
    ...SWAP_COINS.filter(c => !POPULAR_COINS.some(p => p.symbol === c.symbol)),
  ]

  const filteredCoins = allCoins.filter(coin =>
    coin.symbol.toLowerCase().includes(search.toLowerCase()) ||
    coin.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Select Asset</label>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-4 text-left hover:border-indigo-500/50 transition-all"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {selected ? (
          <>
            <CryptoLogo symbol={selected.symbol} size={32} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{selected.symbol}</span>
                {selected.isPopular && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">POPULAR</span>}
              </div>
              <div className="text-xs text-text-secondary">{selected.name} - {selected.network}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center gap-2 text-text-secondary">
            <Coins className="h-5 w-5" />
            <span>Choose cryptocurrency</span>
          </div>
        )}
        <ChevronDown className={`h-5 w-5 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-panel shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search coins..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:border-indigo-500/50"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filteredCoins.map((coin) => (
                <motion.button
                  key={coin.id}
                  onClick={() => { onSelect(coin); setIsOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface/50 ${selected?.id === coin.id ? 'bg-indigo-500/5 border-l-2 border-indigo-500' : ''}`}
                  whileHover={{ x: 4 }}
                >
                  <CryptoLogo symbol={coin.symbol} size={28} />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{coin.symbol}</span>
                      {coin.isPrivacy && <Lock className="h-3 w-3 text-purple-400" />}
                    </div>
                    <div className="text-xs text-text-secondary">{coin.name}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface PendingDeposit {
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

export default function DepositPage() {
  const { isConnected, connectEvm } = useWallet()

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
            <Wallet className="h-10 w-10 text-indigo-500" />
          </motion.div>
          <h2 className="mb-3 text-2xl font-bold">Connect Your Wallet</h2>
          <p className="mb-6 text-text-secondary">
            Connect an EVM wallet to deposit funds and generate API credits for AI inference services. Low-friction onboarding.
          </p>
          <motion.button
            onClick={() => connectEvm()}
            className="btn-primary flex items-center gap-2 mx-auto py-3 px-8"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap className="h-4 w-4" />
            Connect Base Wallet
          </motion.button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="mx-auto max-w-4xl px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <UnifiedDepositHeader />
      <UnifiedDepositInterface onDeposit={(d) => console.log(d)} />
    </motion.div>
  )
}

function UnifiedDepositHeader() {
  return (
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
          <Coins className="h-7 w-7 text-indigo-500" />
        </motion.div>
        <div>
          <h1 className="text-3xl font-bold">Deposit Credits</h1>
          <p className="text-text-secondary text-sm">
            Crypto-friendly credit system. Fund with USDC or swap from 100+ cryptocurrencies via Houdini-powered flow.
          </p>
        </div>
        <motion.span
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1.5 text-xs font-bold text-indigo-400 border border-indigo-500/30"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
        >
          <Hexagon className="h-3.5 w-3.5" />
          BASE
        </motion.span>
      </div>
    </motion.div>
  )
}

function UnifiedDepositInterface({ onDeposit }: { onDeposit: (d: PendingDeposit) => void }) {
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
    setStep('processing')

    try {
      if (selectedCoin?.id === 'usdc-base') {
        setProcessingStep('Requesting wallet signature...')
        const parsedAmount = parseUnits(amount, 6)
        const tx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [OMA_BASE_TREASURY as `0x${string}`, parsedAmount],
        })
        setProcessingStep('Transaction broadcasting...')
        setTxHash(tx)
        await publicClient!.waitForTransactionReceipt({ hash: tx })
        setProcessingStep('Crediting your account...')
        const result = await api.oma.depositUsdc(parseFloat(amount), tx)
        onDeposit({ id: result.id, status: result.status, amountCents: result.amountCents ?? '0', coin: 'USDC', createdAt: result.createdAt })
        toast.success(`Successfully deposited $${amount} USDC`)
        setStep('complete')
      } else {
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
    <div className="space-y-6">
      <motion.div
        className="rounded-2xl border border-border bg-panel p-6 shadow-2xl relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="absolute top-0 right-0 h-60 w-60 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 blur-3xl rounded-full pointer-events-none" />

        {step === 'select' && (
          <div className="space-y-6 relative">
            <CoinSelector selected={selectedCoin} onSelect={setSelectedCoin} />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Amount</label>
                {selectedCoin && <span className="text-xs text-text-secondary">Balance: {coinBalance ?? '--'}</span>}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full text-2xl font-bold bg-surface border border-border rounded-xl px-4 py-4 placeholder:text-text-secondary/30 focus:outline-none focus:border-indigo-500/50"
                />
                {selectedCoin && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <CryptoLogo symbol={selectedCoin.symbol} size={20} />
                    <span className="text-sm font-bold">{selectedCoin.symbol}</span>
                  </div>
                )}
              </div>
              {usdValue !== null && selectedCoin && (
                <div className="mt-2 text-sm text-text-secondary">
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
                    className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-surface transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    ${q}
                  </motion.button>
                ))}
              </div>
            )}

            {selectedCoin && amount && parseFloat(amount) > 0 && (
              <motion.div
                className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-secondary">Route</span>
                  {route.badge && (
                    <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-400">{route.badge}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10">
                    <ShieldCheck className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">{route.label}</div>
                    <div className="text-xs text-text-secondary">{route.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-secondary">Est. time</div>
                    <div className="text-sm font-medium">{route.estimatedTime}</div>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.button
              onClick={handleStartDeposit}
              disabled={!selectedCoin || !amount || parseFloat(amount) <= 0}
              className="btn-primary w-full py-4 text-base disabled:opacity-50"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {selectedCoin ? 'Continue' : 'Select an asset to continue'}
            </motion.button>
          </div>
        )}

        {step === 'route' && (
          <div className="space-y-6 relative">
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
              >
                <ArrowRightLeft className="h-8 w-8 text-indigo-500" />
              </motion.div>
              <h3 className="text-xl font-bold mb-2">Swap Required</h3>
              <p className="text-text-secondary text-sm">
                {selectedCoin?.symbol} is not directly supported. Use HoudiniSwap to convert to USDC.
              </p>
            </motion.div>

            <motion.div
              className="rounded-xl border border-border bg-surface p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <span className="font-medium">HoudiniSwap Integration</span>
              </div>
              <div className="space-y-2 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>100+ cryptocurrencies supported</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Cross-chain swaps</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Privacy enhanced routing via Monero tunnel</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="rounded-xl border border-purple-200 bg-purple-50/50 p-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Rocket className="h-5 w-5 text-purple-500" />
                <span className="font-medium">x402 Pay-Per-Request</span>
              </div>
              <p className="text-sm text-purple-700 mb-4">
                Create a payment link and share it with users. They can pay without connecting a wallet directly.
              </p>
              <div className="space-y-2 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Gasless transactions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Works on Solana and Base</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Automatic token conversion</span>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                onClick={handleReset}
                className="btn-secondary py-3"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
              >
                Back
              </motion.button>
              <motion.button
                onClick={handleCreatePaymentLink}
                disabled={creatingPaymentLink}
                className="btn-primary py-3 disabled:opacity-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
              >
                {creatingPaymentLink ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                {creatingPaymentLink ? 'Creating...' : 'Create Link'}
              </motion.button>
            </div>

            <div className="text-center">
              <a
                href="https://app.houdiniswap.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-400 hover:text-indigo-300 underline"
              >
                Open HoudiniSwap →
              </a>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <motion.div
            className="text-center py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {paymentLinkInfo ? (
              <>
                <motion.div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                >
                  <Link2 className="h-8 w-8 text-indigo-500" />
                </motion.div>
                <h3 className="text-xl font-bold mb-2">Payment Link Created</h3>
                <p className="text-text-secondary text-sm mb-4">Share this link with anyone to receive payment</p>
                
                <div className="bg-surface rounded-xl border border-border p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-secondary">Amount</span>
                    <span className="font-bold text-lg">${paymentLinkInfo.amount} {paymentLinkInfo.token}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-secondary">Chain</span>
                    <span className="font-medium capitalize">{paymentLinkInfo.chain}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Expires</span>
                    <span className="text-sm">{new Date(paymentLinkInfo.expiresAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-surface rounded-xl border border-border p-3 mb-4 break-all">
                  <div className="text-xs text-text-secondary mb-1">Payment Link</div>
                  <div className="text-sm font-mono text-indigo-400">{paymentLinkInfo.url}</div>
                </div>
                
                <div className="flex gap-3 justify-center">
                  <motion.button
                    onClick={async () => {
                      await navigator.clipboard.writeText(paymentLinkInfo.url)
                      toast.success('Copied to clipboard!')
                    }}
                    className="btn-secondary py-3 px-6"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Copy Link
                  </motion.button>
                  <motion.button
                    onClick={handleReset}
                    className="btn-primary py-3 px-6"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Done
                  </motion.button>
                </div>

                <p className="text-xs text-text-secondary mt-6">
                  Deposit ID: {paymentLinkInfo.depositId}<br/>
                  Credits will be added to your account once payment is confirmed via webhook.
                </p>
              </>
            ) : (
              <>
                <motion.div
                  className="mx-auto mb-6 h-16 w-16"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="h-16 w-16 text-indigo-500" />
                </motion.div>
                <h3 className="text-xl font-bold mb-2">Processing Deposit</h3>
                <p className="text-text-secondary text-sm mb-4">{processingStep}</p>
                {txHash && (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-text-secondary">Tx:</span>
                    <span className="text-xs font-mono text-indigo-500">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
                    <a href={`https://basescan.io/tx/${txHash}`} target="_blank" rel="noopener" className="text-indigo-500 hover:text-indigo-400">
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
            className="text-center py-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </motion.div>
            <h3 className="text-xl font-bold mb-2">Deposit Complete!</h3>
            <p className="text-text-secondary text-sm mb-6">Your credits have been added to your account.</p>
            <motion.button
              onClick={handleReset}
              className="btn-primary py-3 px-8"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.99 }}
            >
              Make Another Deposit
            </motion.button>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div
            className="text-center py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </motion.div>
            <h3 className="text-xl font-bold mb-2">Deposit Failed</h3>
            <p className="text-text-secondary text-sm mb-6">{error}</p>
            <motion.button
              onClick={handleReset}
              className="btn-primary py-3 px-8"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.99 }}
            >
              Try Again
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}