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
    <div className="min-h-[calc(100vh-4rem)] px-4 pt-20 pb-8 bg-[var(--color-void)]">
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
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 shadow-lg">
          <ArrowRightLeft className="h-7 w-7 text-[var(--color-accent)]" />
        </div>
      </div>
      <h1 className="text-3xl font-bold mb-2 font-syne" style={{ color: 'var(--color-text)' }}>
        Swap Crypto
      </h1>
      <p className="text-sm text-[var(--color-text-muted)]">
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
    <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_8px_32px_-8px_color-mix(in_srgb,var(--color-void)_8%,transparent)]">
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
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10">
        <Wallet className="h-10 w-10 text-[var(--color-accent)]" />
      </div>
      <h2 className="mb-3 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Connect Your Wallet</h2>
      <p className="mb-6 text-sm max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
        Connect your Base wallet to start swapping cryptocurrencies directly, no OMA credits required.
      </p>
      <button
        onClick={onConnect}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-8 py-4 text-sm font-semibold text-[var(--color-void)] shadow-lg shadow-[var(--color-accent)]/25 transition-all hover:bg-[var(--color-accent-hover)] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[var(--color-accent)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2"
        aria-label="Connect your Base wallet to start swapping"
      >
        <Hexagon className="h-4 w-4" aria-hidden="true" />
        Connect Base Wallet
      </button>
      <div className="mt-6 flex items-center justify-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
          MetaMask
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
          Coinbase
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
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
          { id: 'BNB', symbol: 'BNB', name: 'BNB', decimals: 18, address: '', blockchain: 'BNB' },
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
        privacyMode ? 'private' : undefined,
        slippage / 100
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
  }, [swapState.fromToken, swapState.toToken, swapState.fromAmount, privacyMode, slippage])

  const handleExecuteSwap = useCallback(async () => {
    if (!swapState.quote || !evmAddress || !swapState.fromToken) return

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
          aria-label={showSettings ? 'Close settings' : 'Open settings'}
          aria-expanded={showSettings}
          className="flex h-9 w-9 items-center justify-center rounded-full border bg-[var(--color-surface)] transition-all hover:border-[var(--color-accent)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              {[0.5, 1.0, 3.0].map(val => (
                <button
                  key={val}
                  onClick={() => setSlippage(val)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    slippage === val
                      ? 'text-[var(--color-void)]'
                      : 'border'
                  }`}
                  style={slippage === val ? { backgroundColor: 'var(--color-accent)' } : { backgroundColor: 'var(--color-void)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Privacy Mode</span>
            <button
              onClick={() => setPrivacyMode(!privacyMode)}
              className={`relative flex h-6 w-11 items-center rounded-full transition-colors ${
                privacyMode ? 'bg-[var(--color-pink)]' : 'bg-[var(--color-surface)]'
              }`}
            >
              <div className={`absolute h-4 w-4 rounded-full bg-[var(--color-text-inverse)] shadow transition-all ${
                privacyMode ? 'left-6' : 'left-1'
              }`} />
            </button>
          </div>
          {privacyMode && (
            <div className="flex items-start gap-2 rounded-lg p-3 bg-[var(--color-pink)]/10">
              <Shield className="h-4 w-4 mt-0.5" style={{ color: 'var(--color-pink)' }} />
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
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
          aria-label="Switch from and to tokens"
          className="flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-all hover:scale-110 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-void)' }}
        >
          <ArrowRightLeft className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
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
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ borderColor: 'var(--color-error)', backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)', color: 'var(--color-error)' }}>
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
          className="w-full flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] py-4 text-sm font-semibold text-[var(--color-void)] shadow-lg shadow-[var(--color-accent)]/25 transition-all hover:bg-[var(--color-accent-hover)] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[var(--color-accent)]/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:bg-[var(--color-text-muted)] disabled:shadow-none"
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
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="font-mono w-full rounded-xl px-4 py-4 text-2xl font-bold placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 transition-all"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
            disabled={isOutput}
            aria-label={`Enter ${label.toLowerCase()} amount`}
          />
          {isOutput && amount && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              ~$0.00
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSelector(!showSelector)}
            aria-label={`Select ${label.toLowerCase().replace('you ', '')} token`}
            aria-expanded={showSelector}
            disabled={isLoading || isOutput}
            className="flex h-[60px] min-w-[140px] items-center gap-2 rounded-xl px-4 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-void)' }}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
            ) : selectedToken ? (
              <>
                <CryptoLogo symbol={selectedToken.symbol} size={28} />
                <span className="font-bold" style={{ color: 'var(--color-text)' }}>{selectedToken.symbol}</span>
              </>
            ) : (
              <span style={{ color: 'var(--color-text-muted)' }}>Select</span>
            )}
            <ChevronDown className="h-4 w-4 ml-auto" style={{ color: 'var(--color-text-muted)' }} />
          </button>

          {showSelector && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSelector(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border shadow-xl overflow-hidden" style={{ width: 'min(288px, calc(100vw - 2rem))', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search tokens..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none"
                      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
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
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                        otherToken?.symbol === token.symbol ? 'opacity-40' : ''
                      } ${selectedToken?.symbol === token.symbol ? 'bg-[var(--color-accent)]/5' : ''}`}
                      style={{ color: 'var(--color-text)' }}
                    >
                      <CryptoLogo symbol={token.symbol} size={32} />
                      <div className="flex-1 text-left">
                        <div className="font-bold">{token.symbol}</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{token.name}</div>
                      </div>
                      {token.blockchain && (
                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                          {token.blockchain}
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredTokens.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
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
  // The Houdini quote API does not return a priceImpact field. Until it does,
  // surface the user's *slippage tolerance* as the closest meaningful number —
  // the trade will revert if real impact exceeds this threshold.
  const priceImpact = slippage

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-accent)]/20 bg-gradient-to-br from-[var(--color-accent)]/5 to-[var(--color-accent)]/10 p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>Quote Ready</span>
      </div>

      {/* Exchange Rate Display */}
      <div className="flex items-center justify-between rounded-xl p-4 bg-[var(--color-surface)]">
        <div className="flex items-center gap-2">
          {fromToken && <CryptoLogo symbol={fromToken.symbol} size={24} />}
          <div>
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>You pay</div>
            <div className="font-mono font-bold">{fromAmount} {fromToken?.symbol}</div>
          </div>
        </div>
        <ArrowRightLeft className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>You receive</div>
            <div className="font-mono font-bold" style={{ color: 'var(--color-accent)' }}>{toAmount} {toToken?.symbol}</div>
          </div>
          {toToken && <CryptoLogo symbol={toToken.symbol} size={24} />}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 rounded-xl p-4 text-sm bg-[var(--color-surface)]">
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-secondary)' }}>Rate</span>
          <span className="font-mono font-medium">1 {fromToken?.symbol} = {exchangeRate.toFixed(6)} {toToken?.symbol}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-secondary)' }}>Slippage tolerance</span>
          <span className={`font-mono font-medium ${priceImpact > 2 ? 'text-[var(--color-warning)]' : ''}`}
                style={{ color: priceImpact > 2 ? 'var(--color-warning)' : 'var(--color-success)' }}>
            {priceImpact.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-secondary)' }}>Network Fee</span>
          <span className="font-mono font-medium">~{SWAP_FEE_PERCENT}%</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--color-text-secondary)' }}>Estimated Time</span>
          <span className="font-mono font-medium">
            {quote.estimatedTime ? `${Math.round(quote.estimatedTime / 60)}-${Math.round(quote.estimatedTime / 60) + 5} min` : '5-15 min'}
          </span>
        </div>
        {privacyMode && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-secondary)' }}>Privacy</span>
            <span className="font-medium" style={{ color: 'var(--color-pink)' }}>Enhanced</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-full py-3.5 text-sm font-semibold transition-all"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-void)', color: 'var(--color-text)' }}
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={isExecuting}
          className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] py-3.5 text-sm font-semibold text-[var(--color-void)] shadow-lg shadow-[var(--color-accent)]/25 transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
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
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
        <Loader2 className="h-10 w-10 text-[var(--color-accent)] animate-spin" />
      </div>
      <h3 className="mb-2 text-xl font-bold" style={{ color: 'var(--color-text)' }}>Preparing Your Swap</h3>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Setting up your exchange, please wait...</p>
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
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border bg-[var(--color-success)]/10 border-[var(--color-success)]">
          <CheckCircle2 className="h-8 w-8" style={{ color: 'var(--color-success)' }} />
        </div>
        <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Send {fromToken?.symbol}</h3>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Send exactly <span className="font-mono font-bold" style={{ color: 'var(--color-text)' }}>{fromAmount} {fromToken?.symbol}</span> to begin your swap
        </p>
      </div>

      {/* Deposit Address */}
      <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Deposit Address</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-sm break-all rounded-lg px-3 py-2.5 border" style={{ backgroundColor: 'var(--color-void)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            {depositAddress}
          </div>
          <button
            onClick={() => onCopy(depositAddress)}
            aria-label="Copy deposit address"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--color-surface)] transition-all"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-void)' }}
          >
            {copied ? (
              <Check className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
            ) : (
              <Copy className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            )}
          </button>
        </div>
      </div>

      {/* Expected Output */}
      <div className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
        <div>
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>You will receive</div>
          <div className="flex items-center gap-2 mt-1">
            <CryptoLogo symbol={toToken?.symbol || ''} size={20} />
            <span className="font-mono font-bold text-lg" style={{ color: 'var(--color-accent)' }}>{toAmount} {toToken?.symbol}</span>
          </div>
        </div>
        <Clock className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
      </div>

      {/* Instructions */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-void)' }}>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-[var(--color-accent)]/10 text-[var(--color-accent)]">1</div>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Send {fromAmount} {fromToken?.symbol}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>to the deposit address above</div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-void)' }}>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-[var(--color-accent)]/10 text-[var(--color-accent)]">2</div>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Wait for confirmation</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Typically 5-15 minutes</div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border p-4 border-[var(--color-success)]/20 bg-[var(--color-success)]/5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--color-success)', color: 'var(--color-text-inverse)' }}>3</div>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Receive {toAmount} {toToken?.symbol}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>directly to your connected wallet</div>
          </div>
        </div>
      </div>

      {/* Track Link */}
      <a
        href="https://app.houdiniswap.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-sm text-[var(--color-accent)] hover:underline"
      >
        Track swap on HoudiniSwap
        <ExternalLink className="h-3 w-3" />
      </a>

      {/* Dashboard Link */}
      <Link
        href="/dashboard"
        className="flex items-center justify-center gap-2 w-full rounded-full bg-[var(--color-accent)] py-3.5 text-sm font-semibold text-[var(--color-void)] shadow-lg shadow-[var(--color-accent)]/25 transition-all hover:bg-[var(--color-accent-hover)]"
      >
        Use Credits on Dashboard
        <ExternalLink className="h-4 w-4" />
      </Link>

      {/* Done Button */}
      <button
        onClick={onDone}
        aria-label="Start new swap"
        className="w-full rounded-full border py-3.5 text-sm font-semibold transition-all"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-void)', color: 'var(--color-text)' }}
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
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border bg-[var(--color-error)]/10 border-[var(--color-red)]">
        <AlertTriangle className="h-10 w-10" style={{ color: 'var(--color-error)' }} />
      </div>
      <h3 className="mb-2 text-xl font-bold" style={{ color: 'var(--color-error)' }}>Swap Failed</h3>
      <p className="mb-6 text-sm max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-8 py-3.5 text-sm font-semibold text-[var(--color-void)] shadow-lg transition-all hover:bg-[var(--color-accent-hover)]"
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
    <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)]/60 px-4 py-3 bg-[var(--color-surface)]">
      <Shield className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Powered by HoudiniSwap. Non-custodial exchange - your keys, your crypto.
      </span>
    </div>
  )
}