'use client'

/**
 * Crypto Price Fetching Module
 * Fetches real-time prices from Jupiter (SOL) and CoinGecko (BTC, ETH)
 * Implements 30-second client-side caching
 */

import { useEffect, useState, useCallback } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export interface CryptoPrice {
  symbol: string
  name: string
  price: number
  change24h: number
  lastUpdated: string
  source: 'jupiter' | 'coingecko'
}

export interface PriceData {
  sol: CryptoPrice | null
  btc: CryptoPrice | null
  eth: CryptoPrice | null
}

interface PriceCache {
  data: CryptoPrice[]
  timestamp: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_DURATION = 30 * 1000 // 30 seconds in milliseconds
const COINGECKO_API = '/api/pricing/crypto'
const JUPITER_PRICE_API = 'https://api.jup.ag/swap/v2/quote'

// SOL and USDC mints for Jupiter
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// =============================================================================
// JUPITER PRICE FETCHING
// =============================================================================

/**
 * Fetch SOL price from Jupiter Aggregator
 * Uses 1 SOL quote to determine current USD price
 */
export async function fetchSolPriceFromJupiter(): Promise<CryptoPrice | null> {
  try {
    const queryParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: '1000000000', // 1 SOL in lamports
      slippageBps: '1',
      onlyDirectRoutes: 'false',
    })

    const response = await fetch(`${JUPITER_PRICE_API}?${queryParams.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`)
    }

    const quote = await response.json()
    // USDC has 6 decimals, so divide by 1e6
    const price = parseFloat(quote.outAmount) / 1e6

    return {
      symbol: 'SOL',
      name: 'Solana',
      price,
      change24h: 0, // Jupiter doesn't provide 24h change
      lastUpdated: new Date().toISOString(),
      source: 'jupiter',
    }
  } catch (error) {
    console.error('Failed to fetch SOL price from Jupiter:', error)
    return null
  }
}

// =============================================================================
// COINGECKO PRICE FETCHING
// =============================================================================

interface CoinGeckoPriceResponse {
  success: boolean
  data: CryptoPrice[]
  source: string
  cachedAt: string
}

/**
 * Fetch prices from CoinGecko via the existing API route
 * Gets BTC, ETH prices (and optionally SOL)
 */
export async function fetchPricesFromCoinGecko(): Promise<CryptoPrice[]> {
  try {
    const response = await fetch(COINGECKO_API, {
      next: { revalidate: 30 }, // Match cache duration
    })

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    const data: CoinGeckoPriceResponse = await response.json()

    if (!data.success || !data.data) {
      throw new Error('Invalid response from pricing API')
    }

    // Add source marker to each price
    return data.data.map(price => ({
      ...price,
      source: 'coingecko' as const,
    }))
  } catch (error) {
    console.error('Failed to fetch prices from CoinGecko:', error)
    return []
  }
}

// =============================================================================
// PRICE CACHE & DEDUP
// =============================================================================

interface PriceCache {
  data: CryptoPrice[]
  timestamp: number
}

let priceCache: PriceCache | null = null
let ongoingFetch: Promise<PriceData> | null = null

/**
 * Get all crypto prices with caching and request deduplication
 * Returns cached data if fresh (< 30 seconds old), otherwise fetches new data
 */
export async function getCryptoPrices(forceRefresh = false): Promise<PriceData> {
  const now = Date.now()
  const isCacheValid = priceCache && (now - priceCache.timestamp) < CACHE_DURATION

  if (isCacheValid && !forceRefresh && priceCache) {
    return {
      sol: priceCache.data.find(p => p.symbol === 'SOL') || null,
      btc: priceCache.data.find(p => p.symbol === 'BTC') || null,
      eth: priceCache.data.find(p => p.symbol === 'ETH') || null,
    }
  }

  if (ongoingFetch && !forceRefresh) {
    return ongoingFetch
  }

  ongoingFetch = (async () => {
    const [jupiterPrice, coingeckoPrices] = await Promise.all([
      fetchSolPriceFromJupiter(),
      fetchPricesFromCoinGecko(),
    ])

    const mergedPrices: CryptoPrice[] = []

    if (jupiterPrice) {
      mergedPrices.push(jupiterPrice)
    }

    for (const price of coingeckoPrices) {
      if (price.symbol === 'SOL' && jupiterPrice) continue
      mergedPrices.push(price)
    }

    priceCache = { data: mergedPrices, timestamp: now }
    return {
      sol: mergedPrices.find(p => p.symbol === 'SOL') || null,
      btc: mergedPrices.find(p => p.symbol === 'BTC') || null,
      eth: mergedPrices.find(p => p.symbol === 'ETH') || null,
    }
  })()

  try {
    return await ongoingFetch
  } finally {
    ongoingFetch = null
  }
}

