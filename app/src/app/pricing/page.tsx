'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Coins, Zap } from 'lucide-react'

type Category = 'all' | 'frontier' | 'premium' | 'mid' | 'budget'

interface PricedModel {
  id: string
  name: string
  category: Category
  provider: string
  inputPer1M: number
  outputPer1M: number
  ctx: string
  caps: string[]
}

const MODELS: PricedModel[] = [
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', category: 'frontier', provider: 'Venice', inputPer1M: 15.00, outputPer1M: 75.00, ctx: '200K', caps: ['chat','coding','reasoning','vision'] },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', category: 'frontier', provider: 'Venice', inputPer1M: 3.00, outputPer1M: 15.00, ctx: '200K', caps: ['chat','coding','vision'] },
  { id: 'gpt-5.5', name: 'GPT-5.5', category: 'frontier', provider: 'Venice', inputPer1M: 10.00, outputPer1M: 30.00, ctx: '128K', caps: ['chat','coding','reasoning'] },
  { id: 'gpt-4o', name: 'GPT-4o', category: 'frontier', provider: 'Venice', inputPer1M: 2.50, outputPer1M: 10.00, ctx: '128K', caps: ['chat','coding','vision'] },
  { id: 'o3', name: 'OpenAI o3', category: 'frontier', provider: 'Venice', inputPer1M: 10.00, outputPer1M: 40.00, ctx: '200K', caps: ['reasoning','coding','agents'] },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', category: 'frontier', provider: 'Venice', inputPer1M: 1.50, outputPer1M: 9.00, ctx: '1M', caps: ['chat','reasoning','vision'] },
  { id: 'mistral-large', name: 'Mistral Large', category: 'frontier', provider: 'Venice', inputPer1M: 2.00, outputPer1M: 6.00, ctx: '128K', caps: ['chat','reasoning'] },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', category: 'premium', provider: 'Venice', inputPer1M: 0.80, outputPer1M: 4.00, ctx: '200K', caps: ['chat','fast','vision'] },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', category: 'premium', provider: 'Venice', inputPer1M: 0.15, outputPer1M: 0.60, ctx: '128K', caps: ['chat','fast'] },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', category: 'premium', provider: 'Venice', inputPer1M: 0.15, outputPer1M: 0.60, ctx: '1M', caps: ['chat','fast','vision'] },
  { id: 'grok-41-fast', name: 'Grok 4.1 Fast', category: 'premium', provider: 'AntSeed', inputPer1M: 0.26, outputPer1M: 0.66, ctx: '128K', caps: ['chat','fast','reasoning'] },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', category: 'premium', provider: 'AntSeed', inputPer1M: 0.18, outputPer1M: 1.00, ctx: '128K', caps: ['chat','coding','reasoning','math'] },
  { id: 'deepseek-r1', name: 'DeepSeek R1', category: 'premium', provider: 'AntSeed', inputPer1M: 0.55, outputPer1M: 2.19, ctx: '64K', caps: ['reasoning','math','coding'] },
  { id: 'qwen3-coder-480b', name: 'Qwen3 Coder 480B', category: 'premium', provider: 'AntSeed', inputPer1M: 0.14, outputPer1M: 0.60, ctx: '128K', caps: ['coding','chat','reasoning'] },
  { id: 'venice-uncensored', name: 'Venice Uncensored', category: 'premium', provider: 'Venice', inputPer1M: 0.07, outputPer1M: 0.35, ctx: '32K', caps: ['chat','uncensored','vision'] },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', category: 'mid', provider: 'AntSeed', inputPer1M: 0.05, outputPer1M: 0.19, ctx: '128K', caps: ['chat','fast','coding'] },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', category: 'mid', provider: 'Both', inputPer1M: 0.30, outputPer1M: 0.48, ctx: '128K', caps: ['chat','fast'] },
  { id: 'qwen3-235b', name: 'Qwen3 235B', category: 'mid', provider: 'AntSeed', inputPer1M: 0.09, outputPer1M: 0.45, ctx: '128K', caps: ['chat','reasoning'] },
  { id: 'glm-5.1', name: 'GLM-5.1', category: 'mid', provider: 'AntSeed', inputPer1M: 0.25, outputPer1M: 0.60, ctx: '128K', caps: ['chat','coding'] },
  { id: 'kimi-k2-6', name: 'Kimi K2.6', category: 'mid', provider: 'AntSeed', inputPer1M: 0.07, outputPer1M: 0.42, ctx: '128K', caps: ['chat','reasoning','coding'] },
  { id: 'gemma-3-27b', name: 'Gemma 3 27B', category: 'mid', provider: 'AntSeed', inputPer1M: 0.09, outputPer1M: 0.18, ctx: '128K', caps: ['chat','vision'] },
  { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', category: 'mid', provider: 'AntSeed', inputPer1M: 0.04, outputPer1M: 0.14, ctx: '128K', caps: ['chat','coding','math'] },
  { id: 'mistral-small-3.2', name: 'Mistral Small 3.2', category: 'mid', provider: 'AntSeed', inputPer1M: 0.09, outputPer1M: 0.25, ctx: '64K', caps: ['chat','fast'] },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.01, ctx: '128K', caps: ['chat','fast','cheap'] },
  { id: 'qwen3-8b', name: 'Qwen3 8B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.01, ctx: '32K', caps: ['chat','fast','cheap'] },
  { id: 'qwen3-coder-30b', name: 'Qwen3 Coder 30B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.02, ctx: '64K', caps: ['coding','fast'] },
  { id: 'gemma4-31b', name: 'Gemma 4 31B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.02, ctx: '128K', caps: ['chat','coding','vision'] },
  { id: 'minimax-m2.7', name: 'MiniMax M2.7', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.02, ctx: '64K', caps: ['chat','fast'] },
]

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'frontier', label: 'FRONTIER' },
  { key: 'premium', label: 'PREMIUM' },
  { key: 'mid', label: 'MID-RANGE' },
  { key: 'budget', label: 'BUDGET' },
]

