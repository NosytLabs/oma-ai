'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type DepositStatus } from '@/lib/api'
import { useCryptoPrices, formatPrice, formatPriceChange, getPriceChangeColor, calculateUsdValue } from '@/lib/prices'
import { CryptoLogo } from '@/components/ui/CryptoLogo'
import {
  Wallet,
  DollarSign,
  Coins,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Clock,
  Loader2,
  Hexagon,
  ExternalLink,
  ChevronDown,
  Search,
  Sparkles,
  Shield,
  TrendingUp,
  Route,
  Info,
  X,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useWriteContract, usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import { HoudiniSwapWidget } from '@/components/HoudiniSwapWidget'

// ============================================================================
// TYPES
// ============================================================================

type DepositStep = 'select' | 'route' | 'processing' | 'complete' | 'error'
type RouteType = 'direct-usdc' | 'oma-stake' | 'houdini-swap' | 'auto-detect'
type PrivacyLevel = 'standard' | 'private' | 'maximum'

interface CoinOption {
  id: string
  symbol: string
  name: string
  network: string
  logo?: string
  isPopular?: boolean
  isNative?: boolean
  isPrivacy?: boolean
  decimals: number
}

interface RouteInfo {
  type: RouteType
  label: string
  description: string
  estimatedTime: string
  feePercent: number
  feeFixed: number
  creditMultiplier: number
  privacyLevel: PrivacyLevel
  bestFor: string[]
  requiresApproval: boolean
  steps: string[]
}

interface DepositQuote {
  route: RouteInfo
  inputAmount: string
  inputCoin: CoinOption
  outputAmount: string
  outputCoin: CoinOption
  feeAmount: number
  totalCost: number
  estimatedCredits: number
  bonusCredits: number
  txHash?: string
  depositAddress?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const

const OMA_DEPOSIT_ABI = [
  { name: 'depositOma', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
] as const

const OMA_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_OMA_TOKEN || '0xa87EE81b2C0Bc659307ca2D9ffdC38514DD85263'
const OMA_DEPOSIT_CONTRACT = process.env.NEXT_PUBLIC_OMA_DEPOSIT || '0x0F7a3a8f4Da01637d1202bb5443fcF7F88F99fD2'
const OMA_BASE_TREASURY = process.env.NEXT_PUBLIC_BASE_TREASURY || '0x0000000000000000000000000000000000000000'
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// ============================================================================
// COIN DATA
// ============================================================================

const POPULAR_COINS: CoinOption[] = [
  { id: 'usdc-base', symbol: 'USDC', name: 'USD Coin', network: 'Base', isNative: true, decimals: 6 },
  { id: 'eth-base', symbol: 'ETH', name: 'Ethereum', network: 'Base', isNative: true, decimals: 18 },
  { id: 'weth-base', symbol: 'WETH', name: 'Wrapped Ether', network: 'Base', decimals: 18 },
  { id: 'oma-base', symbol: 'OMA', name: 'OMA Token', network: 'Base', decimals: 18 },
]

const SWAP_COINS: CoinOption[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', network: 'BTC', isPopular: true, decimals: 8 },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', network: 'ETH', isPopular: true, decimals: 18 },
  { id: 'sol', symbol: 'SOL', name: 'Solana', network: 'SOL', isPopular: true, decimals: 9 },
  { id: 'xmr', symbol: 'XMR', name: 'Monero', network: 'XMR', isPrivacy: true, decimals: 12 },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', network: 'DOGE', decimals: 8 },
  { id: 'ltc', symbol: 'LTC', name: 'Litecoin', network: 'LTC', decimals: 8 },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', network: 'ETH', decimals: 6 },
  { id: 'ada', symbol: 'ADA', name: 'Cardano', network: 'ADA', decimals: 6 },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', network: 'AVAX', decimals: 18 },
  { id: 'matic', symbol: 'MATIC', name: 'Polygon', network: 'MATIC', decimals: 18 },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', network: 'ETH', decimals: 18 },
  { id: 'uni', symbol: 'UNI', name: 'Uniswap', network: 'ETH', decimals: 18 },
  { id: 'aave', symbol: 'AAVE', name: 'Aave', network: 'ETH', decimals: 18 },
  { id: 'mkr', symbol: 'MKR', name: 'Maker', network: 'ETH', decimals: 18 },
  { id: 'snx', symbol: 'SNX', name: 'Synthetix', network: 'ETH', decimals: 18 },
]

// ============================================================================
// ROUTE CONFIGURATIONS
// ============================================================================

const ROUTES: Record<string, RouteInfo> = {
  'usdc-base': {
    type: 'direct-usdc',
    label: 'Direct USDC',
    description: 'Instant deposit directly to Base treasury',
    estimatedTime: '~30s',
    feePercent: 0,
    feeFixed: 0,
    creditMultiplier: 1.0,
    privacyLevel: 'standard',
    bestFor: ['Fastest settlement', 'Zero fees', 'Direct funding'],
    requiresApproval: false,
    steps: ['Transfer USDC to OMA treasury', 'Wait for confirmation', 'Credits issued'],
  },
  'oma-stake': {
    type: 'oma-stake',
    label: 'OMA Staking',
    description: 'Stake OMA and earn bonus credits instantly',
    estimatedTime: '~2-3 min',
    feePercent: 0,
    feeFixed: 0,
    creditMultiplier: 1.05,
    privacyLevel: 'standard',
    bestFor: ['5% bonus credits', 'Long-term holders', 'Staking rewards'],
    requiresApproval: true,
    steps: ['Approve OMA token spend', 'Execute staking deposit', 'Credits with bonus issued'],
  },
  'houdini-swap': {
    type: 'houdini-swap',
    label: 'Swap + Deposit',
    description: 'Convert any crypto to USDC on Base',
    estimatedTime: '5-15 min',
    feePercent: 0.5,
    feeFixed: 0.25,
    creditMultiplier: 1.0,
    privacyLevel: 'standard',
    bestFor: ['100+ cryptocurrencies', 'Cross-chain deposits', 'Beginners'],
    requiresApproval: false,
    steps: ['Get swap quote', 'Send crypto to swap address', 'Receive USDC on Base'],
  },
  'houdini-private': {
    type: 'houdini-swap',
    label: 'Private Swap',
    description: 'Privacy-enhanced swap with Monero mixing',
    estimatedTime: '15-45 min',
    feePercent: 1.0,
    feeFixed: 0.50,
    creditMultiplier: 1.0,
    privacyLevel: 'maximum',
    bestFor: ['Maximum privacy', 'Sensitive transactions', 'XMR deposits'],
    requiresApproval: false,
    steps: ['Privacy routing setup', 'Atomic swap initiation', 'Private settlement'],
  },
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface PendingDeposit {
  id: string
  status: DepositStatus['status']
  amountCents: string
  coin: string
  createdAt: string
  settledAt: string | null | undefined
}

export default function DepositPage() {
  const { isConnected, evmAddress, connectEvm } = useWallet()
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([])

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan/30 bg-cyan/10">
            <Wallet className="h-10 w-10 text-cyan" />
          </div>
          <h2 className="mb-3 text-2xl font-bold">Connect Your Wallet</h2>
          <p className="mb-6 text-text-dim">
            Connect an EVM wallet to deposit funds and generate API credits for OMA AI services.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={() => connectEvm()} className="btn-primary flex items-center justify-center gap-2 py-3 px-6">
              <Hexagon className="h-4 w-4" />
              Connect Base Wallet
            </button>
          </div>
          <p className="mt-6 text-xs text-text-dim">
            Supported: MetaMask, Coinbase Wallet, WalletConnect
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <UnifiedDepositHeader />
      <UnifiedDepositInterface evmAddress={evmAddress} onDeposit={(d) => setPendingDeposits((p) => [...p, d])} />
      {pendingDeposits.length > 0 && (
        <DepositTracker deposits={pendingDeposits} onUpdate={(id, status) => {
          setPendingDeposits((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)))
        }} onRemove={(id) => setPendingDeposits((prev) => prev.filter((d) => d.id !== id))} />
      )}
    </div>
  )
}

// ============================================================================
// UNIFIED DEPOSIT HEADER
// ============================================================================

function UnifiedDepositHeader() {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10">
          <Coins className="h-6 w-6 text-cyan" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Deposit Credits</h1>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-400 border border-blue-500/30">
          <Hexagon className="h-3 w-3" />
          BASE
        </span>
      </div>
      <p className="text-text-dim text-sm">
        Fund your account with USDC, OMA tokens, or swap from 100+ cryptocurrencies. Credits are 1:1 USD value, non-redeemable.
      </p>
    </div>
  )
}

