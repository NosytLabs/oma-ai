'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useWallet } from '@/components/wallet-provider'
import { api, type Token, type Quote } from '@/lib/api'
import { CryptoLogo } from '@/components/ui/CryptoLogo'
import {
  ArrowRightLeft,
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Shield,
  Wallet,
  Hexagon,
  Search,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronRight,
  Settings,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

type SwapStep = 'select' | 'quote' | 'confirm' | 'swapping' | 'complete' | 'error'

interface SwapState {
  fromToken: Token | null
  toToken: Token | null
  fromAmount: string
  toAmount: string
  quote: Quote | null
  depositAddress: string
  orderId: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BLOCKCHAIN = 'BASE'
const SWAP_FEE_PERCENT = 0.5

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SwapPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-8" style={{ background: '#fafafa' }}>
      <div className="mx-auto max-w-md">
        <SwapHeader />
        <SwapInterface />
        <SwapFooter />
      </div>
    </div>
  )
}

// ============================================================================
// HEADER
// ============================================================================

function SwapHeader() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center gap-3 mb-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#6366f1]/30 bg-[#6366f1]/10 shadow-lg">
          <ArrowRightLeft className="h-7 w-7 text-[#6366f1]" />
        </div>
      </div>
      <h1 className="text-3xl font-bold mb-2 text-zinc-900" style={{ fontFamily: 'var(--font-syne)' }}>
        Swap Crypto
      </h1>
      <p className="text-sm text-zinc-500">
        Exchange 100+ cryptocurrencies directly to your wallet
      </p>
    </div>
  )
}

// ============================================================================
// SWAP INTERFACE
// ============================================================================

function SwapInterface() {
  const { isConnected, evmAddress, connectEvm } = useWallet()
  
  return (
    <div className="rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.08)]">
      {!isConnected ? (
        <WalletConnectPrompt onConnect={connectEvm} />
      ) : (
        <SwapForm evmAddress={evmAddress} />
      )}
    </div>
  )
}

// ============================================================================
// WALLET CONNECT PROMPT
// ============================================================================

function WalletConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[#6366f1]/30 bg-[#6366f1]/10">
        <Wallet className="h-10 w-10 text-[#6366f1]" />
      </div>
      <h2 className="mb-3 text-2xl font-bold text-zinc-900">Connect Your Wallet</h2>
      <p className="mb-6 text-sm text-zinc-500 max-w-xs mx-auto">
        Connect your Base wallet to start swapping cryptocurrencies directly, no OMA credits required.
      </p>
      <button
        onClick={onConnect}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6366f1] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 transition-all hover:bg-[#4f46e5] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#6366f1]/30"
      >
        <Hexagon className="h-4 w-4" />
        Connect Base Wallet
      </button>
      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-500" />
          MetaMask
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-500" />
          Coinbase
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-500" />
          WalletConnect
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// SWAP FORM
// ============================================================================

function SwapForm({ evmAddress }: { evmAddress?: `0x${string}` }) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [isLoadingTokens, setIsLoadingTokens] = useState(true)
  const [step, setStep] = useState<SwapStep>('select')
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [privacyMode, setPrivacyMode] = useState(false)
  const [slippage, setSlippage] = useState(0.5)
  const [showSettings, setShowSettings] = useState(false)

  const [swapState, setSwapState] = useState<SwapState>({
    fromToken: null,
    toToken: null,
    fromAmount: '',
    toAmount: '',
    quote: null,
    depositAddress: '',
    orderId: '',
  })

  // Load tokens on mount
  useEffect(() => {
    const fetchTokens = async () => {
      setIsLoadingTokens(true)
      try {
        const fetchedTokens = await api.deposit.houdiniTokens(DEFAULT_BLOCKCHAIN)
        setTokens(fetchedTokens)
        
        // Set defaults
        const btc = fetchedTokens.find((t: Token) => t.symbol === 'BTC') || fetchedTokens[0]
        const usdc = fetchedTokens.find((t: Token) => t.symbol === 'USDC') || fetchedTokens[2]
        setSwapState(prev => ({ ...prev, fromToken: btc, toToken: usdc }))
      } catch {
        const fallback: Token[] = [
          { id: 'BTC', symbol: 'BTC', name: 'Bitcoin', decimals: 8, address: '', blockchain: 'BTC' },
          { id: 'ETH', symbol: 'ETH', name: 'Ethereum', decimals: 18, address: '', blockchain: 'ETH' },
          { id: 'USDC', symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '', blockchain: 'BASE' },
          { id: 'SOL', symbol: 'SOL', name: 'Solana', decimals: 9, address: '', blockchain: 'SOL' },
          { id: 'XMR', symbol: 'XMR', name: 'Monero', decimals: 12, address: '', blockchain: 'XMR' },
          { id: 'DOGE', symbol: 'DOGE', name: 'Dogecoin', decimals: 8, address: '', blockchain: 'DOGE' },
          { id: 'ETH', symbol: 'ETH', name: 'Ethereum', decimals: 18, address: '', blockchain: 'ETH' },
          { id: 'USDT', symbol: 'USDT', name: 'Tether', decimals: 6, address: '', blockchain: 'ETH' },
        ]
        setTokens(fallback)
        setSwapState(prev => ({
          ...prev,
          fromToken: fallback[0],
          toToken: fallback[2],
        }))
      } finally {
        setIsLoadingTokens(false)
      }
    }
    fetchTokens()
  }, [])

  const handleGetQuote = useCallback(async () => {
    if (!swapState.fromToken || !swapState.toToken || !swapState.fromAmount || parseFloat(swapState.fromAmount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setIsLoadingQuote(true)
    setError('')

    try {
      const quotes = await api.deposit.houdiniQuote(
        swapState.fromToken.symbol,
        swapState.toToken.symbol,
        swapState.fromAmount,
        privacyMode ? 'private' : undefined
      )

      if (quotes && quotes.length > 0) {
        const bestQuote = quotes[0]
        setSwapState(prev => ({
          ...prev,
          quote: bestQuote,
          toAmount: bestQuote.toAmount,
        }))
        setStep('quote')
      } else {
        throw new Error('No quote available for this pair')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get quote. Please try again.'
      setError(message)
    } finally {
      setIsLoadingQuote(false)
    }
  }, [swapState.fromToken, swapState.toToken, swapState.fromAmount, privacyMode])

  const handleExecuteSwap = useCallback(async () => {
    if (!swapState.quote || !evmAddress) return

    setIsExecuting(true)
    setError('')
    setStep('swapping')

    try {
      const result = await api.deposit.houdiniExchange(
        swapState.quote.quoteId,
        swapState.fromToken!.symbol,
        swapState.fromAmount,
        evmAddress
      )

      setSwapState(prev => ({
        ...prev,
        depositAddress: result.depositAddress,
        orderId: result.orderId || result.depositId,
      }))
      setStep('confirm')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to execute swap. Please try again.'
      setError(message)
      setStep('error')
    } finally {
      setIsExecuting(false)
    }
  }, [swapState.quote, swapState.fromToken, swapState.fromAmount, evmAddress])

  const handleSwitchTokens = () => {
    setSwapState(prev => ({
      ...prev,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
      fromAmount: prev.toAmount,
      toAmount: prev.fromAmount,
      quote: null,
    }))
    if (step === 'quote') setStep('select')
  }

  const handleReset = () => {
    setStep('select')
    setSwapState(prev => ({
      ...prev,
      fromAmount: '',
      toAmount: '',
      quote: null,
      depositAddress: '',
      orderId: '',
    }))
    setError('')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Settings Button */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-500 transition-all hover:border-[#6366f1]/50 hover:text-[#6366f1]"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              {[0.5, 1.0, 3.0].map(val => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    slippage === val
                      ? 'bg-[#6366f1] text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:border-[#6366f1]/50'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">Privacy Mode</span>
            <button
              onClick={() => setPrivacyMode(!privacyMode)}
              className={`relative flex h-6 w-11 items-center rounded-full transition-colors ${
                privacyMode ? 'bg-[#f43f5e]' : 'bg-zinc-300'
              }`}
            >
              <div className={`absolute h-4 w-4 rounded-full bg-white shadow transition-all ${
                privacyMode ? 'left-6' : 'left-1'
              }`} />
            </button>
          </div>
          {privacyMode && (
            <div className="flex items-start gap-2 rounded-lg bg-[#f43f5e]/10 p-3">
              <Shield className="h-4 w-4 text-[#f43f5e] mt-0.5" />
              <p className="text-xs text-zinc-600">
                Privacy mode routes through Monero for enhanced transaction privacy. Fees are higher.
              </p>
            </div>
          )}
        </div>
      )}

      {/* From Token */}
      <TokenInputCard
        label="You Pay"
        tokens={tokens}
        selectedToken={swapState.fromToken}
        amount={swapState.fromAmount}
        onAmountChange={(value) => setSwapState(prev => ({ ...prev, fromAmount: value, quote: null }))}
        onSelectToken={(token) => setSwapState(prev => ({ ...prev, fromToken: token, quote: null }))}
        otherToken={swapState.toToken}
        isLoading={isLoadingTokens}
      />

      {/* Switch Button */}
      <div className="flex justify-center -my-1">
        <button
          onClick={handleSwitchTokens}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-md hover:border-[#6366f1]/50 hover:scale-110 transition-all"
        >
          <ArrowRightLeft className="h-4 w-4 text-zinc-400" />
        </button>
      </div>

      {/* To Token */}
      <TokenInputCard
        label="You Receive"
        tokens={tokens}
        selectedToken={swapState.toToken}
        amount={swapState.toAmount}
        onAmountChange={() => {}}
        onSelectToken={(token) => setSwapState(prev => ({ ...prev, toToken: token, quote: null }))}
        otherToken={swapState.fromToken}
        isLoading={isLoadingTokens}
        isOutput
      />

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Quote Step */}
      {step === 'quote' && swapState.quote && (
        <QuoteCard
          swapState={swapState}
          slippage={slippage}
          privacyMode={privacyMode}
          onBack={() => setStep('select')}
          onConfirm={handleExecuteSwap}
          isExecuting={isExecuting}
        />
      )}

      {/* Swapping Step */}
      {step === 'swapping' && <SwappingCard />}

      {/* Confirm Step */}
      {step === 'confirm' && swapState.depositAddress && (
        <DepositAddressCard
          swapState={swapState}
          copied={copied}
          onCopy={copyToClipboard}
          onDone={handleReset}
        />
      )}

      {/* Error Step */}
      {step === 'error' && (
        <ErrorCard error={error} onRetry={handleReset} />
      )}

      {/* Get Quote Button */}
      {step === 'select' && (
        <button
          onClick={handleGetQuote}
          disabled={!swapState.fromToken || !swapState.toToken || !swapState.fromAmount || parseFloat(swapState.fromAmount) <= 0 || isLoadingQuote}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-[#6366f1] py-4 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 transition-all hover:bg-[#4f46e5] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#6366f1]/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isLoadingQuote ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Getting Quote...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Get Quote
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ============================================================================
// TOKEN INPUT CARD
// ============================================================================

interface TokenInputCardProps {
  label: string
  tokens: Token[]
  selectedToken: Token | null
  amount: string
  onAmountChange: (value: string) => void
  onSelectToken: (token: Token) => void
  otherToken: Token | null
  isLoading: boolean
  isOutput?: boolean
}

function TokenInputCard({
  label,
  tokens,
  selectedToken,
  amount,
  onAmountChange,
  onSelectToken,
  otherToken,
  isLoading,
  isOutput,
}: TokenInputCardProps) {
  const [showSelector, setShowSelector] = useState(false)
  const [search, setSearch] = useState('')

  const filteredTokens = useMemo(() => {
    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(search.toLowerCase()) ||
        token.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [tokens, search])

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</label>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="font-mono w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-2xl font-bold text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:border-[#6366f1]/50 focus:bg-white transition-all"
            disabled={isOutput}
          />
          {isOutput && amount && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
              ~$0.00
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSelector(!showSelector)}
            disabled={isLoading || isOutput}
            className="flex h-[60px] min-w-[140px] items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 hover:border-[#6366f1]/50 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            ) : selectedToken ? (
              <>
                <CryptoLogo symbol={selectedToken.symbol} size={28} />
                <span className="font-bold text-zinc-900">{selectedToken.symbol}</span>
              </>
            ) : (
              <span className="text-zinc-400">Select</span>
            )}
            <ChevronDown className="h-4 w-4 text-zinc-400 ml-auto" />
          </button>

          {showSelector && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSelector(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
                <div className="p-3 border-b border-zinc-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search tokens..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#6366f1]/50"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {filteredTokens.map((token) => (
                    <button
                      key={token.id}
                      onClick={() => {
                        if (otherToken?.symbol !== token.symbol) {
                          onSelectToken(token)
                          setShowSelector(false)
                          setSearch('')
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors ${
                        otherToken?.symbol === token.symbol ? 'opacity-40' : ''
                      } ${selectedToken?.symbol === token.symbol ? 'bg-[#6366f1]/5' : ''}`}
                    >
                      <CryptoLogo symbol={token.symbol} size={32} />
                      <div className="flex-1 text-left">
                        <div className="font-bold text-zinc-900">{token.symbol}</div>
                        <div className="text-xs text-zinc-500">{token.name}</div>
                      </div>
                      {token.blockchain && (
                        <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-1 rounded">
                          {token.blockchain}
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredTokens.length === 0 && (
                    <div className="px-4 py-8 text-center text-zinc-400 text-sm">
                      No tokens found
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// QUOTE CARD
// ============================================================================

interface QuoteCardProps {
  swapState: SwapState
  slippage: number
  privacyMode: boolean
  onBack: () => void
  onConfirm: () => void
  isExecuting: boolean
}

function QuoteCard({ swapState, slippage, privacyMode, onBack, onConfirm, isExecuting }: QuoteCardProps) {
  const { quote, fromToken, toToken, fromAmount, toAmount } = swapState
  if (!quote) return null

  const exchangeRate = parseFloat(quote.rate) || 0
  const priceImpact = slippage

  return (
    <div className="space-y-4 rounded-xl border border-[#6366f1]/20 bg-gradient-to-br from-[#6366f1]/5 to-[#6366f1]/10 p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <span className="text-sm font-semibold text-emerald-600">Quote Ready</span>
      </div>

      {/* Exchange Rate Display */}
      <div className="flex items-center justify-between rounded-xl bg-white/60 p-4">
        <div className="flex items-center gap-2">
          {fromToken && <CryptoLogo symbol={fromToken.symbol} size={24} />}
          <div>
            <div className="text-xs text-zinc-500">You pay</div>
            <div className="font-mono font-bold">{fromAmount} {fromToken?.symbol}</div>
          </div>
        </div>
        <ArrowRightLeft className="h-5 w-5 text-zinc-300" />
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-zinc-500">You receive</div>
            <div className="font-mono font-bold text-[#6366f1]">{toAmount} {toToken?.symbol}</div>
          </div>
          {toToken && <CryptoLogo symbol={toToken.symbol} size={24} />}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 rounded-xl bg-white/40 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Rate</span>
          <span className="font-mono font-medium">1 {fromToken?.symbol} = {exchangeRate.toFixed(6)} {toToken?.symbol}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Price Impact</span>
          <span className={`font-mono font-medium ${priceImpact > 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {priceImpact.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Network Fee</span>
          <span className="font-mono font-medium">~{SWAP_FEE_PERCENT}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Estimated Time</span>
          <span className="font-mono font-medium">
            {quote.estimatedTime ? `${Math.round(quote.estimatedTime / 60)}-${Math.round(quote.estimatedTime / 60) + 5} min` : '5-15 min'}
          </span>
        </div>
        {privacyMode && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Privacy</span>
            <span className="font-medium text-[#f43f5e]">Enhanced</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-full border border-zinc-200 bg-white py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={isExecuting}
          className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#6366f1] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 transition-all hover:bg-[#4f46e5] disabled:opacity-50"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Confirm Swap
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// SWAPPING CARD
// ============================================================================

function SwappingCard() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#6366f1]/10 border border-[#6366f1]/20">
        <Loader2 className="h-10 w-10 text-[#6366f1] animate-spin" />
      </div>
      <h3 className="mb-2 text-xl font-bold text-zinc-900">Preparing Your Swap</h3>
      <p className="text-sm text-zinc-500">Setting up your exchange, please wait...</p>
    </div>
  )
}

// ============================================================================
// DEPOSIT ADDRESS CARD
// ============================================================================

interface DepositAddressCardProps {
  swapState: SwapState
  copied: boolean
  onCopy: (text: string) => void
  onDone: () => void
}

function DepositAddressCard({ swapState, copied, onCopy, onDone }: DepositAddressCardProps) {
  const { depositAddress, fromToken, fromAmount, toToken, toAmount } = swapState

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 border border-emerald-200">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h3 className="text-xl font-bold text-zinc-900 mb-1">Send {fromToken?.symbol}</h3>
        <p className="text-sm text-zinc-500">
          Send exactly <span className="font-mono font-bold text-zinc-700">{fromAmount} {fromToken?.symbol}</span> to begin your swap
        </p>
      </div>

      {/* Deposit Address */}
      <div className="rounded-xl border border-[#6366f1]/30 bg-[#6366f1]/5 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Deposit Address</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-sm break-all bg-white rounded-lg px-3 py-2.5 border border-zinc-200 text-zinc-700">
            {depositAddress}
          </div>
          <button
            onClick={() => onCopy(depositAddress)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-[#6366f1]/50 transition-all"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 text-zinc-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expected Output */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div>
          <div className="text-xs text-zinc-500">You will receive</div>
          <div className="flex items-center gap-2 mt-1">
            <CryptoLogo symbol={toToken?.symbol || ''} size={20} />
            <span className="font-mono font-bold text-lg text-[#6366f1]">{toAmount} {toToken?.symbol}</span>
          </div>
        </div>
        <Clock className="h-5 w-5 text-zinc-400" />
      </div>

      {/* Instructions */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6366f1]/10 text-[#6366f1] text-xs font-bold">1</div>
          <div>
            <div className="font-semibold text-sm text-zinc-900">Send {fromAmount} {fromToken?.symbol}</div>
            <div className="text-xs text-zinc-500 mt-0.5">to the deposit address above</div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6366f1]/10 text-[#6366f1] text-xs font-bold">2</div>
          <div>
            <div className="font-semibold text-sm text-zinc-900">Wait for confirmation</div>
            <div className="text-xs text-zinc-500 mt-0.5">Typically 5-15 minutes</div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">3</div>
          <div>
            <div className="font-semibold text-sm text-zinc-900">Receive {toAmount} {toToken?.symbol}</div>
            <div className="text-xs text-zinc-500 mt-0.5">directly to your connected wallet</div>
          </div>
        </div>
      </div>

      {/* Track Link */}
      <a
        href="https://app.houdiniswap.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-sm text-[#6366f1] hover:underline"
      >
        Track swap on HoudiniSwap
        <ExternalLink className="h-3 w-3" />
      </a>

      {/* Dashboard Link */}
      <Link
        href="/dashboard"
        className="flex items-center justify-center gap-2 w-full rounded-full bg-[#6366f1] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 transition-all hover:bg-[#4f46e5]"
      >
        Use Credits on Dashboard
        <ExternalLink className="h-4 w-4" />
      </Link>

      {/* Done Button */}
      <button
        onClick={onDone}
        className="w-full rounded-full border border-zinc-200 bg-white py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
      >
        Start New Swap
      </button>
    </div>
  )
}

// ============================================================================
// ERROR CARD
// ============================================================================

interface ErrorCardProps {
  error: string
  onRetry: () => void
}

function ErrorCard({ error, onRetry }: ErrorCardProps) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 border border-red-200">
        <AlertTriangle className="h-10 w-10 text-red-500" />
      </div>
      <h3 className="mb-2 text-xl font-bold text-red-600">Swap Failed</h3>
      <p className="mb-6 text-sm text-zinc-500 max-w-xs mx-auto">{error}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full bg-[#6366f1] px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#4f46e5]"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  )
}

// ============================================================================
// FOOTER
// ============================================================================

function SwapFooter() {
  return (
    <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-zinc-200/60 bg-white/50 px-4 py-3">
      <Shield className="h-4 w-4 text-[#6366f1]" />
      <span className="text-xs text-zinc-500">
        Powered by HoudiniSwap. Non-custodial exchange - your keys, your crypto.
      </span>
    </div>
  )
}