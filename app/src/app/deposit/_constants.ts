export type DepositStep = 'select' | 'route' | 'processing' | 'complete' | 'error'
export type RouteType = 'direct-usdc' | 'houdini-swap' | 'onramp' | 'x402-pay'

export interface CoinOption {
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

export interface RouteInfo {
  type: RouteType
  label: string
  description: string
  estimatedTime: string
  feePercent: number
  creditMultiplier: number
  badge?: string
}

export const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const

export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const treasuryAddress = process.env.NEXT_PUBLIC_TREASURY_BASE_ADDRESS

// Only USDC coins are supported for direct deposit. Non-USDC coins require
// Houdini swap which is currently disabled. Filtered at the UI level in
// CoinSelector to avoid silent errors when users select unsupported coins.
export const POPULAR_COINS: CoinOption[] = [
  { id: 'usdc-base', symbol: 'USDC', name: 'USD Coin', network: 'Base', isNative: true, decimals: 6, isPopular: true, chain: 'base' },
  { id: 'usdc-sol', symbol: 'USDC', name: 'USD Coin', network: 'Solana', isNative: true, decimals: 6, isPopular: true, chain: 'solana' },
]

export const SWAP_COINS: CoinOption[] = [
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

export const ROUTES: Record<string, RouteInfo> = {
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

/**
 * Lightweight wrapper for the public payment-link info returned by
 * the Houdini / x402 facilitator endpoints. The dashboard's deposit
 * flow treats this as opaque metadata; the type only exists so
 * components can pass the value through without `any`.
 */
export interface PaymentLinkInfo {
  /** Stable ID for the payment intent. */
  id: string
  /** URL the user can open in a wallet to complete the payment. */
  url: string
  /** Optional human-readable label (route name, memo, etc.). */
  label?: string
  /** Optional expiry timestamp (ISO 8601). */
  expiresAt?: string
  /** Optional amount in minor units (cents/satoshi) tied to the link. */
  amount?: number
  /** Optional currency code (`USDC`, `ETH`, ...). */
  currency?: string
  /** Optional deposit id linking the link to backend credit batch. */
  depositId?: string
  /** Optional token symbol (USDC, ETH, etc.) for display. */
  token?: string
  /** Optional chain label for display (base, solana, etc). */
  chain?: string
}
