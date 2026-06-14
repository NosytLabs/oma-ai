'use client'

import { useState, useMemo, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, Coins, Zap, CreditCard, HelpCircle, ChevronDown, Link2, Rocket } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

const LazyTinyFishPricing = dynamic(
  () => import('@/components/tinyfish-pricing').then(mod => mod.TinyFishPricing),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />
  }
)

type Category = 'all' | 'frontier' | 'premium' | 'mid' | 'budget'

interface PricedModel {
  id: string
  name: string
  category: Category
  provider: string
  inputPer1M: number
  outputPer1M: number
  ctx: string
}

const MODELS: PricedModel[] = [
  { id: 'claude-opus-4', name: 'Claude Opus 4', category: 'frontier', provider: 'Anthropic', inputPer1M: 15.00, outputPer1M: 75.00, ctx: '200K' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', category: 'frontier', provider: 'Anthropic', inputPer1M: 3.00, outputPer1M: 15.00, ctx: '200K' },
  { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', category: 'frontier', provider: 'Anthropic', inputPer1M: 3.00, outputPer1M: 15.00, ctx: '200K' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', category: 'frontier', provider: 'Google', inputPer1M: 1.25, outputPer1M: 10.00, ctx: '1M' },
  { id: 'gemini-2.5-pro-thinking', name: 'Gemini 2.5 Pro (thinking)', category: 'frontier', provider: 'Google', inputPer1M: 1.25, outputPer1M: 10.00, ctx: '1M' },
  { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', category: 'mid', provider: 'Anthropic', inputPer1M: 0.80, outputPer1M: 4.00, ctx: '200K' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', category: 'mid', provider: 'Google', inputPer1M: 0.075, outputPer1M: 0.30, ctx: '1M' },
  { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash (thinking)', category: 'mid', provider: 'Google', inputPer1M: 0.075, outputPer1M: 0.30, ctx: '1M' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', category: 'mid', provider: 'OpenAI', inputPer1M: 0.15, outputPer1M: 0.60, ctx: '128K' },
  { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', category: 'premium', provider: 'Venice', inputPer1M: 0.50, outputPer1M: 1.50, ctx: '64K' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', category: 'mid', provider: 'Venice', inputPer1M: 0.35, outputPer1M: 0.90, ctx: '8K' },
  { id: 'llama-3.3-70b-together', name: 'Llama 3.3 70B (Together)', category: 'premium', provider: 'Together', inputPer1M: 0.35, outputPer1M: 0.90, ctx: '8K' },
  { id: 'llama-3.2-3b', name: 'Llama 3.2 3B', category: 'budget', provider: 'Venice', inputPer1M: 0.06, outputPer1M: 0.12, ctx: '8K' },
  { id: 'free/gpt-3.5-turbo', name: 'GPT-3.5 Turbo (FREE)', category: 'budget', provider: 'OpenAI', inputPer1M: 0, outputPer1M: 0, ctx: '16K' },
  { id: 'free/claude-3-haiku', name: 'Claude 3 Haiku (FREE)', category: 'budget', provider: 'Anthropic', inputPer1M: 0, outputPer1M: 0, ctx: '200K' },
  { id: 'free/gemini-pro', name: 'Gemini Pro (FREE)', category: 'budget', provider: 'Google', inputPer1M: 0, outputPer1M: 0, ctx: '32K' },
  { id: 'free/llama-3-8b', name: 'Llama 3 8B (FREE)', category: 'budget', provider: 'Meta', inputPer1M: 0, outputPer1M: 0, ctx: '8K' },
]

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'frontier', label: 'Frontier' },
  { key: 'premium', label: 'Premium' },
  { key: 'mid', label: 'Mid-Range' },
  { key: 'budget', label: 'Budget' },
]

const CATEGORY_STYLES: Record<Category, { active: string; inactive: string }> = {
  all: { active: 'bg-[var(--color-accent)] text-[var(--color-void)]', inactive: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]' },
  frontier: { active: 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]', inactive: 'bg-[var(--color-surface)] text-[var(--color-accent)] border border-[var(--color-accent)]/30' },
  premium: { active: 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]', inactive: 'bg-[var(--color-surface)] text-[var(--color-accent)] border border-[var(--color-accent)]/30' },
  mid: { active: 'bg-[var(--color-accent)] text-[var(--color-void)]', inactive: 'bg-[var(--color-surface)] text-[var(--color-accent)] border border-[var(--color-accent)]/30' },
  budget: { active: 'bg-[var(--color-success)] text-[var(--color-text-inverse)]', inactive: 'bg-[var(--color-surface)] text-[var(--color-success)] border border-[var(--color-success)]/30' },
}