// =============================================================================
// REACT HOOKS
// =============================================================================

interface UseCryptoPricesOptions {
  /** Refresh interval in milliseconds (default: 30s = cache duration) */
  refreshInterval?: number
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean
}

interface UseCryptoPricesReturn {
  /** Current price data */
  prices: PriceData
  /** Whether prices are currently loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Force a fresh price fetch */
  refresh: () => Promise<void>
  /** Time until next auto-refresh */
  nextRefreshIn: number
}

/**
 * React hook for accessing crypto prices with auto-refresh
 * Caches prices for 30 seconds to avoid excessive API calls
 */
export function useCryptoPrices(options: UseCryptoPricesOptions = {}): UseCryptoPricesReturn {
  const { refreshInterval = CACHE_DURATION, autoRefresh = true } = options

  const [prices, setPrices] = useState<PriceData>({
    sol: null,
    btc: null,
    eth: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextRefreshIn, setNextRefreshIn] = useState(refreshInterval)
  const [lastFetchTime, setLastFetchTime] = useState(0)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const freshPrices = await getCryptoPrices(true)
      setPrices(freshPrices)
      setLastFetchTime(Date.now())
      setNextRefreshIn(refreshInterval)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prices')
    } finally {
      setIsLoading(false)
    }
  }, [refreshInterval])

  // Initial fetch and auto-refresh
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    const fetchPrices = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const freshPrices = await getCryptoPrices()
        setPrices(freshPrices)
        setLastFetchTime(Date.now())
        setNextRefreshIn(refreshInterval)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch prices')
      } finally {
        setIsLoading(false)
      }
    }

    // Initial fetch
    fetchPrices()

    // Set up auto-refresh if enabled
    if (autoRefresh) {
      intervalId = setInterval(fetchPrices, refreshInterval)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [autoRefresh, refreshInterval])

  // Update countdown to next refresh
  useEffect(() => {
    if (!autoRefresh || !lastFetchTime) return

    const updateCountdown = () => {
      const elapsed = Date.now() - lastFetchTime
      const remaining = Math.max(0, refreshInterval - elapsed)
      setNextRefreshIn(remaining)
    }

    updateCountdown()
    const intervalId = setInterval(updateCountdown, 1000)

    return () => clearInterval(intervalId)
  }, [autoRefresh, lastFetchTime, refreshInterval])

  return {
    prices,
    isLoading,
    error,
    refresh,
    nextRefreshIn,
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get price for a specific symbol
 */
export function getPriceBySymbol(prices: PriceData, symbol: string): number | null {
  const upperSymbol = symbol.toUpperCase()
  
  switch (upperSymbol) {
    case 'SOL':
      return prices.sol?.price ?? null
    case 'BTC':
      return prices.btc?.price ?? null
    case 'ETH':
      return prices.eth?.price ?? null
    default:
      return null
  }
}

/**
 * Calculate USD value of a crypto amount
 */
export function calculateUsdValue(symbol: string, amount: number, prices: PriceData): number | null {
  const price = getPriceBySymbol(prices, symbol)
  if (price === null) return null
  return amount * price
}

/**
 * Format price for display
 */
export function formatPrice(price: number | null): string {
  if (price === null) return '--'
  if (price < 0.01) return price.toFixed(6)
  if (price < 1) return price.toFixed(4)
  if (price < 1000) return price.toFixed(2)
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format price change for display
 */
export function formatPriceChange(change: number): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

/**
 * Get price badge color based on change
 */
export function getPriceChangeColor(change: number): string {
  if (change > 0) return 'text-green'
  if (change < 0) return 'text-red'
  return 'text-text-dim'
}