// ============================================================================
// UNIFIED DEPOSIT INTERFACE
// ============================================================================

function UnifiedDepositInterface({ evmAddress, onDeposit }: { evmAddress?: `0x${string}`; onDeposit: (d: PendingDeposit) => void }) {
  const [step, setStep] = useState<DepositStep>('select')
  const [selectedCoin, setSelectedCoin] = useState<CoinOption | null>(null)
  const [amount, setAmount] = useState('')
  const [showSwapOnly, setShowSwapOnly] = useState(false)
  const [showHoudiniWidget, setShowHoudiniWidget] = useState(false)
  const [quote, setQuote] = useState<DepositQuote | null>(null)
  const [processingTxHash, setProcessingTxHash] = useState('')
  const [processingStep, setProcessingStep] = useState('')
  const [error, setError] = useState('')
  
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  // Real-time crypto prices with 30-second caching
  const { prices, isLoading: isLoadingPrices, error: priceError, refresh: refreshPrices } = useCryptoPrices()

  // Calculate USD value when amount or selected coin changes
  const usdValue = selectedCoin && amount 
    ? calculateUsdValue(selectedCoin.symbol, parseFloat(amount) || 0, prices)
    : null

  // Auto-detect route based on selected coin
  const detectRoute = useCallback((): RouteInfo => {
    if (!selectedCoin) return ROUTES['usdc-base']
    
    // Direct USDC on Base
    if (selectedCoin.id === 'usdc-base') return ROUTES['usdc-base']
    
    // OMA staking
    if (selectedCoin.id === 'oma-base') return ROUTES['oma-stake']
    
    // Privacy coin -> private swap
    if (selectedCoin.isPrivacy) return ROUTES['houdini-private']
    
    // All other coins -> standard swap
    return ROUTES['houdini-swap']
  }, [selectedCoin])

  // Calculate quote when amount changes
  useEffect(() => {
    if (!selectedCoin || !amount || parseFloat(amount) <= 0) {
      setQuote(null)
      return
    }

    const route = detectRoute()
    const inputAmount = parseFloat(amount)
    let feeAmount = 0
    let outputAmount = inputAmount

    if (route.type === 'houdini-swap') {
      feeAmount = (inputAmount * route.feePercent / 100) + route.feeFixed
      outputAmount = inputAmount - feeAmount
    }

    let bonusCredits = 0
    if (route.type === 'oma-stake') {
      bonusCredits = outputAmount * (route.creditMultiplier - 1)
    }

    setQuote({
      route,
      inputAmount: amount,
      inputCoin: selectedCoin,
      outputAmount: outputAmount.toFixed(2),
      outputCoin: { id: 'usdc-base', symbol: 'USDC', name: 'USD Coin', network: 'Base', decimals: 6 },
      feeAmount,
      totalCost: inputAmount,
      estimatedCredits: outputAmount + bonusCredits,
      bonusCredits,
    })
  }, [selectedCoin, amount, detectRoute])

  // Handle amount input with validation
  const handleAmountChange = (value: string) => {
    // Allow empty, numbers, and decimals
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  // Quick preset amounts
  const quickAmounts = selectedCoin?.id === 'usdc-base' || selectedCoin?.id === 'oma-base'
    ? [10, 50, 100, 500]
    : [50, 100, 500, 1000]

  // Start deposit flow
  const handleStartDeposit = async () => {
    if (!quote || !selectedCoin) return
    setError('')
    setStep('processing')

    try {
      if (quote.route.type === 'direct-usdc') {
        await handleDirectUsdcDeposit()
      } else if (quote.route.type === 'oma-stake') {
        await handleOmaStakeDeposit()
      } else {
        await handleHoudiniSwap()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deposit failed')
      setStep('error')
    } finally {
      // Reset state after processing
    }
  }

  // Direct USDC deposit
  const handleDirectUsdcDeposit = async () => {
    setProcessingStep('Requesting wallet signature...')
    const parsedAmount = parseUnits(amount, 6)
    
    const tx = await writeContractAsync({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [OMA_BASE_TREASURY as `0x${string}`, parsedAmount],
    })

    setProcessingStep('Transaction broadcasting...')
    setProcessingTxHash(tx)
    const receipt = await publicClient!.waitForTransactionReceipt({ hash: tx })
    
    if (receipt.status === 'reverted') {
      throw new Error('Transaction reverted on-chain')
    }

    setProcessingStep('Crediting your account...')
    const result = await api.depositUsdc(parseFloat(amount), tx)
    
    onDeposit({
      id: result.id,
      status: result.status,
      amountCents: result.amountCents ?? '0',
      coin: 'USDC',
      createdAt: result.createdAt,
      settledAt: result.settledAt,
    })

    setStep('complete')
  }

  // OMA staking deposit
  const handleOmaStakeDeposit = async () => {
    const parsedAmount = parseUnits(amount, 18)

    setProcessingStep('Approving OMA token spend...')
    const approveTx = await writeContractAsync({
      address: OMA_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [OMA_DEPOSIT_CONTRACT as `0x${string}`, parsedAmount],
    })

    setProcessingStep('Confirming approval transaction...')
    await publicClient!.waitForTransactionReceipt({ hash: approveTx })

    setProcessingStep('Executing staking deposit...')
    const stakeTx = await writeContractAsync({
      address: OMA_DEPOSIT_CONTRACT as `0x${string}`,
      abi: OMA_DEPOSIT_ABI,
      functionName: 'depositOma',
      args: [parsedAmount],
    })

    setProcessingTxHash(stakeTx)
    setProcessingStep('Confirming stake transaction...')
    await publicClient!.waitForTransactionReceipt({ hash: stakeTx })

    setProcessingStep('Crediting your account with bonus...')
    const result = await api.depositOma(parseFloat(amount), stakeTx)
    
    onDeposit({
      id: result.id,
      status: result.status,
      amountCents: result.amountCents ?? '0',
      coin: 'OMA',
      createdAt: result.createdAt,
      settledAt: result.settledAt,
    })

    setStep('complete')
  }

  // Houdini swap (placeholder - would integrate with actual Houdini API)
  const handleHoudiniSwap = async () => {
    setProcessingStep('Initializing swap...')
    // In production, this would call the HoudiniSwap API
    setProcessingStep('Awaiting deposit address...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Simulate deposit address generation
    setProcessingStep('Swap initiated. Send crypto to receive address.')
    setStep('select') // Return to select for user to copy address
  }

  // Reset state
  const handleReset = () => {
    setStep('select')
    setSelectedCoin(null)
    setAmount('')
    setQuote(null)
    setProcessingTxHash('')
    setProcessingStep('')
    setError('')
  }

  return (
    <div className="space-y-6">
      {/* Main Deposit Card */}
      <div className="rounded-2xl border border-border bg-panel p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-60 w-60 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 blur-3xl rounded-full pointer-events-none" />
        
        {step === 'select' && (
          <SelectStep
            selectedCoin={selectedCoin}
            setSelectedCoin={setSelectedCoin}
            amount={amount}
            setAmount={handleAmountChange}
            quickAmounts={quickAmounts}
            quote={quote}
            showSwapOnly={showSwapOnly}
            setShowSwapOnly={setShowSwapOnly}
            showHoudiniWidget={showHoudiniWidget}
            setShowHoudiniWidget={setShowHoudiniWidget}
            onStartDeposit={handleStartDeposit}
            evmAddress={evmAddress}
            isLoadingPrices={isLoadingPrices}
            priceError={priceError}
            prices={prices}
            refreshPrices={refreshPrices}
            usdValue={usdValue}
          />
        )}

        {step === 'processing' && (
          <ProcessingStep
            step={processingStep}
            txHash={processingTxHash}
            route={quote?.route}
          />
        )}

        {step === 'complete' && (
          <CompleteStep
            quote={quote}
            showSwapOnly={showSwapOnly}
            onDone={handleReset}
          />
        )}

        {step === 'error' && (
          <ErrorStep
            error={error}
            onRetry={handleReset}
          />
        )}
      </div>

      {/* Route Comparison Panel */}
      {step === 'select' && selectedCoin && (
        <RouteComparison selectedCoin={selectedCoin} onSelectRoute={(routeId) => {
          // Update quote based on selected route
          const route = ROUTES[routeId]
          if (quote && route) {
            setQuote({ ...quote, route })
          }
        }} />
      )}
    </div>
  )
}

// ============================================================================
// COIN SELECTOR COMPONENT
// ============================================================================

interface CoinSelectorProps {
  selected: CoinOption | null
  onSelect: (coin: CoinOption) => void
  showSwapOnly: boolean
}

function CoinSelector({ selected, onSelect }: CoinSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Combine and sort coins
  const allCoins = [
    ...POPULAR_COINS.map(c => ({ ...c, isPopular: true })),
    ...SWAP_COINS.filter(c => !POPULAR_COINS.some(p => p.symbol === c.symbol)),
  ]

  // Filter by search
  const filteredCoins = allCoins.filter(coin =>
    coin.symbol.toLowerCase().includes(search.toLowerCase()) ||
    coin.name.toLowerCase().includes(search.toLowerCase()) ||
    coin.network.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-dim">
        Select Asset
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left hover:border-cyan/50 transition-all"
      >
        {selected ? (
          <>
            <CryptoLogo symbol={selected.symbol} size={32} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-text">{selected.symbol}</span>
                {selected.isPopular && (
                  <span className="rounded bg-amber/20 px-1.5 py-0.5 text-[10px] font-bold text-amber">POPULAR</span>
                )}
                {selected.isPrivacy && (
                  <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-400">PRIVATE</span>
                )}
              </div>
              <div className="text-xs text-text-dim">{selected.name} • {selected.network}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center gap-2 text-text-dim">
            <Coins className="h-5 w-5" />
            <span>Choose cryptocurrency</span>
          </div>
        )}
        <ChevronDown className={`h-5 w-5 text-text-dim transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-panel shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
              <input
                type="text"
                placeholder="Search coins..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text placeholder:text-text-dim/50 focus:outline-none focus:border-cyan/50"
                autoFocus
              />
            </div>
          </div>

          {/* Coin list */}
          <div className="max-h-80 overflow-y-auto">
            {/* Popular section */}
            {!search && (
              <div className="px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Popular</div>
              </div>
            )}
            {filteredCoins.filter(c => c.isPopular).map((coin) => (
              <button
                key={coin.id}
                onClick={() => { onSelect(coin); setIsOpen(false); setSearch(''); }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface/50 transition-colors ${selected?.id === coin.id ? 'bg-cyan/5 border-l-2 border-cyan' : ''}`}
              >
                <CryptoLogo symbol={coin.symbol} size={28} />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text">{coin.symbol}</span>
                    {coin.isPrivacy && <Lock className="h-3 w-3 text-purple-400" />}
                  </div>
                  <div className="text-xs text-text-dim">{coin.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-text-dim">{coin.network}</div>
                </div>
              </button>
            ))}

            {/* All coins section */}
            {filteredCoins.filter(c => !c.isPopular).length > 0 && (
              <>
                {!search && (
                  <div className="px-3 py-2 border-t border-border">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-dim">All Assets</div>
                  </div>
                )}
                {filteredCoins.filter(c => !c.isPopular).map((coin) => (
                  <button
                    key={coin.id}
                    onClick={() => { onSelect(coin); setIsOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface/50 transition-colors ${selected?.id === coin.id ? 'bg-cyan/5 border-l-2 border-cyan' : ''}`}
                  >
                    <CryptoLogo symbol={coin.symbol} size={28} />
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text">{coin.symbol}</span>
                        {coin.isPrivacy && <Lock className="h-3 w-3 text-purple-400" />}
                      </div>
                      <div className="text-xs text-text-dim">{coin.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono text-text-dim">{coin.network}</div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {filteredCoins.length === 0 && (
              <div className="px-4 py-8 text-center text-text-dim text-sm">
                No coins found for &ldquo;{search}&rdquo;
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="px-4 py-3 border-t border-border bg-surface/50">
            <div className="flex items-center gap-2 text-xs text-text-dim">
              <Info className="h-3 w-3" />
              <span>Native Base assets settle fastest. Swap assets take 5-45 min.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SELECT STEP
// ============================================================================

interface SelectStepProps {
  selectedCoin: CoinOption | null
  setSelectedCoin: (coin: CoinOption) => void
  amount: string
  setAmount: (amount: string) => void
  quickAmounts: number[]
  quote: DepositQuote | null
  showSwapOnly: boolean
  setShowSwapOnly: (show: boolean) => void
  showHoudiniWidget: boolean
  setShowHoudiniWidget: (show: boolean) => void
  onStartDeposit: () => void
  evmAddress?: `0x${string}`
  isLoadingPrices?: boolean
  priceError?: string | null
  prices?: { sol: { price: number } | null; btc: { price: number; change24h: number } | null; eth: { price: number; change24h: number } | null }
  refreshPrices?: () => void
  usdValue?: number | null
}

function SelectStep({ 
  selectedCoin, 
  setSelectedCoin, 
  amount, 
  setAmount, 
  quickAmounts, 
  quote, 
  showSwapOnly, 
  setShowSwapOnly,
  onStartDeposit, 
  evmAddress,
  isLoadingPrices,
  priceError,
  prices,
  refreshPrices,
  usdValue,
}: SelectStepProps) {
  const houdiniApiKey = process.env.NEXT_PUBLIC_HOUDINI_API_KEY || ''

  return (
    <div className="space-y-6">
      {/* Coin Selector */}
      <CoinSelector selected={selectedCoin} onSelect={setSelectedCoin} showSwapOnly={showSwapOnly} />

      {/* Amount Input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
            Amount
          </label>
          {selectedCoin && (
            <span className="text-xs text-text-dim font-mono">
              Balance: <span className="text-cyan">--</span>
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full font-mono text-2xl font-bold bg-surface border border-border rounded-xl px-4 py-4 text-text placeholder:text-text-dim/30 focus:outline-none focus:border-cyan/50 transition-all"
          />
          {selectedCoin && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <CryptoLogo symbol={selectedCoin.symbol} size={20} />
              <span className="text-sm font-bold text-text-dim">{selectedCoin.symbol}</span>
            </div>
          )}
        </div>
        
        {/* Live Price Display */}
        {selectedCoin && prices && (selectedCoin.symbol === 'SOL' || selectedCoin.symbol === 'BTC' || selectedCoin.symbol === 'ETH') && (
          <div className="mt-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {isLoadingPrices ? (
                <span className="text-xs text-text-dim">Loading price...</span>
              ) : priceError ? (
                <span className="text-xs text-red-400">Price unavailable</span>
              ) : (
                <>
                  <span className="text-xs text-text-dim">1 {selectedCoin.symbol} =</span>
                  <span className="font-mono font-bold text-cyan">
                    ${formatPrice(
                      selectedCoin.symbol === 'SOL' ? prices.sol?.price ?? null :
                      selectedCoin.symbol === 'BTC' ? prices.btc?.price ?? null :
                      prices.eth?.price ?? null
                    )}
                  </span>
                  {selectedCoin.symbol !== 'SOL' && (
                    <span className={`text-xs font-mono ${getPriceChangeColor(
                      selectedCoin.symbol === 'BTC' ? prices.btc?.change24h ?? 0 :
                      prices.eth?.change24h ?? 0
                    )}`}>
                      {formatPriceChange(
                        selectedCoin.symbol === 'BTC' ? prices.btc?.change24h ?? 0 :
                        prices.eth?.change24h ?? 0
                      )}
                    </span>
                  )}
                  {refreshPrices && (
                    <button 
                      onClick={() => refreshPrices()} 
                      className="ml-1 text-text-dim hover:text-cyan transition-colors"
                      title="Refresh prices"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                </>
              )}
            </div>
            {usdValue !== null && usdValue !== undefined && amount && (
              <div className="text-right">
                <span className="text-xs text-text-dim">=</span>
                <span className="ml-1 font-mono font-bold text-green">${usdValue.toFixed(2)} USD</span>
              </div>
            )}
          </div>
        )}
        
        {/* Quick Amounts */}
        {selectedCoin && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {quickAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(String(preset))}
                className="rounded-lg border border-border bg-surface py-2 text-xs font-mono text-text-dim hover:border-cyan hover:text-cyan hover:bg-cyan/5 transition-all"
              >
                ${preset}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Swap Only Toggle */}
      {selectedCoin && selectedCoin.id !== 'usdc-base' && selectedCoin.id !== 'oma-base' && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                <ArrowRightLeft className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <div className="font-semibold text-sm">Swap Only Mode</div>
                <div className="text-xs text-text-dim">Receive crypto directly, bypass OMA credits</div>
              </div>
            </div>
            <button
              onClick={() => setShowSwapOnly(!showSwapOnly)}
              className={`relative w-12 h-6 rounded-full transition-colors ${showSwapOnly ? 'bg-purple-500' : 'bg-border'}`}
            >
              <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${showSwapOnly ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          {showSwapOnly && (
            <div className="mt-3 text-xs text-text-dim bg-purple-500/10 rounded-lg p-3">
              In swap-only mode, your crypto is sent to HoudiniSwap and you receive the swapped asset directly. OMA earns commission but you do not receive credits.
            </div>
          )}
        </div>
      )}

      {/* HoudiniSwap Widget Button */}
      <div className="rounded-xl border border-cyan/20 bg-gradient-to-br from-cyan/5 to-blue-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan/20">
              <ArrowRightLeft className="h-5 w-5 text-cyan" />
            </div>
            <div>
              <div className="font-semibold text-sm">HoudiniSwap Widget</div>
              <div className="text-xs text-text-dim">Open the embedded swap interface for 100+ coins</div>
            </div>
          </div>
          <HoudiniSwapWidget
            apiKey={houdiniApiKey}
            addressTo={OMA_BASE_TREASURY}
            primaryColor="#00ffc8"
            onSwapComplete={(result) => {
              console.log('Swap completed:', result)
              // Handle successful swap
            }}
            onSwapError={(error) => {
              console.error('Swap error:', error)
            }}
          />
        </div>
      </div>

      {/* Quote Display */}
      {quote && (
        <QuoteDisplay quote={quote} showSwapOnly={showSwapOnly} />
      )}

      {/* Wallet Status */}
      {evmAddress && (
        <div className="flex items-center justify-between rounded-xl border border-cyan/20 bg-cyan/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Hexagon className="h-4 w-4 text-cyan animate-pulse" />
            <span className="text-xs text-text-dim">Connected</span>
          </div>
          <span className="font-mono text-sm font-bold text-cyan">{evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}</span>
        </div>
      )}

      {/* Deposit Button */}
      <button
        onClick={onStartDeposit}
        disabled={!selectedCoin || !amount || parseFloat(amount) <= 0}
        className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed group transition-all relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-cyan-500/0 group-hover:animate-pulse" />
        <Zap className="h-5 w-5 text-cyan group-hover:scale-110 transition-transform" />
        <span>{showSwapOnly ? 'Start Swap' : 'Deposit Now'}</span>
      </button>
    </div>
  )
}

// ============================================================================
// QUOTE DISPLAY
// ============================================================================

function QuoteDisplay({ quote, showSwapOnly }: { quote: DepositQuote; showSwapOnly: boolean }) {
  return (
    <div className="rounded-xl border border-cyan/20 bg-gradient-to-br from-cyan/5 to-purple-500/5 p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan">
        <Sparkles className="h-4 w-4" />
        Route Detected
      </div>

      {/* Route Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${quote.route.type === 'direct-usdc' ? 'bg-blue-500/20' : quote.route.type === 'oma-stake' ? 'bg-purple-500/20' : 'bg-amber-500/20'}`}>
            {quote.route.type === 'direct-usdc' ? <DollarSign className="h-5 w-5 text-blue-400" /> :
             quote.route.type === 'oma-stake' ? <Coins className="h-5 w-5 text-purple-400" /> :
             <ArrowRightLeft className="h-5 w-5 text-amber-400" />}
          </div>
          <div>
            <div className="font-bold">{quote.route.label}</div>
            <div className="text-xs text-text-dim">{quote.route.description}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-dim">Est. Time</div>
          <div className="font-mono font-bold text-cyan">{quote.route.estimatedTime}</div>
        </div>
      </div>

      {/* Exchange Preview */}
      <div className="rounded-lg bg-surface/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-dim">You send</span>
          <div className="flex items-center gap-2 font-mono">
            <CryptoLogo symbol={quote.inputCoin.symbol} size={16} />
            <span className="font-bold">{quote.inputAmount} {quote.inputCoin.symbol}</span>
          </div>
        </div>
        
        {!showSwapOnly && (
          <>
            <div className="flex items-center justify-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan/20">
                <TrendingUp className="h-3 w-3 text-cyan" />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-dim">You receive</span>
              <div className="flex items-center gap-2 font-mono">
                <CryptoLogo symbol="USDC" size={16} />
                <span className="font-bold text-cyan">{quote.outputAmount} USDC</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fee Breakdown */}
      {quote.feeAmount > 0 && (
        <div className="flex items-center justify-between text-xs border-t border-border pt-3">
          <span className="text-text-dim">Swap fees</span>
          <span className="font-mono text-amber">-${quote.feeAmount.toFixed(2)}</span>
        </div>
      )}

      {/* Credits Estimate */}
      {!showSwapOnly && (
        <div className="rounded-lg border border-green/20 bg-green/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-green">Estimated Credits</span>
            {quote.bonusCredits > 0 && (
              <span className="rounded bg-green/20 px-2 py-0.5 text-[10px] font-bold text-green">
                +{quote.bonusCredits.toFixed(2)} BONUS
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-dim text-sm">Total credits to your account</span>
            <span className="text-2xl font-mono font-bold text-green">${quote.estimatedCredits.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Privacy Badge */}
      {quote.route.privacyLevel === 'maximum' && (
        <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 px-3 py-2 text-xs">
          <Shield className="h-4 w-4 text-purple-400" />
          <span className="text-purple-300">Maximum privacy routing enabled</span>
        </div>
      )}

      {/* Best For */}
      <div className="flex flex-wrap gap-2">
        {quote.route.bestFor.map((tag, i) => (
          <span key={i} className="rounded-full bg-surface px-3 py-1 text-xs text-text-dim">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// ROUTE COMPARISON
// ============================================================================

function RouteComparison({ selectedCoin, onSelectRoute }: { selectedCoin: CoinOption; onSelectRoute: (routeId: string) => void }) {
  // Determine which routes are available for this coin
  const availableRoutes = [
    { id: 'usdc-base', available: selectedCoin.id === 'usdc-base' },
    { id: 'oma-stake', available: selectedCoin.id === 'oma-base' },
    { id: 'houdini-swap', available: selectedCoin.id !== 'usdc-base' && selectedCoin.id !== 'oma-base' && !selectedCoin.isPrivacy },
    { id: 'houdini-private', available: selectedCoin.isPrivacy === true },
  ].filter(r => r.available).map(r => ({ id: r.id, route: ROUTES[r.id] }))

  if (availableRoutes.length <= 1) return null

  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="flex items-center gap-2 mb-4">
        <Route className="h-4 w-4 text-text-dim" />
        <h3 className="text-sm font-bold">Available Routes</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {availableRoutes.map(({ id, route }) => (
          <button
            key={id}
            onClick={() => onSelectRoute(id)}
            className="rounded-lg border border-border bg-surface p-4 text-left hover:border-cyan/50 transition-all group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-sm group-hover:text-cyan transition-colors">{route.label}</span>
              {route.creditMultiplier > 1 && (
                <span className="rounded bg-green/20 px-1.5 py-0.5 text-[10px] font-bold text-green">
                  +{((route.creditMultiplier - 1) * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="text-xs text-text-dim mb-2">{route.description}</div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-text-dim">{route.estimatedTime}</span>
              {route.feePercent > 0 && (
                <span className="font-mono text-amber">{route.feePercent}% fee</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// PROCESSING STEP
// ============================================================================

function ProcessingStep({ step, txHash, route }: { step: string; txHash: string; route?: RouteInfo }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cyan/20 border border-cyan/30">
        <Loader2 className="h-10 w-10 text-cyan animate-spin" />
      </div>
      <h3 className="mb-2 text-xl font-bold">Processing {route?.label || 'Deposit'}</h3>
      <p className="text-text-dim mb-6">{step}</p>
      
      {txHash && (
        <div className="rounded-lg border border-border bg-surface p-4 max-w-md mx-auto">
          <div className="text-xs text-text-dim mb-1">Transaction Hash</div>
          <div className="font-mono text-sm text-cyan break-all">{txHash}</div>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-cyan hover:underline"
          >
            View on Explorer <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      <div className="mt-6 space-y-3 max-w-sm mx-auto">
        {route?.steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-left">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan/20 text-cyan text-xs font-bold">
              {i + 1}
            </div>
            <span className="text-sm text-text-dim">{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// COMPLETE STEP
// ============================================================================

function CompleteStep({ quote, showSwapOnly, onDone }: { quote: DepositQuote | null; showSwapOnly: boolean; onDone: () => void }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green/20 border border-green/30">
        <CheckCircle2 className="h-10 w-10 text-green" />
      </div>
      <h3 className="mb-2 text-xl font-bold text-green">Deposit Successful!</h3>
      {quote && !showSwapOnly && (
        <p className="text-text-dim mb-2">
          {quote.estimatedCredits.toFixed(2)} credits have been added to your account
        </p>
      )}
      {quote?.bonusCredits && quote.bonusCredits > 0 && (
        <div className="inline-flex items-center gap-2 rounded-full bg-green/20 px-4 py-2 text-sm text-green mb-4">
          <Sparkles className="h-4 w-4" />
          +{quote.bonusCredits.toFixed(2)} bonus credits earned
        </div>
      )}
      
      <div className="flex gap-3 justify-center mt-6">
        <Link href="/dashboard" className="btn-primary px-6">
          View Dashboard
          <ExternalLink className="ml-2 h-4 w-4" />
        </Link>
        <button onClick={onDone} className="btn-secondary px-6">
          Deposit More
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// ERROR STEP
// ============================================================================

function ErrorStep({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-pink/20 border border-pink/30">
        <AlertTriangle className="h-10 w-10 text-pink" />
      </div>
      <h3 className="mb-2 text-xl font-bold text-pink">Deposit Failed</h3>
      <p className="text-text-dim mb-4 text-sm max-w-md mx-auto break-words bg-pink/5 rounded-lg p-4 border border-pink/20">
        {error}
      </p>
      <button onClick={onRetry} className="btn-primary px-8">
        Try Again
      </button>
    </div>
  )
}

// ============================================================================
// DEPOSIT TRACKER
// ============================================================================

function DepositTracker({ deposits, onUpdate, onRemove }: {
  deposits: PendingDeposit[]
  onUpdate: (id: string, status: DepositStatus['status']) => void
  onRemove: (id: string) => void
}) {
  const [elapsed, setElapsed] = useState<Record<string, string>>({})

  useEffect(() => {
    const active = deposits.filter((d) => d.status === 'pending' || d.status === 'settling')
    if (active.length === 0) return

    const interval = setInterval(async () => {
      for (const d of active) {
        try {
          const result = await api.getDepositStatus(d.id)
          onUpdate(d.id, result.status)
        } catch {
          // continue polling
        }
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [deposits, onUpdate])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      const next: Record<string, string> = {}
      for (const d of deposits) {
        const created = new Date(d.createdAt).getTime()
        const diff = now - created
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        next[d.id] = `${mins}m ${secs.toString().padStart(2, '0')}s`
      }
      setElapsed(next)
    }, 1000)
    return () => clearInterval(timer)
  }, [deposits])

  if (deposits.length === 0) return null

  return (
    <div className="mt-8 rounded-xl border border-border bg-panel p-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
        <Clock className="h-4 w-4 text-amber" />
        Pending Deposits ({deposits.length})
      </h3>
      <div className="space-y-3">
        {deposits.map((d) => (
          <DepositStatusCard key={d.id} deposit={d} elapsed={elapsed[d.id] || '0m 00s'} onRemove={onRemove} />
        ))}
      </div>
    </div>
  )
}

function DepositStatusCard({ deposit, elapsed, onRemove }: {
  deposit: PendingDeposit
  elapsed: string
  onRemove: (id: string) => void
}) {
  const isActive = deposit.status === 'pending' || deposit.status === 'settling'
  const isComplete = deposit.status === 'completed'
  const isFailed = deposit.status === 'failed' || deposit.status === 'expired'

  const statusIcon = () => {
    if (isActive) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber animate-pulse" />
    if (isComplete) return <CheckCircle2 className="h-4 w-4 text-green" />
    if (isFailed) return <AlertTriangle className="h-4 w-4 text-pink" />
    return null
  }

  const labelMap: Record<DepositStatus['status'], string> = {
    pending: 'PENDING',
    settling: 'SETTLING',
    completed: 'COMPLETED',
    failed: 'FAILED',
    expired: 'EXPIRED',
    refunded: 'REFUNDED',
  }

  const colorMap: Record<DepositStatus['status'], string> = {
    pending: 'text-amber',
    settling: 'text-amber',
    completed: 'text-green',
    failed: 'text-pink',
    expired: 'text-pink',
    refunded: 'text-amber',
  }

  return (
    <div className={`rounded-lg border bg-surface px-4 py-3 text-xs flex items-center justify-between ${
      isActive ? 'border-amber/30' : isComplete ? 'border-green/30' : 'border-pink/30'
    }`}>
      <div className="flex items-center gap-3">
        {statusIcon()}
        <CryptoLogo symbol={deposit.coin} size={20} />
        <span className="font-mono font-bold text-text">{deposit.coin}</span>
        <span className="font-mono text-text-dim">${(parseInt(deposit.amountCents) / 100).toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-4">
        {isActive && <span className="font-mono text-text-dim">{elapsed}</span>}
        <span className={`font-bold ${colorMap[deposit.status]}`}>{labelMap[deposit.status]}</span>
        {!isActive && (
          <button onClick={() => onRemove(deposit.id)} className="text-text-dim hover:text-text transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}