const PAYMENT_METHODS = [
  {
    icon: CreditCard,
    title: 'USDC on Base / Solana',
    desc: 'Direct USDC transfers at 1:1 USD rate. Settlement is immediate on confirmation.',
    tag: null,
    tagStyle: '',
  },
  {
    icon: Coins,
    title: 'HoudiniSwap',
    desc: 'Convert 100+ cryptocurrencies to USDC credits on Base. Rate varies by asset.',
    tag: '100+ assets',
    tagStyle: 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
  },
  {
    icon: Rocket,
    title: 'x402 Pay-Per-Request',
    desc: 'Gasless payments on Solana and Base. Each API request deducts fees automatically.',
    tag: 'no pre-fund',
    tagStyle: 'bg-[var(--color-accent-dim)] text-[var(--color-accent)] border border-[var(--color-accent)]/30',
  },
]

const FAQ_ITEMS = [
  {
    q: 'How do I add credits?',
    a: 'Deposit USDC on Base or Solana, or swap from 100+ cryptocurrencies via HoudiniSwap. Instant settlement.'
  },
  {
    q: 'Do credits expire?',
    a: 'Credits have a 12-month rolling expiry from deposit date. They are non-transferable and non-redeemable.'
  },
  {
    q: 'What payment methods are accepted?',
    a: 'USDC (Direct) on Base or Solana for 1:1 USD credits, HoudiniSwap to convert 100+ cryptocurrencies to USDC credits, or x402 pay-per-request for gasless Solana/Base payments.'
  },
  {
    q: 'What is x402 pay-per-request?',
    a: 'x402 enables gasless AI inference payments on Solana and Base. Pay for each API request without pre-funding credits. Fees are deducted automatically per request.'
  },
]