const CATEGORY_COLORS: Record<Category, string> = {
  all: 'text-text',
  frontier: 'text-pink',
  premium: 'text-amber',
  mid: 'text-cyan',
  budget: 'text-green',
}

const CATEGORY_BORDER: Record<Category, string> = {
  all: 'border-border',
  frontier: 'border-pink/40',
  premium: 'border-amber/40',
  mid: 'border-cyan/40',
  budget: 'border-green/40',
}

const CATEGORY_BG: Record<Category, string> = {
  all: 'bg-surface',
  frontier: 'bg-pink/5',
  premium: 'bg-amber/5',
  mid: 'bg-cyan/5',
  budget: 'bg-green/5',
}

const STAKING_TIERS = [
  { stake: '1,000 OMA', discount: 3, label: 'BRONZE' },
  { stake: '10,000 OMA', discount: 6, label: 'SILVER' },
  { stake: '50,000 OMA', discount: 10, label: 'GOLD' },
  { stake: '100,000 OMA', discount: 15, label: 'PLATINUM' },
]

function fmtPrice(n: number): string {
  if (n < 0.01) return '$0.01'
  if (n < 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(2)}`
}

function AnimatedSection({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(element)
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ${className} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function TableRow({ model, index }: { model: PricedModel; index: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(element)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <tr
      ref={ref}
      className={`border-b border-border/50 transition-all duration-300 hover:bg-panel ${index % 2 === 1 ? 'bg-surface/30' : ''} ${
        isVisible ? 'opacity-100' : 'opacity-0 translate-y-2'
      }`}
      style={{ transitionDelay: `${index * 30}ms` }}
    >
      <td className="px-4 py-3">
        <div className="text-xs font-bold text-cyan">{model.id}</div>
        <div className="text-[10px] text-text-dim">{model.name}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
          model.provider === 'Venice' ? 'bg-blue-500/20 text-blue-400' :
          model.provider === 'AntSeed' ? 'bg-purple-500/20 text-purple-400' :
          'bg-cyan/10 text-cyan'
        }`}>
          {model.provider.toUpperCase()}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-right font-bold">{fmtPrice(model.inputPer1M)}</td>
      <td className="px-4 py-3 text-xs text-right font-bold">{fmtPrice(model.outputPer1M)}</td>
      <td className="px-4 py-3 text-xs text-right text-text-dim">{model.ctx}</td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${CATEGORY_COLORS[model.category]}`}>
          {model.category.toUpperCase()}
        </span>
      </td>
    </tr>
  )
}

export default function PricingPage() {
  const [category, setCategory] = useState<Category>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'input' | 'output'>('input')

  const filtered = useMemo(() =>
    MODELS
      .filter((m) => category === 'all' || m.category === category)
      .filter((m) =>
        m.id.toLowerCase().includes(search.toLowerCase()) ||
        m.name.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        if (sortBy === 'input') return a.inputPer1M - b.inputPer1M
        return a.outputPer1M - b.outputPer1M
      }),
    [category, search, sortBy]
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-mono">
      <AnimatedSection>
        <div className="mb-2">
          <h1 className="text-3xl font-bold tracking-tight">PRICING</h1>
        </div>
        <p className="mb-8 text-sm text-text-dim">
          Pay per token. No subscriptions. No minimums. Credits are 1:1 USD.
        </p>
      </AnimatedSection>

      {/* Payment Methods */}
      <AnimatedSection delay={100} className="mb-8">
        <div className="card">
          <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-dim">
            PAYMENT METHODS
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card-glow rounded-lg border border-cyan/20 bg-cyan/5 p-4">
              <div className="mb-2 text-sm font-bold text-cyan">USDC (Direct)</div>
              <div className="text-xs text-text-dim">
                Send USDC on Base or Solana. 1:1 USD credits. Instant settlement.
              </div>
              <div className="mt-2 inline-block rounded bg-cyan/20 px-2 py-0.5 text-[10px] font-bold text-cyan">
                INSTANT
              </div>
            </div>
            <div className="card-glow rounded-lg border border-amber/20 bg-amber/5 p-4">
              <div className="mb-2 text-sm font-bold text-amber">OMA Token</div>
              <div className="text-xs text-text-dim">
                Deposit OMA on Base. 5% bonus at TWAP oracle rate. Circuit breakers apply.
              </div>
              <div className="mt-2 inline-block rounded bg-amber/20 px-2 py-0.5 text-[10px] font-bold text-amber">
                +5% BONUS
              </div>
            </div>
            <div className="card-glow rounded-lg border border-text-dim/20 bg-surface p-4">
              <div className="mb-2 text-sm font-bold text-text">HoudiniSwap</div>
              <div className="text-xs text-text-dim">
                Swap 100+ cryptocurrencies (BTC, XMR, SOL, DOGE) to USDC on Base.
              </div>
              <div className="mt-2 inline-block rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-text-dim border border-border">
                100+ COINS
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Staking Discounts */}
      <AnimatedSection delay={200} className="mb-8">
        <div className="card">
          <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-dim">
            STAKING DISCOUNTS
          </div>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-cyan/20 bg-cyan/5 px-4 py-3 text-xs">
            <span className="text-cyan font-bold">OMA BONUS: 5%</span>
            <span className="text-text-dim">+</span>
            <span className="text-amber font-bold">STAKING: UP TO 15%</span>
            <span className="text-text-dim">=</span>
            <span className="text-cyan font-bold">MAX 20% COMBINED</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STAKING_TIERS.map((tier, i) => (
              <div
                key={tier.label}
                className="card-glow rounded-lg border border-border bg-surface p-4 text-center transition-all duration-300 hover:border-cyan/30"
                style={{ transitionDelay: `${300 + i * 50}ms` }}
              >
                <div className="mono text-2xl font-bold text-cyan">-{tier.discount}%</div>
                <div className="mono text-xs font-bold mt-1">{tier.label}</div>
                <div className="mono text-[10px] text-text-dim mt-0.5">{tier.stake}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[11px] text-text-dim">
            Discounts apply to inference costs. OMA bonus + staking discount capped at 20% total.
            Staking discounts are off-chain; OMA deposits subject to circuit breaker thresholds.
          </div>
        </div>
      </AnimatedSection>

      {/* Model Pricing Table */}
      <AnimatedSection delay={300}>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`rounded border px-3 py-1.5 text-xs font-bold uppercase transition-all ${
                  category === cat.key
                    ? `${CATEGORY_BORDER[cat.key]} ${CATEGORY_BG[cat.key]} ${CATEGORY_COLORS[cat.key]}`
                    : 'border-border bg-surface text-text-dim hover:text-text'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text placeholder:text-text-dim/50 focus:border-cyan/50 focus:outline-none"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'input' | 'output')}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text focus:border-cyan/50 focus:outline-none"
            >
              <option value="input">Sort: Input Price</option>
              <option value="output">Sort: Output Price</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>

        <div className="mb-2 text-xs text-text-dim">
          {filtered.length} model{filtered.length !== 1 ? 's' : ''} | Venice AI + AntSeed P2P
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-panel">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Model</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Provider</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-dim text-right">Input / 1M</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-dim text-right">Output / 1M</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-dim text-right">Context</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Category</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <TableRow key={m.id} model={m} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AnimatedSection>

      {/* Credits Disclaimer */}
      <AnimatedSection delay={400} className="mt-8">
        <div className="card border-amber/20">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber">
            CREDITS & BILLING
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="space-y-2 text-xs text-text-dim">
                <div className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                  <span>Credits are 1:1 USD, non-redeemable, non-transferable</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                  <span>12-month rolling expiry from date of deposit</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                  <span>No credit float -- credits appear after settlement</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                  <span>Billed per token, deducted in real-time</span>
                </div>
              </div>
            </div>
            <div>
              <div className="space-y-2 text-xs text-text-dim">
                <div className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>Open-source models (AntSeed) carry 100-200% markup</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>Proprietary models (Venice) carry 0-10% markup</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>OMA deposits subject to circuit breaker thresholds</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>Prices shown are base cost before staking discounts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* CTA */}
      <AnimatedSection delay={500} className="mt-8 text-center">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/deposit"
            className="group relative inline-flex items-center gap-2 rounded-xl border border-cyan/50 bg-cyan/10 px-8 py-4 text-sm font-bold text-cyan transition-all duration-300 hover:border-cyan hover:bg-cyan hover:text-void hover:shadow-[0_0_30px_rgba(0,255,200,0.25)] hover:scale-105 active:scale-100 min-h-[52px] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 group-hover:animate-pulse" />
            <Zap className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Start AI Inference
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/deposit"
            className="group inline-flex items-center gap-2 rounded-xl border border-green/40 bg-green/8 px-7 py-4 text-sm font-semibold text-green transition-all duration-300 hover:border-green/60 hover:bg-green hover:text-void hover:shadow-[0_0_25px_rgba(0,255,140,0.2)] hover:scale-105 active:scale-100 min-h-[52px]"
          >
            <Coins className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Deposit Crypto
          </Link>
          <Link href="/models" className="btn-secondary inline-flex items-center gap-2 px-6 py-3.5 text-sm font-mono min-h-[48px]">
            View All Models
          </Link>
        </div>
      </AnimatedSection>
    </div>
  )
}