import { NextResponse } from 'next/server'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const JUPITER_API = 'https://api.jup.ag/swap/v2/quote'

// SOL and USDC mints
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

interface CoinPrice {
  symbol: string
  name: string
  price: number
  change24h: number
  lastUpdated: string
  source: 'jupiter' | 'coingecko'
}

const SUPPORTED_COINS: Record<string, { id: string; symbol: string; name: string }> = {
  btc: { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  eth: { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  sol: { id: 'solana', symbol: 'SOL', name: 'Solana' },
  usdc: { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  xmr: { id: 'monero', symbol: 'XMR', name: 'Monero' },
}

/**
 * Fetch SOL price from Jupiter (more real-time for Solana)
 */
async function fetchSolFromJupiter(): Promise<CoinPrice | null> {
  try {
    const queryParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: '1000000000', // 1 SOL in lamports
      slippageBps: '1',
      onlyDirectRoutes: 'false',
    })

    const response = await fetch(`${JUPITER_API}?${queryParams.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) return null

    const quote = await response.json()
    const price = parseFloat(quote.outAmount) / 1e6 // USDC has 6 decimals

    return {
      symbol: 'SOL',
      name: 'Solana',
      price,
      change24h: 0,
      lastUpdated: new Date().toISOString(),
      source: 'jupiter',
    }
  } catch (error) {
    console.error('Jupiter SOL price fetch failed:', error)
    return null
  }
}

/**
 * Fetch prices from CoinGecko for specified coin IDs
 */
async function fetchFromCoinGecko(coinIds: string[]): Promise<Record<string, { usd: number; usd_24h_change?: number; last_updated_at?: number }>> {
  const response = await fetch(
    `${COINGECKO_API}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
    { next: { revalidate: 30 } }
  )

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`)
  }

  return response.json()
}

export async function GET() {
  try {
    const coinIds = Object.values(SUPPORTED_COINS)
      .filter(c => c.id !== 'solana') // Exclude SOL from CoinGecko (will get from Jupiter)
      .map(c => c.id)
    
    // Fetch from both sources in parallel
    const [jupiterSolPrice, coingeckoData] = await Promise.all([
      fetchSolFromJupiter(),
      fetchFromCoinGecko(coinIds),
    ])

    // Build prices array
    const prices: CoinPrice[] = []

    // Add Jupiter SOL price (more real-time for Solana)
    if (jupiterSolPrice) {
      prices.push(jupiterSolPrice)
    }

    // Add CoinGecko prices
    for (const [key, coin] of Object.entries(SUPPORTED_COINS)) {
      // Skip SOL if we have Jupiter price
      if (key === 'sol' && jupiterSolPrice) continue

      const coinData = coingeckoData[coin.id]
      if (coinData) {
        prices.push({
          symbol: coin.symbol,
          name: coin.name,
          price: coinData.usd || 0,
          change24h: coinData.usd_24h_change || 0,
          lastUpdated: coinData.last_updated_at 
            ? new Date(coinData.last_updated_at * 1000).toISOString()
            : new Date().toISOString(),
          source: 'coingecko',
        })
      }
    }

    // Determine primary source for response
    const primarySource = jupiterSolPrice ? 'jupiter + coingecko' : 'coingecko'

    return NextResponse.json({
      success: true,
      data: prices,
      source: primarySource,
      cachedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Crypto price fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch crypto prices' },
      { status: 500 }
    )
  }
}