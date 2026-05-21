'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Play, TrendingUp, Shield, Key, Coins } from 'lucide-react'
import { TerminalBlock } from './Terminal'
import { GetApiKey } from '@/components/GetApiKey'

const curlCommand = `curl https://oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o","messages":[{"role": "user","content":"Hello"}]}'`

export function Hero() {
  const [mounted, setMounted] = useState(false)
  const [, setLoading] = useState(true)
  const [omaPrice, setOmaPrice] = useState('$0.0842')
  const [priceChange, setPriceChange] = useState('+12.4%')

  useEffect(() => {
    setMounted(true)
    
    async function fetchPrices() {
      try {
        const response = await fetch('/api/pricing/crypto')
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            const btc = result.data.find((c: { symbol: string }) => c.symbol === 'BTC')
            if (btc) {
              setOmaPrice(`$${btc.price.toFixed(2)}`)
              setPriceChange(`${btc.change24h >= 0 ? '+' : ''}${btc.change24h.toFixed(2)}%`)
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch prices:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchPrices()
    const interval = setInterval(fetchPrices, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-[calc(100vh-4.5rem)] overflow-hidden py-20 hero-shimmer">
      {/* Enhanced animated gradient accents */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-cyan/8 blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-cyan/5 blur-[100px] animate-pulse-slow animation-delay-300" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan/6 blur-[80px] animate-pulse-slow animation-delay-600" />
        <div className="absolute -left-32 top-1/3 h-48 w-48 rounded-full bg-amber/4 blur-[100px] animate-pulse-slow animation-delay-900" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--color-cyan) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-20 lg:items-center">
          {/* Left side - Hero text */}
          <div className={`text-left transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Staking CTA Badge */}
            <Link
              href="/stake"
              className="mb-8 inline-flex items-center gap-3 rounded-full border border-cyan/30 bg-cyan/8 px-5 py-2.5 text-sm transition-all duration-200 hover:border-cyan/60 hover:bg-cyan/12 hover:shadow-[0_0_20px_rgba(0,255,200,0.15)] active:scale-[0.98]"
            >
              <Shield className="h-4 w-4 text-cyan" />
              <span className="font-semibold text-text">
                Stake OMA for <span className="text-cyan">15% discount</span>
              </span>
              <ChevronRight className="h-4 w-4 text-text-dim" />
            </Link>

            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Connect wallet.
              <br />
              <span className="glow-text-animated text-cyan">Get API key.</span>
              <br />
              Start building.
            </h1>

            <p className="mb-8 max-w-xl text-base text-text-dim sm:text-lg">
              OpenAI-compatible API. 50+ models. 100+ cryptocurrencies. 
              Sign with your wallet and get an API key instantly.
            </p>

            {/* Stats Row */}
            <div className="mb-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-semibold tracking-widest text-text-dim">
              <span className="text-cyan">50+ MODELS</span>
              <span className="text-border-bright">|</span>
              <span className="text-amber">100+ CRYPTOS</span>
              <span className="text-border-bright">|</span>
              <span className="text-green">0 KYC FIELDS</span>
            </div>

            {/* CTA Buttons - Prominent Action-Oriented with Hover Effects */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="group relative inline-flex items-center gap-2 rounded-xl border border-cyan/50 bg-cyan/10 px-7 py-4 text-sm font-bold text-cyan transition-all duration-300 hover:border-cyan hover:bg-cyan hover:text-void hover:shadow-[0_0_30px_rgba(0,255,200,0.25)] hover:scale-105 active:scale-100 min-h-[52px] overflow-hidden btn-tactile"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 group-hover:animate-pulse" />
                <Key className="h-5 w-5 group-hover:scale-110 transition-transform" />
                Start Building
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/deposit"
                className="group inline-flex items-center gap-2 rounded-xl border border-green/40 bg-green/8 px-6 py-4 text-sm font-semibold text-green transition-all duration-300 hover:border-green/60 hover:bg-green hover:text-void hover:shadow-[0_0_25px_rgba(0,255,140,0.2)] hover:scale-105 active:scale-100 min-h-[52px] btn-tactile"
              >
                <Coins className="h-5 w-5 group-hover:scale-110 transition-transform" />
                Deposit & Start
              </Link>
              <Link
                href="/playground"
                className="group inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-4 text-sm font-semibold text-text transition-all duration-300 hover:border-cyan/50 hover:bg-cyan/10 hover:text-cyan min-h-[52px] btn-tactile"
              >
                <Play className="h-4 w-4" />
                Try Playground
              </Link>
            </div>
          </div>

          {/* Right side - Get API Key component */}
          <div className={`lg:pl-8 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* OMA Token Price Display */}
            <div className="mb-6 rounded-xl border border-amber/30 bg-gradient-to-r from-amber/8 to-transparent p-4 token-price-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber/20">
                    <TrendingUp className="h-5 w-5 text-amber" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-dim uppercase tracking-wider">OMA Token</p>
                    <p className="text-xl font-bold text-text">{omaPrice}</p>
                  </div>
                </div>
                <div className="rounded-full bg-green/20 px-3 py-1">
                  <span className="text-xs font-bold text-green">{priceChange}</span>
                </div>
              </div>
              <Link
                href="/stake"
                className="mt-3 flex items-center justify-center gap-2 text-xs text-amber transition-colors hover:text-cyan"
              >
                <Shield className="h-3.5 w-3.5" />
                Stake OMA for 15% discount on API calls
              </Link>
            </div>

            <GetApiKey />
            
            <div className="mt-6 rounded-xl border border-border bg-panel p-4">
              <p className="mb-3 text-xs font-semibold text-text-dim uppercase tracking-wider">
                Quick Start
              </p>
              <TerminalBlock code={curlCommand} filename="terminal" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}