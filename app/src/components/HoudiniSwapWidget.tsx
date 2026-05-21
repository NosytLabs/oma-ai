'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ExternalLink, RefreshCw, AlertTriangle, Loader2, ArrowRightLeft, Shield } from 'lucide-react'

export interface HoudiniWidgetConfig {
  /** Your Houdini API key */
  apiKey?: string
  /** Target wallet address for received swaps */
  addressTo?: string
  /** Primary accent color (default: #00ffc8) */
  primaryColor?: string
  /** Custom container ID (default: houdini-swap-widget) */
  containerId?: string
  /** Default source token */
  defaultFromToken?: string
  /** Default destination token */
  defaultToToken?: string
  /** Callback when swap is completed */
  onSwapComplete?: (result: SwapResult) => void
  /** Callback when swap fails */
  onSwapError?: (error: string) => void
  /** Callback when widget is opened/closed */
  onOpen?: () => void
  onClose?: () => void
}

interface QuoteData {
  quoteId: string
  rate: string
  fee: string
  estimatedTime: string
}

export interface SwapResult {
  orderId: string
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  depositAddress: string
  status: string
  transactionHash?: string
}

/**
 * HoudiniSwapWidget - A customizable swap widget component
 * 
 * Features:
 * - Drop-in integration with HoudiniSwap API
 * - Customizable theming to match OMA branding
 * - Multiple swap type support (private, standard, DEX)
 * - Real-time order status tracking
 * - Modal overlay mode for embedding in deposit page
 * 
 * Usage:
 * ```tsx
 * <HoudiniSwapWidget
 *   apiKey="your_api_key"
 *   addressTo="0x..."
 *   primaryColor="#00ffc8"
 *   onSwapComplete={(result) => console.log(result)}
 * />
 * ```
 */
