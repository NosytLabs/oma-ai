'use client'

import { useEffect, useMemo, useState } from 'react'
import { m } from 'framer-motion'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Check,
  Coins,
  Copy,
  Globe,
  Key,
  Loader2,
  Plug,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wallet,
  Zap,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { CopyButton } from '@/components/ui/CopyButton'
import { formatPrice } from '@/lib/prices'
import { api } from '@/lib/api'
import type { HealthResponse, Model as ApiModel } from '@/lib/api/types'
import { estimateTokens } from '@/lib/text'
import {
  EASE_SPRING,
  StaggerReveal,
  Magnetic,
  blurIn,
  fadeUp as fadeUpVariant,
  fadeRight,
  scaleIn,
  scaleInSpring,
  staggerContainer,
} from '@/lib/motion'

type ModelLogo = 'llama' | 'claude' | 'gemini' | 'deepseek' | 'gpt' | 'venice' | 'together' | 'antseed'

export interface HomeClientProps {
  liveModelCount: number | null
  featuredModels: {
    id: string
    provider: string
    ctx: string
    logo: ModelLogo
    inputPricePer1M: number
    outputPricePer1M: number
  }[]
  version?: string
}

const MONOGRAM: Record<ModelLogo, string> = {
  llama: 'L',
  claude: 'C',
  gpt: 'G',
  deepseek: 'DS',
  gemini: 'GE',
  venice: 'V',
  together: 'T',
  antseed: 'AS',
}

const STEPS = [
  { n: '1', t: 'Connect wallet', d: 'MetaMask, Coinbase, or WalletConnect. No email, no signup.' },
  { n: '2', t: 'Add credits', d: 'Send USDC, swap from any token, or use x402 gasless payments.' },
  { n: '3', t: 'Start building', d: 'Call any model with one OpenAI-compatible request.' },
] as const

const TRUST = [
  { label: 'Base', hint: 'Settlement' },
  { label: 'USDC', hint: 'Stable pricing' },
  { label: 'x402', hint: 'Pay-per-request' },
  { label: 'A2A', hint: 'Agent-native' },
  { label: 'MCP', hint: 'Tooling' },
  { label: 'OpenAI-compatible', hint: 'Drop-in' },
] as const

const X402_STEPS = [
  { n: '01', t: 'POST without payment', d: 'No account, no API key, no auth header. Just an HTTP request to /v1/chat/completions.' },
  { n: '02', t: 'Server returns 402', d: 'OMA replies with HTTP 402 Payment Required and a Pay-Req header describing the price on Base.' },
  { n: '03', t: 'Wallet signs USDC', d: 'Your wallet signs an EIP-3009 transferWithAuthorization. No gas, no approval pop-up.' },
  { n: '04', t: 'Retry with signature', d: 'The retry includes PAYMENT-SIGNATURE. OMA verifies, settles on Base, and forwards the call.' },
  { n: '05', t: 'Stream the answer', d: 'The model response streams back. One round trip, one signature, one receipt.' },
] as const

