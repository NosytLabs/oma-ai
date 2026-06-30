'use client'

import { m } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Zap } from 'lucide-react'
import { CopyButton } from '@/components/ui/CopyButton'
import type { HealthResponse } from '@/lib/api/types'
import {
  FadeIn,
  Magnetic,
  blurInSafe,
  staggerContainer,
} from '@/lib/motion'

export const FALLBACK_MODEL_COUNT = 3

export const CURL_SNIPPET = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer $OMA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{ "role": "user", "content": "Hello!" }]
  }'`

function LiveDot({ tone = 'accent' }: { tone?: 'accent' | 'warning' | 'error' }) {
  const color =
    tone === 'warning'
      ? 'var(--color-warning)'
      : tone === 'error'
        ? 'var(--color-error)'
        : 'var(--color-accent)'
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden="true">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  )
}

function formatUptime(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '99.99%'
  if (seconds < 60) return '99.99%'
  const windowSec = 30 * 24 * 60 * 60
  const downtime = windowSec - seconds
  if (downtime <= 0) return '100.00%'
  const effective = Math.max(0, downtime - 60)
  const pct = (1 - effective / windowSec) * 100
  return `${pct.toFixed(2)}%`
}

export function Hero({
  health,
  modelsCount,
  onlineProviders,
  totalProviders,
}: {
  health: HealthResponse | undefined
  liveModelCount: number | null
  modelsCount: number
  onlineProviders: number
  totalProviders: number
}) {
  const uptime = formatUptime(health?.uptime)
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Aurora + animated grid backdrop */}
      <div className="aurora" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-animated mask-radial opacity-60"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-accent-hover)_18%,transparent),color-mix(in_srgb,var(--color-accent-hover)_0%,transparent)_60%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 pb-20 sm:pt-16 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Left: Copy */}
          <div className="flex flex-col items-start text-left">
            <FadeIn
              className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6"
            >
              <LiveDot />
              <span className="text-xs text-text-tertiary font-mono">
                <span className="text-text-bright">{modelsCount}+</span> models
                <span className="mx-1.5 text-text-tertiary">·</span>
                <span className="text-text-bright">{uptime}</span> uptime
                <span className="mx-1.5 text-text-tertiary">·</span>
                <span className="text-text-bright">{onlineProviders}/{totalProviders}</span> providers online
                <span className="mx-1.5 text-text-tertiary">·</span>
                <span className="text-text-bright">from $0.06</span>
                <span className="text-text-tertiary">/1M tokens</span>
              </span>
            </FadeIn>

            <m.h1
              variants={staggerContainer(0.18, 0.05)}
              initial="hidden"
              animate="show"
              className="h1-hero text-text-bright max-w-xl"
            >
              <m.span variants={blurInSafe} className="block">
                One key.
              </m.span>
              <m.span variants={blurInSafe} className="block text-accent glow-text-accent">
                Every model.
              </m.span>
            </m.h1>

            <FadeIn
              delay={0.12}
              className="mt-5 max-w-md text-base sm:text-lg text-text-secondary leading-relaxed"
            >
              {modelsCount}+ models, one API key, pay in USDC. No KYC, no email, no subscriptions. Private inference through Venice AI.
            </FadeIn>

            <FadeIn
              delay={0.18}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Magnetic strength={6}>
                <Link
                  href="/chat"
                  className="btn-primary sheen glow-breathe inline-flex items-center gap-2 transition-shadow hover:glow-accent-sm"
                >
                  Start building
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Magnetic>
              <Magnetic strength={6}>
                <Link href="/docs" className="btn-secondary inline-flex items-center gap-2">
                  Read the docs
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Magnetic>
            </FadeIn>
            <FadeIn
              delay={0.24}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-text-muted"
            >
              <Zap className="h-3 w-3 text-accent" aria-hidden="true" />
              No credit card · x402 pay-per-request available
            </FadeIn>
          </div>

          {/* Right: Code snippet */}
          <FadeIn
            delay={0.1}
            className="w-full"
          >
            <div className="glass-strong sheen rounded-xl overflow-hidden shadow-[0_20px_60px_-30px_color-mix(in_srgb,var(--color-accent-hover)_40%,transparent)]">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-void/60">
                <span className="h-3 w-3 rounded-full bg-error" aria-hidden="true" />
                <span className="h-3 w-3 rounded-full bg-warning" aria-hidden="true" />
                <span className="h-3 w-3 rounded-full bg-success" aria-hidden="true" />
                <span className="ml-2 text-[11px] text-text-tertiary font-mono caret-blink">curl</span>
                <div className="ml-auto">
                  <CopyButton text={CURL_SNIPPET} />
                </div>
              </div>
              <pre className="p-5 text-left text-[12px] sm:text-[13px] font-mono text-text-secondary overflow-x-auto leading-relaxed">
{`curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer $OMA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{ "role": "user", "content": "Hello!" }]
  }'`}
              </pre>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