function fmtPrice(n: number): string {
  if (n < 0.01) return '$0.01'
  if (n < 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function AccordionItem({ item, isOpen, onToggle, index }: { item: typeof FAQ_ITEMS[0]; isOpen: boolean; onToggle: () => void; index: number }) {
  const buttonId = `faq-button-${index}`
  const panelId = `faq-panel-${index}`
  
  return (
    <div className="border-b border-[var(--color-border)]">
      <button
        id={buttonId}
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-[var(--color-text-bright)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="font-medium text-[var(--color-text)]">{item.q}</span>
        <ChevronDown className={`h-5 w-5 text-[var(--color-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div 
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 pb-5' : 'max-h-0'}`}
      >
        <p className="text-sm text-[var(--color-text-secondary)]">{item.a}</p>
      </div>
    </div>
  )
}

export default function PricingPage() {
  const [category, setCategory] = useState<Category>('all')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const filtered = useMemo(() =>
    MODELS.filter((m) => category === 'all' || m.category === category),
    [category]
  )

  return (
    <div className="min-h-screen bg-[var(--color-void)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] mb-6">
            <span className="text-xs font-mono text-[var(--color-accent)] uppercase tracking-widest">{'// pricing'}</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-bright)] sm:text-5xl font-syne">
            AI API Pricing
          </h1>
          <p className="mt-4 text-base text-[var(--color-text-secondary)] max-w-2xl">
            Credit-based billing. No subscriptions. No minimums. Pay per token across 91+ models via unified OpenAI-compatible API.
          </p>
        </div>

        {/* ── Payment Methods ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-widest">payment methods</span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon
              return (
                <div key={method.title} className="relative group">
                  <div className="absolute inset-0 bg-[var(--color-accent-dim)] rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
                        <Icon className="h-5 w-5 text-[var(--color-accent)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--color-text-bright)] truncate">{method.title}</h3>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">{method.desc}</p>
                      </div>
                    </div>
                    {method.tag && (
                      <div className={`mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono border ${method.tagStyle}`}>
                        {method.tag}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── x402 Banner ── */}
        <div className="mb-12 p-4 rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent-dim)]">
          <div className="flex items-start gap-3">
            <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]" />
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-accent)]">x402 Protocol</h4>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Native x402 support lets applications integrate AI payments without managing credit balances.
                <Link href="/crypto-payments" className="ml-1 font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors">Learn more →</Link>
              </p>
            </div>
          </div>
        </div>

        {/* ── Model Table - Mobile Responsive ── */}
        <div className="mb-16">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
              <div className="flex flex-wrap gap-2 mb-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={`px-3 py-2 min-h-[44px] min-w-[44px] text-xs font-mono font-medium rounded-full transition-all duration-150 ${
                      category === cat.key
                        ? CATEGORY_STYLES[cat.key].active
                        : CATEGORY_STYLES[cat.key].inactive
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] font-mono">{filtered.length} models</p>
            </div>
            
            {/* Horizontal scroll wrapper with gradient hint */}
            <div className="relative">
              {/* Right gradient hint for scrollable content */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--color-surface)] to-transparent pointer-events-none z-10 hidden sm:block" />
              
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent">
                <table className="w-full text-left min-w-[640px] sm:min-w-0">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
                      <th scope="col" className="px-4 py-4 text-xs font-syne font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Model</th>
                      <th scope="col" className="px-4 py-4 text-xs font-syne font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Provider</th>
                      <th scope="col" className="px-4 py-4 text-xs font-syne font-semibold uppercase tracking-widest text-[var(--color-text-muted)] text-right">Input / 1M</th>
                      <th scope="col" className="px-4 py-4 text-xs font-syne font-semibold uppercase tracking-widest text-[var(--color-text-muted)] text-right">Output / 1M</th>
                      <th scope="col" className="px-4 py-4 text-xs font-syne font-semibold uppercase tracking-widest text-[var(--color-text-muted)] text-right">Ctx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m, i) => (
                      <tr key={m.id} className={`border-b border-[var(--color-border)]/50 transition-colors hover:bg-[var(--color-surface-elevated)]/50 ${i % 2 === 1 ? 'bg-[var(--color-surface-elevated)]/30' : ''}`}>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-[var(--color-text-bright)]">{m.name}</span>
                          <span className="ml-2 text-xs text-[var(--color-text-secondary)] font-mono hidden sm:inline">{m.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-mono font-medium ${
                            m.provider === 'Venice' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' :
                            m.provider === 'AntSeed' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' :
                            'bg-[var(--color-secondary)]/20 text-[var(--color-secondary)]'
                          }`}>
                            {m.provider}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-medium text-[var(--color-accent)]">{fmtPrice(m.inputPer1M)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-medium text-[var(--color-text-secondary)]">{fmtPrice(m.outputPer1M)}</td>
                        <td className="px-4 py-3 text-right text-xs text-[var(--color-text-secondary)] font-mono">{m.ctx}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile scroll indicator - swipe hint */}
              <div className="sm:hidden flex items-center justify-center py-2 text-[10px] text-[var(--color-text-muted)]">
                <span className="font-mono">Swipe to scroll &rarr;</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-mono font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">FAQ</h3>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={i}
                item={item}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="mb-12 py-8">
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/dashboard"
              className="btn-primary text-sm px-6 py-3 w-full sm:w-auto text-center"
            >
              <Zap className="h-4 w-4 mr-2" />
              Start AI Inference
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
            <Link
              href="/deposit"
              className="btn-secondary text-sm px-6 py-3 w-full sm:w-auto text-center"
            >
              <Coins className="h-4 w-4 mr-2" />
              Deposit Crypto
            </Link>
            <Link href="/models" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors px-4 py-3 text-center">
              View All Models
              <ArrowRight className="w-4 h-4 ml-1 inline-block" />
            </Link>
          </div>
        </div>

        {/* ── TinyFish ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-widest">add-ons</span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <LazyTinyFishPricing />
          </Suspense>
        </div>

        {/* ── Billing Notes ── */}
        <div className="p-4 rounded-xl border border-[var(--color-amber)]/20 bg-[var(--color-amber)]/5">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-[var(--color-amber)] mb-3">Billing</h4>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {[
              'Credits are 1:1 USD, non-redeemable, non-transferable',
              '12-month rolling expiry from date of deposit',
              'No credit float — credits appear after settlement',
              'Billed per token, deducted in real-time',
            ].map((note) => (
              <div key={note} className="flex items-start gap-2">
                <div className="mt-1.5 h-1 w-1 rounded-full bg-[var(--color-amber)]" />
                <span className="text-xs text-[var(--color-text-secondary)]">{note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}