const CURL_SNIPPET = `curl https://api.oma-ai.com/v1/chat/completions \\
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

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-50px' },
    transition: { duration: 0.5, delay, ease: 'easeOut' as const },
  }
}

function Hero({
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
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const uptime = formatUptime(health?.uptime)

  // C-C1 / C-4: "Try without signing up" — navigates to /dashboard?demo=1.
  // The middleware (src/middleware.ts) detects the `?demo=1` query param,
  // sets the `oma-demo=1` cookie on the response, and lets the user through
  // the protected-route gate. The dashboard then renders mock data because
  // wallet-provider's `isDemo` flag is true. No backend call required.
  //
  // We use a hard browser navigation (window.location.assign) instead of
  // router.push because the App Router caches the RSC prefetch for /dashboard
  // on the landing page; that prefetch runs through the middleware WITHOUT
  // the `?demo=1` query string and gets redirected to /login. A hard nav
  // forces the browser to send a fresh request that includes `?demo=1`, so
  // the middleware sees it and sets the cookie.
  const startDemo = () => {
    setDemoLoading(true)
    setDemoError(null)
    try {
      window.location.assign('/dashboard?demo=1')
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : 'Could not start demo mode')
      setDemoLoading(false)
    }
  }
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
        <div className="flex flex-col items-center text-center">
          <m.div
            {...fadeUp(0)}
            className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-8"
          >
            <LiveDot />
            <span className="text-xs text-text-tertiary font-mono">
              <span className="text-text-bright">{modelsCount}+</span> models
              <span className="mx-1.5 text-text-tertiary">·</span>
              <span className="text-text-bright">{uptime}</span> uptime
              <span className="mx-1.5 text-text-tertiary">·</span>
              <span className="text-text-bright">{onlineProviders}/{totalProviders}</span> providers online
            </span>
          </m.div>

          <m.h1
            variants={staggerContainer(0.18, 0.05)}
            initial="hidden"
            animate="show"
            className="font-display font-bold text-text-bright tracking-[-0.04em] leading-[0.95] text-[clamp(2.75rem,9vw,5.5rem)] max-w-4xl"
          >
            <m.span variants={blurIn} className="block">
              One key.
            </m.span>
            <m.span variants={blurIn} className="block text-accent glow-text-accent">
              Every model.
            </m.span>
          </m.h1>

          <m.p
            {...fadeUp(0.12)}
            className="mt-6 max-w-2xl text-base sm:text-lg text-text-secondary leading-relaxed"
          >
            Pay per request in USDC. No subscriptions. No rate limits.
            {' '}{modelsCount}+ AI models behind one OpenAI-compatible API.
          </m.p>

          <m.div
            {...fadeUp(0.18)}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Magnetic strength={6}>
              <Link
                href="/playground"
                className="btn-primary sheen inline-flex items-center gap-2 transition-shadow hover:glow-accent-sm"
              >
                Try the playground
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Magnetic>
            <Magnetic strength={6}>
              <Link href="/pricing" className="btn-secondary inline-flex items-center gap-2">
                See pricing
              </Link>
            </Magnetic>
            <Magnetic strength={6}>
              <button
                type="button"
                onClick={startDemo}
                disabled={demoLoading}
                aria-label="Try the dashboard without signing up"
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {demoLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Starting demo…
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" aria-hidden="true" />
                    Try without signing up
                  </>
                )}
              </button>
            </Magnetic>
          </m.div>
          {demoError && (
            <m.p
              {...fadeUp(0.22)}
              role="alert"
              className="mt-3 text-xs text-error"
            >
              {demoError}
            </m.p>
          )}

          <m.div
            {...fadeUp(0.24)}
            className="mt-12 w-full max-w-3xl"
          >
            <div className="glass-strong sheen rounded-xl overflow-hidden shadow-[0_20px_60px_-30px_color-mix(in_srgb,var(--color-accent-hover)_40%,transparent)]">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-void/60">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden="true" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden="true" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden="true" />
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
          </m.div>

          <m.div
            {...fadeUp(0.32)}
            className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-xs text-text-tertiary font-mono"
          >
            {TRUST.map((t, i) => (
              <span key={t.label} className="inline-flex items-center gap-2">
                <span className="text-accent" aria-hidden="true">·</span>
                <span className="text-text-bright">{t.label}</span>
                <span className="hidden sm:inline">— {t.hint}</span>
                {i < TRUST.length - 1 && (
                  <span className="text-text-tertiary/50" aria-hidden="true">|</span>
                )}
              </span>
            ))}
          </m.div>
        </div>
      </div>
    </section>
  )
}

function ValueProps() {
  const cards = [
    {
      icon: Key,
      title: 'One key, every model',
      body: `${FEATURED_HINT_COUNT}+ models, 7+ providers. Switch with one parameter. No vendor lock-in.`,
      href: '/models',
      cta: 'See all models',
    },
    {
      icon: Coins,
      title: 'Pay per request',
      body: 'From $0.0001/token. Top up with USDC, credit card, or x402 gasless payments. No subscriptions.',
      href: '/pricing',
      cta: 'See pricing',
    },
    {
      icon: ShieldCheck,
      title: 'No account needed',
      body: 'Just connect a wallet. No email, no password, no KYC. Your keys, your models, your data.',
      href: '/login',
      cta: 'Get started',
    },
  ] as const
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <StaggerReveal
          stagger={0.1}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6"
        >
          {cards.map((c) => (
            <m.div
              key={c.title}
              variants={fadeUpVariant}
              className="tilt-card sheen group relative rounded-2xl border border-border bg-panel/60 p-6 hover:border-accent/50 transition-colors"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent mb-4 transition-shadow group-hover:glow-accent-sm">
                <c.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-text-bright mb-2 tracking-tight">
                {c.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {c.body}
              </p>
              <Link
                href={c.href}
                className="mt-4 inline-flex items-center gap-1 text-xs text-accent group-hover:gap-2 transition-all"
              >
                {c.cta}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </m.div>
          ))}
        </StaggerReveal>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="border-b border-border bg-surface/30">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <m.div {...fadeUp(0)} className="text-center mb-12">
          <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-3">
            <Zap className="h-3 w-3" aria-hidden="true" />
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text-bright tracking-tight leading-tight">
            Three steps. <span className="text-accent">Thirty seconds.</span>
          </h2>
          <p className="mt-4 text-text-secondary max-w-xl mx-auto text-sm sm:text-base">
            Connect your wallet, top up with USDC, and start calling AI models
            in under a minute.
          </p>
        </m.div>

        <StaggerReveal
          stagger={0.14}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative"
        >
          {/* Connecting line + moving dot */}
          <div
            className="hidden md:block absolute top-6 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-border to-transparent overflow-visible"
            aria-hidden="true"
          >
            <m.span
              className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent glow-accent-sm"
              initial={{ left: '0%', opacity: 0 }}
              whileInView={{ left: '100%', opacity: [0, 1, 1, 0] }}
              viewport={{ once: true }}
              transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.3 }}
            />
          </div>
          {STEPS.map((s) => (
            <m.div
              key={s.n}
              variants={scaleInSpring}
              className="relative text-center"
            >
              <div className="relative inline-flex items-center justify-center mb-4">
                <m.div
                  className="h-12 w-12 rounded-full bg-accent text-void text-lg font-bold flex items-center justify-center font-mono"
                  whileHover={{ scale: 1.08 }}
                  transition={EASE_SPRING}
                >
                  {s.n}
                </m.div>
              </div>
              <h3 className="text-lg font-semibold text-text-bright mb-2 tracking-tight">
                {s.t}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed max-w-[26ch] mx-auto">
                {s.d}
              </p>
            </m.div>
          ))}
        </StaggerReveal>

        <m.div {...fadeUp(0.2)} className="mt-12 text-center">
          <Link
            href="/deposit"
            className="inline-flex items-center gap-2 text-sm text-text-bright hover:text-accent transition-colors"
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            Add credits to your account
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </m.div>
      </div>
    </section>
  )
}

function ModelCard({
  model,
  rank,
}: {
  model: {
    id: string
    provider: string
    ctx: string
    logo: ModelLogo
    inputPricePer1M: number
    outputPricePer1M: number
  }
  rank: number
}) {
  return (
    <m.div
      variants={scaleIn}
      className="tilt-card group relative rounded-xl border border-border bg-panel/40 p-4 hover:border-accent/40 hover:bg-panel/80 hover:glow-accent-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-void text-[10px] font-mono text-accent">
            {MONOGRAM[model.logo]}
          </span>
          <m.span
            className="text-[10px] text-text-tertiary font-mono tabular-nums"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: rank * 0.2 }}
          >
            #{String(rank + 1).padStart(2, '0')}
          </m.span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          {model.ctx}
        </span>
      </div>
      <p className="text-sm font-mono text-text-bright truncate mb-1" title={model.id}>
        {model.id}
      </p>
      <p className="text-[11px] text-text-tertiary mb-3 truncate">
        {model.provider}
      </p>
      <div className="flex items-baseline gap-1.5 text-[11px] font-mono">
        <span className="text-accent tabular-nums">
          {formatPrice(model.inputPricePer1M)}
        </span>
        <span className="text-text-tertiary">/</span>
        <span className="text-accent tabular-nums">
          {formatPrice(model.outputPricePer1M)}
        </span>
        <span className="text-text-tertiary ml-auto">per 1M</span>
      </div>
    </m.div>
  )
}

function ModelsShowcase({ featuredModels }: { featuredModels: HomeClientProps['featuredModels'] }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <m.div {...fadeUp(0)} className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-3">
              <Box className="h-3 w-3" aria-hidden="true" />
              The catalog
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight">
              Frontier models. <span className="text-accent">One endpoint.</span>
            </h2>
            <p className="mt-3 text-text-secondary text-sm sm:text-base">
              Switch providers by changing the model name. Same auth, same response format, same bill.
            </p>
          </div>
          <Link
            href="/models"
            className="inline-flex items-center gap-1.5 text-sm text-text-bright hover:text-accent transition-colors"
          >
            Browse all models
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </m.div>

        <StaggerReveal
          stagger={0.06}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
          {featuredModels.map((m, i) => (
            <ModelCard key={m.id} model={m} rank={i} />
          ))}
        </StaggerReveal>
      </div>
    </section>
  )
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  return (
    <div className="glass sheen rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-void/60">
        <span className="flex items-center gap-2 text-[11px] text-text-tertiary font-mono uppercase tracking-wider">
          <TerminalSquare className="h-3 w-3" aria-hidden="true" />
          {language}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 sm:p-5 text-[12px] sm:text-[13px] font-mono text-text-secondary overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function X402Section() {
  return (
    <section className="border-b border-border bg-surface/30">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12 items-start">
          <m.div {...fadeUp(0)}>
            <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-3">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              x402 protocol
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight leading-tight">
              Pay per request.
              <br />
              <span className="text-accent">No balance, no signup.</span>
            </h2>
            <p className="mt-4 text-text-secondary text-sm sm:text-base max-w-md">
              x402 is an open standard for HTTP-native payments. The wallet signs
              a USDC transfer on Base, the receipt is verified, the upstream
              model is called. One round trip, one signature.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs" className="btn-secondary inline-flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                Read the protocol
              </Link>
              <Link href="/playground" className="btn-primary inline-flex items-center gap-2">
                Try it live
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </m.div>

          <StaggerReveal stagger={0.08}>
            <ol className="border-gradient rounded-2xl divide-y divide-border overflow-hidden">
              {X402_STEPS.map((s) => (
                <m.li
                  key={s.n}
                  variants={fadeRight}
                  className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 px-5 py-4"
                >
                  <span className="font-mono text-[11px] text-accent tabular-nums pt-0.5">
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-bright mb-1">
                      {s.t}
                    </p>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {s.d}
                    </p>
                  </div>
                </m.li>
              ))}
            </ol>
          </StaggerReveal>
        </div>
      </div>
    </section>
  )
}

function FeatureGrid() {
  const features = [
    {
      icon: Plug,
      title: 'OpenAI-compatible',
      body: 'Swap the base URL. Keep your existing code. The OpenAI SDK works out of the box.',
    },
    {
      icon: Globe,
      title: 'Multi-provider routing',
      body: 'Automatic failover across Venice, AntSeed, OpenRouter, Together, and more.',
    },
    {
      icon: Zap,
      title: 'Streaming & tools',
      body: 'Server-sent events, function calling, vision inputs, and JSON mode on every model.',
    },
    {
      icon: Box,
      title: 'Image, video, search',
      body: 'Generate images, render video, and query the web through the same key.',
    },
  ] as const
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <m.div {...fadeUp(0)} className="text-center mb-10 max-w-2xl mx-auto">
          <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-3">
            <Check className="h-3 w-3" aria-hidden="true" />
            Everything you need
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight">
            One API. <span className="text-accent">Every capability.</span>
          </h2>
        </m.div>

        <StaggerReveal
          stagger={0.08}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {features.map((f) => (
            <m.div
              key={f.title}
              variants={scaleIn}
              className="rounded-xl border border-border bg-panel/40 p-5 hover:border-accent/40 transition-colors"
            >
              <f.icon className="h-5 w-5 text-accent mb-3" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text-bright mb-1.5">
                {f.title}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {f.body}
              </p>
            </m.div>
          ))}
        </StaggerReveal>
      </div>
    </section>
  )
}

function MiniPlayground({ models }: { models: { id: string; provider: string }[] }) {
  const [model, setModel] = useState<string>(models[0]?.id ?? 'llama-3.3-70b')
  const [prompt, setPrompt] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{
    text: string
    tokens: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const estimatedTokens = useMemo(() => estimateTokens(prompt), [prompt])

  const run = async () => {
    if (!prompt.trim() || running) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt.trim() }],
          stream: false,
          max_tokens: 256,
        }),
      })
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(errBody?.error?.message ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { total_tokens?: number }
      }
      const text = data.choices?.[0]?.message?.content ?? ''
      const tokens = data.usage?.total_tokens ?? estimateTokens(text)
      setResult({ text, tokens })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-void/40">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-text-tertiary font-mono">
          <Sparkles className="h-3 w-3 text-accent" aria-hidden="true" />
          Try it · live API
        </span>
        <span className="text-[11px] text-text-tertiary font-mono tabular-nums">
          ~{estimatedTokens} tok
        </span>
      </div>
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-void border border-border text-text-secondary text-xs font-mono px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel sm:w-56"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void run()
              }
            }}
            placeholder="Ask anything · press enter to run"
            className="flex-1 bg-void border border-border text-text-bright text-sm font-mono px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel placeholder:text-text-tertiary min-w-0"
          />
          <button
            type="button"
            onClick={run}
            disabled={!prompt.trim() || running}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2 shrink-0"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                running
              </>
            ) : (
              <>Run →</>
            )}
          </button>
        </div>
          {error && (
            <div className="text-xs text-error font-mono border border-error/20 bg-error/5 px-3 py-2">
              {error}
              {error.includes('API key') && (
                <div className="mt-2 pt-2 border-t border-error/20">
                  <Link
                    href="/dashboard/api-keys"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Key className="h-3 w-3" />
                    Get API Key →
                  </Link>
                </div>
              )}
              {error.includes('Connect your wallet') && (
                <div className="mt-2 pt-2 border-t border-error/20">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Wallet className="h-3 w-3" />
                    Connect Wallet →
                  </Link>
                </div>
              )}
              {error.includes('network') && (
                <div className="mt-2 pt-2 border-t border-error/20">
                  <span className="inline-flex items-center gap-1 text-xs text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Network issue — check your connection
                  </span>
                </div>
              )}
              {error.includes('rate limit') && (
                <div className="mt-2 pt-2 border-t border-error/20">
                  <span className="inline-flex items-center gap-1 text-xs text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Rate limit exceeded — try again later
                  </span>
                </div>
              )}
              {error.includes('model') && (
                <div className="mt-2 pt-2 border-t border-error/20">
                  <span className="inline-flex items-center gap-1 text-xs text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Model not available — try another model
                  </span>
                </div>
              )}
            </div>
          )}
        {running && !result && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-border bg-void p-4"
          >
            <div className="flex items-center gap-2 text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-3">
              <Loader2 className="h-3 w-3 animate-spin text-accent" aria-hidden="true" />
              <span className="text-accent">Generating</span>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-3/4 rounded bg-text-tertiary/20 animate-pulse" />
              <div className="h-3 w-full rounded bg-text-tertiary/15 animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-text-tertiary/15 animate-pulse" />
            </div>
          </m.div>
        )}
        {result && (
          <m.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={EASE_SPRING}
            className="border border-accent/20 bg-void p-4"
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-2">
              <span className="inline-flex items-center gap-1.5 text-accent">
                <Check className="h-3 w-3" aria-hidden="true" />
                Response
              </span>
              <span className="tabular-nums">
                {result.tokens} tok
              </span>
            </div>
            <p className="text-sm text-text leading-relaxed whitespace-pre-wrap break-words">
              {result.text || '(empty response)'}
            </p>
          </m.div>
        )}
      </div>
    </div>
  )
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="aurora" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--color-accent-hover)_12%,transparent),color-mix(in_srgb,var(--color-accent-hover)_0%,transparent)_60%)]"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
        <m.h2
          variants={staggerContainer(0.18, 0.05)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text-bright tracking-[-0.03em] leading-[1.05]"
        >
          <m.span variants={blurIn} className="block">
            Stop renting models.
          </m.span>
          <m.span variants={blurIn} className="block text-accent glow-text-accent">
            Start paying for answers.
          </m.span>
        </m.h2>
        <m.p
          {...fadeUp(0.08)}
          className="mt-5 text-text-secondary text-base sm:text-lg max-w-xl mx-auto"
        >
          Connect a wallet, hit the API, get an answer. No sales call,
          no enterprise contract, no rate limit.
        </m.p>
        <m.div
          {...fadeUp(0.16)}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Magnetic strength={6}>
            <Link href="/dashboard" className="btn-primary sheen inline-flex items-center gap-2 transition-shadow hover:glow-accent-sm">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Connect wallet
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Magnetic>
          <Magnetic strength={6}>
            <Link href="/docs" className="btn-secondary inline-flex items-center gap-2">
              Read the docs
            </Link>
          </Magnetic>
        </m.div>
        <m.p
          {...fadeUp(0.24)}
          className="mt-6 text-[11px] text-text-tertiary font-mono"
        >
          Open source · MIT · No data retention
        </m.p>
      </div>
    </section>
  )
}

const FEATURED_HINT_COUNT = 17

export default function HomeClient({
  liveModelCount,
  featuredModels,
}: HomeClientProps) {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1,
  })

  const modelsQuery = useQuery({
    queryKey: ['models'],
    queryFn: () => api.models(),
    staleTime: 5 * 60_000,
  })

  const [providerStates, setProviderStates] = useState({
    venice: false,
    antseed: false,
    tinyfish: false,
  })

  useEffect(() => {
    const h = healthQuery.data
    if (!h) return
    const overallOk = h.status === 'ok'
    setProviderStates({
      venice:
        h?.checks?.venice?.status === 'ok' ||
        (overallOk && h?.checks?.venice === undefined),
      antseed: overallOk,
      tinyfish: overallOk,
    })
  }, [healthQuery.data])

  const onlineProviders = Object.values(providerStates).filter(Boolean).length
  const totalProviders = 3
  const modelsCount =
    liveModelCount ?? modelsQuery.data?.data?.length ?? FEATURED_HINT_COUNT

  const modelsForPlayground: { id: string; provider: string }[] = useMemo(() => {
    const fromApi =
      modelsQuery.data?.data
        ?.slice(0, 24)
        .map((m: ApiModel) => ({ id: m.id, provider: m.owned_by })) ?? []
    if (fromApi.length > 0) return fromApi
    return featuredModels.map((m) => ({ id: m.id, provider: m.provider }))
  }, [modelsQuery.data, featuredModels])

  return (
    <div className="min-h-screen bg-void text-text-secondary font-sans selection:bg-accent-dim selection:text-accent">
      <Hero
        health={healthQuery.data}
        liveModelCount={liveModelCount}
        modelsCount={modelsCount}
        onlineProviders={onlineProviders}
        totalProviders={totalProviders}
      />

      <ValueProps />

      <HowItWorks />

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <m.div {...fadeUp(0)} className="text-center mb-10 max-w-2xl mx-auto">
            <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-3">
              <TerminalSquare className="h-3 w-3" aria-hidden="true" />
              Zero to API call
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight">
              Try it in the browser. <span className="text-accent">No signup.</span>
            </h2>
            <p className="mt-3 text-text-secondary text-sm sm:text-base">
              Pick a model, type a prompt, get an answer. Real API, real latency, real bill.
            </p>
          </m.div>
          <m.div {...fadeUp(0.1)}>
            <MiniPlayground models={modelsForPlayground} />
          </m.div>
        </div>
      </section>

      <ModelsShowcase featuredModels={featuredModels} />

      <X402Section />

      <FeatureGrid />

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <m.div {...fadeUp(0)} className="text-center mb-10">
            <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-3">
              <Copy className="h-3 w-3" aria-hidden="true" />
              Integration
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-bright tracking-tight">
              Five lines. <span className="text-accent">Any language.</span>
            </h2>
            <p className="mt-3 text-text-secondary text-sm sm:text-base">
              Drop-in replacement for the OpenAI base URL. Works with every SDK and curl.
            </p>
          </m.div>
          <m.div {...fadeUp(0.1)}>
            <CodeBlock code={CURL_SNIPPET} language="curl" />
          </m.div>
        </div>
      </section>

      <FinalCTA />
    </div>
  )
}
