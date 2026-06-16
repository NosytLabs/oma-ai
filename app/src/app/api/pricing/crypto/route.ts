import { NextResponse } from 'next/server'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const JUPITER_API = 'https://api.jup.ag/swap/v2/quote'

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

interface PaymentLinkRequest {
  amount: number
  chain: 'base' | 'solana'
  token?: string
  expiry?: number
  metadata?: Record<string, string>
}

interface x402PaymentRequest {
  modelId: string
  chain: 'base' | 'solana'
  walletAddress: string
  maxAmount?: number
}

const SUPPORTED_COINS: Record<string, { id: string; symbol: string; name: string }> = {
  btc: { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  eth: { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  sol: { id: 'solana', symbol: 'SOL', name: 'Solana' },
  usdc: { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  xmr: { id: 'monero', symbol: 'XMR', name: 'Monero' },
}

const X402_CONFIGS = {
  base: {
    chainId: 8453,
    network: 'Base',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    facilitatorUrl: 'https://x402.facilitator.xyz/base',
  },
  solana: {
    chainId: 'mainnet-beta',
    network: 'Solana',
    usdcMint: USDC_MINT,
    facilitatorUrl: 'https://x402.facilitator.xyz/solana',
  },
}

async function fetchSolFromJupiter(): Promise<CoinPrice | null> {
  try {
    const queryParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: '1000000000',
      slippageBps: '1',
      onlyDirectRoutes: 'false',
    })

    const response = await fetch(`${JUPITER_API}?${queryParams.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) return null

    const quote = await response.json()
    const price = parseFloat(quote.outAmount) / 1e6

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
      .filter(c => c.id !== 'solana')
      .map(c => c.id)
    
    const [jupiterSolPrice, coingeckoData] = await Promise.all([
      fetchSolFromJupiter(),
      fetchFromCoinGecko(coinIds),
    ])

    const prices: CoinPrice[] = []

    if (jupiterSolPrice) {
      prices.push(jupiterSolPrice)
    }

    for (const [key, coin] of Object.entries(SUPPORTED_COINS)) {
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
      { error: { message: 'Failed to fetch crypto prices', type: 'upstream_error' } },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'create-payment-link': {
        const { amount, chain, token = 'USDC' } = body as PaymentLinkRequest & { action: string }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
        const sessionToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || ''
        const response = await fetch(`${apiUrl}/v1/deposit/houdini/payment-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify({ amount, chain, token }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          return NextResponse.json(
            { error: { message: error?.error?.message || 'Payment link creation failed', type: 'upstream_error' } },
            { status: response.status }
          )
        }

        const data = await response.json().catch(() => ({}))
        return NextResponse.json({
          success: true,
          paymentLink: {
            id: data.paymentLink?.id,
            url: data.paymentLink?.url,
            amount: data.paymentLink?.amount,
            chain: data.paymentLink?.chain,
            token: data.paymentLink?.token,
            expiresAt: data.paymentLink?.expiresAt,
            status: data.paymentLink?.status,
            depositId: data.depositId,
          },
        })
      }

      case 'create-x402-session': {
        const { modelId, chain, walletAddress, maxAmount } = body as x402PaymentRequest & { action: string }
        
        const sessionId = `x402_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
        const x402Config = X402_CONFIGS[chain as keyof typeof X402_CONFIGS]
        
        return NextResponse.json({
          success: true,
          session: {
            id: sessionId,
            modelId,
            chain,
            walletAddress,
            maxAmount: maxAmount || 10,
            status: 'active',
            facilitator: x402Config.facilitatorUrl,
            createdAt: new Date().toISOString(),
          },
        })
      }

      case 'get-x402-status': {
        const { sessionId } = body
        
        return NextResponse.json({
          success: true,
          status: {
            sessionId,
            balance: 0,
            spent: 0,
            requests: 0,
            lastActivity: new Date().toISOString(),
          },
        })
      }

      default:
        return NextResponse.json(
          { error: { message: 'Unknown action', type: 'validation_error' } },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('x402 API error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to process x402 request', type: 'internal_server_error' } },
      { status: 500 }
    )
  }
}