export function HoudiniSwapWidget({
  primaryColor = '#00ffc8',
  defaultFromToken = 'BTC',
  defaultToToken = 'USDC',
  addressTo,
  onSwapComplete,
  onSwapError,
  onOpen,
  onClose,
}: HoudiniWidgetConfig) {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<'select' | 'deposit' | 'monitor'>('select')
  const [selectedFromToken, setSelectedFromToken] = useState(defaultFromToken)
  const [selectedToToken, setSelectedToToken] = useState(defaultToToken)
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [depositAddress, setDepositAddress] = useState('')
  const [orderStatus, setOrderStatus] = useState<string>('pending')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [tokens, setTokens] = useState<{ id: string; symbol: string; name: string }[]>([])
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [selectorMode, setSelectorMode] = useState<'from' | 'to'>('from')
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [, setOrderId] = useState('')
  const widgetRef = useRef<HTMLDivElement>(null)

  // Fetch available tokens
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await fetch(`/api/v1/deposit/houdini/tokens?blockchain=BASE`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('oma_session') || ''}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setTokens(data.tokens || [])
        }
      } catch {
        // Use default tokens if API fails
        setTokens([
          { id: 'BTC', symbol: 'BTC', name: 'Bitcoin' },
          { id: 'ETH', symbol: 'ETH', name: 'Ethereum' },
          { id: 'USDC', symbol: 'USDC', name: 'USD Coin' },
          { id: 'XMR', symbol: 'XMR', name: 'Monero' },
          { id: 'SOL', symbol: 'SOL', name: 'Solana' },
          { id: 'DOGE', symbol: 'DOGE', name: 'Dogecoin' },
        ])
      }
    }
    fetchTokens()
  }, [])

  // Open widget handler
  const openWidget = useCallback(() => {
    setIsOpen(true)
    onOpen?.()
  }, [onOpen])

  // Close widget handler
  const closeWidget = useCallback(() => {
    setIsOpen(false)
    setStep('select')
    setError('')
    onClose?.()
  }, [onClose])

  // Get quote handler
  const handleGetQuote = async () => {
    if (!selectedFromToken || !fromAmount || parseFloat(fromAmount) <= 0) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/v1/deposit/houdini/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('oma_session') || ''}`,
        },
        body: JSON.stringify({
          fromToken: selectedFromToken,
          toToken: selectedToToken,
          amount: fromAmount,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to get quote')
      }
      
      const data = await response.json()
      const quoteData = Array.isArray(data) ? data[0] : data
      
      if (quoteData && quoteData.quoteId) {
        setQuote({
          quoteId: quoteData.quoteId,
          rate: quoteData.rate || '1',
          fee: quoteData.fee || '~1%',
          estimatedTime: quoteData.estimatedTime ? `${quoteData.estimatedTime / 60} min` : '5-15 min',
        })
        setToAmount(quoteData.toAmount || quoteData.estimatedAmount || '')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get quote'
      setError(message)
      onSwapError?.(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Start swap handler
  const handleStartSwap = async () => {
    if (!quote) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/v1/deposit/houdini/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('oma_session') || ''}`,
        },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          fromCoin: selectedFromToken,
          fromAmount: fromAmount,
          refundAddress: addressTo,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to start swap')
      }
      
      const data = await response.json()
      setOrderId(data.orderId || data.depositId)
      setDepositAddress(data.depositAddress)
      setStep('deposit')
      
      // Start monitoring
      monitorOrder(data.orderId || data.depositId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start swap'
      setError(message)
      onSwapError?.(message)
    } finally {
      setIsLoading(false)
    }
  }

  // Monitor order status
  const monitorOrder = async (id: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/deposit/status/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('oma_session') || ''}`,
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          setOrderStatus(data.status)
          
          if (data.status === 'completed') {
            onSwapComplete?.({
              orderId: id,
              fromToken: selectedFromToken,
              toToken: selectedToToken,
              fromAmount,
              toAmount: toAmount,
              depositAddress,
              status: data.status,
              transactionHash: data.txHash,
            })
          } else if (data.status === 'failed') {
            onSwapError?.('Swap failed. Please try again or contact support.')
          }
        }
      } catch {
        // Continue polling on error
      }
    }
    
    // Poll every 30 seconds
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }

  // Reset widget
  const handleReset = () => {
    setStep('select')
    setFromAmount('')
    setToAmount('')
    setQuote(null)
    setOrderId('')
    setDepositAddress('')
    setOrderStatus('pending')
    setError('')
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Open external link
  const openHoudini = () => {
    window.open('https://app.houdiniswap.com', '_blank')
  }

  // Render token selector
  const TokenSelector = ({ mode }: { mode: 'from' | 'to' }) => (
    <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-panel shadow-xl">
      <div className="max-h-48 overflow-y-auto">
        {tokens.map((token) => (
          <button
            key={token.id}
            onClick={() => {
              if (mode === 'from') {
                setSelectedFromToken(token.symbol)
              } else {
                setSelectedToToken(token.symbol)
              }
              setShowTokenSelector(false)
            }}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface transition-colors ${
              (mode === 'from' ? selectedFromToken : selectedToToken) === token.symbol
                ? 'text-cyan bg-cyan/10'
                : 'text-text'
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-bold">
              {token.symbol.slice(0, 2)}
            </div>
            <div className="text-left">
              <div className="font-mono font-bold">{token.symbol}</div>
              <div className="text-xs text-text-dim">{token.name}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* Widget Trigger Button */}
      <button
        onClick={openWidget}
        className="flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan transition-all hover:bg-cyan/20 hover:border-cyan/50"
        style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}10`, color: primaryColor }}
      >
        <ArrowRightLeft className="h-4 w-4" />
        HoudiniSwap
      </button>

      {/* Widget Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            ref={widgetRef}
            className="relative w-full max-w-md rounded-2xl border border-border bg-panel shadow-2xl overflow-hidden"
            style={{ borderColor: `${primaryColor}30` }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b border-border"
              style={{ borderColor: `${primaryColor}20` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <ArrowRightLeft className="h-5 w-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <h2 className="font-bold text-text">HoudiniSwap</h2>
                  <p className="text-xs text-text-dim">Swap 100+ cryptocurrencies</p>
                </div>
              </div>
              <button
                onClick={closeWidget}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface transition-colors"
              >
                <X className="h-5 w-5 text-text-dim" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {step === 'select' && (
                <div className="space-y-4">
                  {/* From Token */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-dim">
                      You Send
                    </label>
                    <div className="relative flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(e.target.value)}
                        className="font-mono w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-dim/50 focus:outline-none focus:border-cyan/50"
                        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                      />
                      <div className="relative">
                        <button
                          onClick={() => {
                            setSelectorMode('from')
                            setShowTokenSelector(!showTokenSelector)
                          }}
                          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-mono font-bold hover:border-cyan/50 transition-colors"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-[10px] font-bold">
                            {selectedFromToken.slice(0, 2)}
                          </div>
                          {selectedFromToken}
                        </button>
                        {showTokenSelector && selectorMode === 'from' && (
                          <TokenSelector mode="from" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Swap Icon */}
                  <div className="flex justify-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface">
                      <ArrowRightLeft className="h-4 w-4 text-text-dim" />
                    </div>
                  </div>

                  {/* To Token */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-dim">
                      You Receive
                    </label>
                    <div className="relative flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="0.00"
                        value={toAmount}
                        readOnly
                        className="font-mono w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text/70"
                      />
                      <div className="relative">
                        <button
                          onClick={() => {
                            setSelectorMode('to')
                            setShowTokenSelector(!showTokenSelector)
                          }}
                          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-mono font-bold hover:border-cyan/50 transition-colors"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface text-[10px] font-bold">
                            {selectedToToken.slice(0, 2)}
                          </div>
                          {selectedToToken}
                        </button>
                        {showTokenSelector && selectorMode === 'to' && (
                          <TokenSelector mode="to" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quote Details */}
                  {quote && (
                    <div
                      className="rounded-lg border p-4"
                      style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}10` }}
                    >
                      <div className="flex justify-between text-sm">
                        <span className="text-text-dim">Rate</span>
                        <span className="font-mono">1 {selectedFromToken} = {quote.rate} {selectedToToken}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-dim">Fee</span>
                        <span className="font-mono">{quote.fee}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-dim">Time</span>
                        <span className="font-mono">{quote.estimatedTime}</span>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-pink/30 bg-pink/10 px-3 py-2 text-sm text-pink">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    {!quote ? (
                      <button
                        onClick={handleGetQuote}
                        disabled={!fromAmount || parseFloat(fromAmount) <= 0 || isLoading}
                        className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: primaryColor, color: '#000' }}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Getting Quote...
                          </>
                        ) : (
                          'Get Quote'
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleStartSwap}
                        disabled={isLoading}
                        className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: primaryColor, color: '#000' }}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Starting Swap...
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Start Swap
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {quote && (
                    <button
                      onClick={handleReset}
                      className="btn-secondary w-full"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}

              {step === 'deposit' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="mb-2 text-sm font-semibold" style={{ color: primaryColor }}>
                      Send {selectedFromToken} to this address
                    </div>
                    <div className="font-mono text-xs text-text-dim break-all px-4 py-2 bg-surface rounded-lg border border-border">
                      {depositAddress}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => copyToClipboard(depositAddress)}
                      className="text-xs text-cyan hover:underline"
                    >
                      Copy Address
                    </button>
                  </div>

                  <div
                    className="flex items-center justify-center gap-2 rounded-lg border p-4"
                    style={{ borderColor: `${primaryColor}30` }}
                  >
                    <RefreshCw className="h-4 w-4 animate-spin" style={{ color: primaryColor }} />
                    <span className="text-sm text-text-dim">Monitoring swap status...</span>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full animate-pulse"
                      style={{ backgroundColor: orderStatus === 'pending' ? '#fbbf24' : orderStatus === 'completed' ? '#22c55e' : '#ef4444' }}
                    />
                    <span className="font-mono text-sm font-bold uppercase">{orderStatus}</span>
                  </div>

                  <button onClick={handleReset} className="btn-secondary w-full">
                    New Swap
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-surface/50">
              <div className="flex items-center gap-2 text-xs text-text-dim">
                <Shield className="h-4 w-4" />
                <span>Non-custodial</span>
              </div>
              <button
                onClick={openHoudini}
                className="flex items-center gap-1 text-xs text-cyan hover:underline"
              >
                Powered by HoudiniSwap
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Compact widget version for inline use
 */
export function HoudiniSwapWidgetInline({
  primaryColor = '#00ffc8',
}: HoudiniWidgetConfig) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleGetQuote = async () => {
    if (!fromAmount) return
    setIsLoading(true)
    try {
      const response = await fetch('/api/v1/deposit/houdini/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('oma_session') || ''}`,
        },
        body: JSON.stringify({
          fromToken: 'BTC',
          toToken: 'USDC',
          amount: fromAmount,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        const q = Array.isArray(data) ? data[0] : data
        setToAmount(q?.toAmount || '')
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false)
    }
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-dim hover:border-cyan/50 hover:text-cyan transition-all"
        style={{ borderColor: `${primaryColor}30` }}
      >
        <ArrowRightLeft className="h-4 w-4" style={{ color: primaryColor }} />
        Swap Crypto
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-text-dim">Swap</span>
        <div className="flex-1 relative">
          <input
            type="number"
            placeholder="Amount"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            className="font-mono w-full rounded border border-border bg-surface px-2 py-1.5 text-xs text-text placeholder:text-text-dim/50"
          />
        </div>
        <span className="text-xs text-text-dim">BTC</span>
        <ArrowRightLeft className="h-3 w-3 text-text-dim" />
        <div className="relative">
          <input
            type="text"
            placeholder="0.00"
            value={toAmount}
            readOnly
            className="font-mono w-16 rounded border border-border bg-surface px-2 py-1.5 text-xs text-text/70"
          />
        </div>
        <span className="text-xs text-text-dim">USDC</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleGetQuote}
          disabled={!fromAmount || isLoading}
          className="flex-1 rounded border border-border bg-surface py-1.5 text-xs font-semibold hover:border-cyan/50 transition-colors disabled:opacity-40"
          style={{ borderColor: `${primaryColor}40` }}
        >
          {isLoading ? '...' : 'Quote'}
        </button>
        <button
          onClick={() => setIsExpanded(false)}
          className="rounded border border-border bg-surface px-3 py-1.5 text-xs text-text-dim hover:bg-surface/80 transition-colors"
        >
          x
        </button>
      </div>
    </div>
  )
}

export default HoudiniSwapWidget