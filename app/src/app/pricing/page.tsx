'use client'

import { useState, useMemo, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, Coins, Zap, CreditCard, HelpCircle, ChevronDown, Link2, Rocket } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { MODELS as SOURCE_MODELS } from '@/lib/models-data'

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

const VENDOR_DISPLAY: Record<string, string> = {
  Claude: 'Anthropic',
  Gemini: 'Google',
  OpenRouter: 'OpenAI',
  Venice: 'Venice',
  AntSeed: 'AntSeed',
  Together: 'Together',
}

const MODELS: PricedModel[] = SOURCE_MODELS.map((m) => ({
  id: m.id,
  name: m.name,
  category: m.tier as Category,
  provider: VENDOR_DISPLAY[m.provider] ?? m.provider,
  inputPer1M: m.inputPricePer1M,
  outputPer1M: m.outputPricePer1M,
  ctx: m.contextLength,
}))

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'frontier', label: 'Frontier' },
  { key: 'premium', label: 'Premium' },
  { key: 'mid', label: 'Mid-Range' },
  { key: 'budget', label: 'Budget' },
]

const CATEGORY_STYLES: Record<Category, { active: string; inactive: string }> = {
  all: { active: 'bg-accent text-void', inactive: 'bg-surface text-text-secondary border border-border' },
  frontier: { active: 'bg-accent text-text-inverse', inactive: 'bg-surface text-accent border border-accent/30' },
  premium: { active: 'bg-accent text-text-inverse', inactive: 'bg-surface text-accent border border-accent/30' },
  mid: { active: 'bg-accent text-void', inactive: 'bg-surface text-accent border border-accent/30' },
  budget: { active: 'bg-success text-text-inverse', inactive: 'bg-surface text-success border border-success/30' },
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
    tagStyle: 'bg-surface text-text-secondary border border-border',
  },
  {
    icon: Rocket,
    title: 'x402 Pay-Per-Request',
    desc: 'Gasless payments on Solana and Base. Each API request deducts fees automatically.',
    tag: 'no pre-fund',
    tagStyle: 'bg-accent-dim text-accent border border-accent/30',
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
    <div className="border-b border-border">
      <button
        id={buttonId}
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-text-bright focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="font-medium text-text">{item.q}</span>
        <ChevronDown className={`h-5 w-5 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div 
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 pb-5' : 'max-h-0'}`}
      >
        <p className="text-sm text-text-secondary">{item.a}</p>
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
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/30 bg-accent-dim mb-6">
            <span className="text-xs font-mono text-accent uppercase tracking-widest">{'// pricing'}</span>
          </div>
          <h1 className="h1-page text-text-bright">
            AI API Pricing
          </h1>
          <p className="mt-4 text-base text-text-secondary max-w-2xl">
            Credit-based billing. No subscriptions. No minimums. Pay per token across {MODELS.length} models via unified OpenAI-compatible API.
          </p>
        </div>

        {/* ── Payment Methods ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-mono text-text-muted uppercase tracking-widest">payment methods</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon
              return (
                <div key={method.title} className="relative group">
                  <div className="absolute inset-0 bg-accent-dim rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative p-5 rounded-xl border border-border bg-surface hover:border-accent/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-elevated">
                        <Icon className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-text-bright truncate">{method.title}</h3>
                        <p className="mt-1 text-xs text-text-secondary leading-relaxed">{method.desc}</p>
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
        <div className="mb-12 p-4 rounded-xl border border-accent/20 bg-accent-dim">
          <div className="flex items-start gap-3">
            <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <h4 className="text-sm font-semibold text-accent">x402 Protocol</h4>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Native x402 support lets applications integrate AI payments without managing credit balances.
                <Link href="/crypto-payments" className="ml-1 font-medium text-accent hover:text-accent-hover transition-colors">Learn more →</Link>
              </p>
            </div>
          </div>
        </div>

        {/* ── Model Table - Mobile Responsive ── */}
        <div className="mb-16">
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-4 py-4 sm:px-6">
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
              <p className="text-xs text-text-muted font-mono">{filtered.length} models</p>
            </div>
            
            {/* Horizontal scroll wrapper with gradient hint */}
            <div className="relative">
              {/* Right gradient hint for scrollable content */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10 hidden sm:block" />
              
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <table className="w-full text-left min-w-[640px] sm:min-w-0">
                  <thead>
                    <tr className="border-b border-border bg-surface-elevated">
                      <th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted">Model</th>
                      <th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted">Provider</th>
                      <th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted text-right">Input / 1M</th>
                      <th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted text-right">Output / 1M</th>
                      <th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted text-right">Ctx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m, i) => (
                      <tr key={m.id} className={`border-b border-border/50 transition-colors hover:bg-surface-elevated/50 ${i % 2 === 1 ? 'bg-surface-elevated/30' : ''}`}>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-text-bright">{m.name}</span>
                          <span className="ml-2 text-xs text-text-secondary font-mono hidden sm:inline">{m.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-mono font-medium ${
                            m.provider === 'Venice' ? 'bg-accent/20 text-accent' :
                            m.provider === 'AntSeed' ? 'bg-accent/20 text-accent' :
                            'bg-secondary/20 text-secondary'
                          }`}>
                            {m.provider}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-medium text-accent">{fmtPrice(m.inputPer1M)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-medium text-text-secondary">{fmtPrice(m.outputPer1M)}</td>
                        <td className="px-4 py-3 text-right text-xs text-text-secondary font-mono">{m.ctx}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile scroll indicator - swipe hint */}
              <div className="sm:hidden flex items-center justify-center py-2 text-[10px] sm:text-xs text-text-muted">
                <span className="font-mono">Swipe to scroll &rarr;</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-mono font-semibold uppercase tracking-widest text-text-secondary">FAQ</h3>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
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
            <Link href="/models" className="text-sm text-text-secondary hover:text-accent transition-colors px-4 py-3 text-center">
              View All Models
              <ArrowRight className="w-4 h-4 ml-1 inline-block" />
            </Link>
          </div>
        </div>

        {/* ── TinyFish ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-mono text-text-muted uppercase tracking-widest">add-ons</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <LazyTinyFishPricing />
          </Suspense>
        </div>

        {/* ── Billing Notes ── */}
        <div className="p-4 rounded-xl border border-amber/20 bg-amber/5">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-amber mb-3">Billing</h4>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {[
              'Credits are 1:1 USD, non-redeemable, non-transferable',
              '12-month rolling expiry from date of deposit',
              'No credit float — credits appear after settlement',
              'Billed per token, deducted in real-time',
            ].map((note) => (
              <div key={note} className="flex items-start gap-2">
                <div className="mt-1.5 h-1 w-1 rounded-full bg-amber" />
                <span className="text-xs text-text-secondary">{note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}