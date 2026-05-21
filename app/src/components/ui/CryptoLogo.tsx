'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useCallback, useEffect } from 'react'
import { getCryptoLogoUrl, hasCryptoLogo, CRYPTO_LOGOS } from '@/lib/cryptoLogos'

export interface CryptoLogoProps {
  /** Cryptocurrency symbol (e.g., 'BTC', 'ETH', 'USDC') */
  symbol: string
  /** Size in pixels (default: 32) */
  size?: number
  /** Additional CSS classes */
  className?: string
  /** Use SVG variant if available */
  useSvg?: boolean
  /** Fallback element to show on error */
  fallback?: React.ReactNode
  /** Show loading skeleton */
  loading?: boolean
  /** Custom border radius */
  rounded?: boolean
}

/**
 * CryptoLogo - Displays cryptocurrency logos with lazy loading and error handling
 * 
 * Features:
 * - Lazy loading of images
 * - Automatic fallback chain (primary -> fallback -> unknown)
 * - Customizable sizing
 * - Loading states
 * - Consistent visual styling
 */
export function CryptoLogo({
  symbol,
  size = 32,
  className = '',
  useSvg = false,
  fallback,
  loading = false,
  rounded = true,
}: CryptoLogoProps) {
  const [src, setSrc] = useState<string>('')
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const normalizedSymbol = symbol.toUpperCase()

  // Determine image source URL
  useEffect(() => {
    if (hasCryptoLogo(normalizedSymbol)) {
      const url = getCryptoLogoUrl(normalizedSymbol, { useSvg })
      setSrc(url)
      setError(false)
      setLoaded(false)
    } else {
      // Use unknown logo for unsupported symbols
      setSrc('/logos/unknown.svg')
      setError(false)
      setLoaded(false)
      setLoaded(false)
    }
  }, [normalizedSymbol, useSvg])

  // Preload image
  useEffect(() => {
    if (!src) return

    const img = new Image()
    img.src = src
    img.onload = () => setLoaded(true)
    img.onerror = () => {
      // Try fallback URL on error
      if (!src.includes('/logos/')) {
        const config = CRYPTO_LOGOS[normalizedSymbol]
        if (config?.fallbackUrl) {
          setSrc(config.fallbackUrl)
        }
      } else {
        setError(true)
      }
    }
  }, [src, normalizedSymbol])

  const handleError = useCallback(() => {
    setError(true)
  }, [])

  const handleLoad = useCallback(() => {
    setLoaded(true)
  }, [])

  // Loading skeleton
  if (loading || !loaded) {
    return (
      <div
        className={`flex-shrink-0 animate-pulse bg-surface ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: rounded ? '50%' : 4,
        }}
      />
    )
  }

  // Error state with custom or default fallback
  if (error || !src) {
    if (fallback) {
      return (
        <div
          className={className}
          style={{ width: size, height: size }}
        >
          {fallback}
        </div>
      )
    }

    // Default text fallback showing symbol initials
    return (
      <div
        className={`flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-cyan/20 to-blue-500/20 border border-cyan/30 font-bold text-cyan ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.35,
          borderRadius: rounded ? '50%' : 4,
        }}
      >
        {normalizedSymbol.slice(0, 2)}
      </div>
    )
  }

  // Local SVG logos
  if (src.startsWith('/')) {
    return (
      <div
        className={`flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: rounded ? '50%' : 4,
        }}
      >
        <img
          src={src}
          alt={`${normalizedSymbol} logo`}
          className={`w-full h-full ${rounded ? 'rounded-full' : 'rounded'}`}
          style={{
            borderRadius: rounded ? '50%' : 4,
          }}
          onError={handleError}
          onLoad={handleLoad}
        />
      </div>
    )
  }

  // External CDN logos
  return (
    <div
      className={`flex-shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? '50%' : 4,
      }}
    >
      <img
        src={src}
        alt={`${normalizedSymbol} logo`}
        className={`w-full h-full object-contain ${rounded ? 'rounded-full' : 'rounded'}`}
        style={{
          borderRadius: rounded ? '50%' : 4,
        }}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
      />
    </div>
  )
}

/**
 * CryptoLogoWithFallback - Wrapper with built-in fallback display
 */
export function CryptoLogoWithFallback(props: CryptoLogoProps) {
  return <CryptoLogo {...props} />
}

/**
 * CryptoLogoInline - Compact inline version for dropdowns and lists
 */
export function CryptoLogoInline({
  symbol,
  size = 20,
  className = '',
}: Omit<CryptoLogoProps, 'loading' | 'fallback' | 'useSvg'>) {
  return (
    <CryptoLogo
      symbol={symbol}
      size={size}
      className={className}
      loading={false}
    />
  )
}

export default CryptoLogo