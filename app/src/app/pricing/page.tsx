'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Coins, Zap, CreditCard, HelpCircle, ChevronDown, Check, Link2, Rocket, Sparkles } from 'lucide-react'
import { TinyFishPricing } from '@/components/tinyfish-pricing'

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
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', category: 'frontier', provider: 'Venice', inputPer1M: 15.00, outputPer1M: 75.00, ctx: '200K' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', category: 'frontier', provider: 'Venice', inputPer1M: 3.00, outputPer1M: 15.00, ctx: '200K' },
  { id: 'gpt-5.5', name: 'GPT-5.5', category: 'frontier', provider: 'Venice', inputPer1M: 10.00, outputPer1M: 30.00, ctx: '128K' },
  { id: 'gpt-4o', name: 'GPT-4o', category: 'frontier', provider: 'Venice', inputPer1M: 2.50, outputPer1M: 10.00, ctx: '128K' },
  { id: 'o3', name: 'OpenAI o3', category: 'frontier', provider: 'Venice', inputPer1M: 10.00, outputPer1M: 40.00, ctx: '200K' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', category: 'frontier', provider: 'Venice', inputPer1M: 1.50, outputPer1M: 9.00, ctx: '1M' },
  { id: 'mistral-large', name: 'Mistral Large', category: 'frontier', provider: 'Venice', inputPer1M: 2.00, outputPer1M: 6.00, ctx: '128K' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', category: 'premium', provider: 'Venice', inputPer1M: 0.80, outputPer1M: 4.00, ctx: '200K' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', category: 'premium', provider: 'Venice', inputPer1M: 0.15, outputPer1M: 0.60, ctx: '128K' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', category: 'premium', provider: 'Venice', inputPer1M: 0.15, outputPer1M: 0.60, ctx: '1M' },
  { id: 'grok-41-fast', name: 'Grok 4.1 Fast', category: 'premium', provider: 'AntSeed', inputPer1M: 0.26, outputPer1M: 0.66, ctx: '128K' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', category: 'premium', provider: 'AntSeed', inputPer1M: 0.18, outputPer1M: 1.00, ctx: '128K' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', category: 'premium', provider: 'AntSeed', inputPer1M: 0.55, outputPer1M: 2.19, ctx: '64K' },
  { id: 'qwen3-coder-480b', name: 'Qwen3 Coder 480B', category: 'premium', provider: 'AntSeed', inputPer1M: 0.14, outputPer1M: 0.60, ctx: '128K' },
  { id: 'venice-uncensored', name: 'Venice Uncensored', category: 'premium', provider: 'Venice', inputPer1M: 0.07, outputPer1M: 0.35, ctx: '32K' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', category: 'mid', provider: 'AntSeed', inputPer1M: 0.05, outputPer1M: 0.19, ctx: '128K' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', category: 'mid', provider: 'Both', inputPer1M: 0.30, outputPer1M: 0.48, ctx: '128K' },
  { id: 'qwen3-235b', name: 'Qwen3 235B', category: 'mid', provider: 'AntSeed', inputPer1M: 0.09, outputPer1M: 0.45, ctx: '128K' },
  { id: 'glm-5.1', name: 'GLM-5.1', category: 'mid', provider: 'AntSeed', inputPer1M: 0.25, outputPer1M: 0.60, ctx: '128K' },
  { id: 'kimi-k2-6', name: 'Kimi K2.6', category: 'mid', provider: 'AntSeed', inputPer1M: 0.07, outputPer1M: 0.42, ctx: '128K' },
  { id: 'gemma-3-27b', name: 'Gemma 3 27B', category: 'mid', provider: 'AntSeed', inputPer1M: 0.09, outputPer1M: 0.18, ctx: '128K' },
  { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', category: 'mid', provider: 'AntSeed', inputPer1M: 0.04, outputPer1M: 0.14, ctx: '128K' },
  { id: 'mistral-small-3.2', name: 'Mistral Small 3.2', category: 'mid', provider: 'AntSeed', inputPer1M: 0.09, outputPer1M: 0.25, ctx: '64K' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.01, ctx: '128K' },
  { id: 'qwen3-8b', name: 'Qwen3 8B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.01, ctx: '32K' },
  { id: 'qwen3-coder-30b', name: 'Qwen3 Coder 30B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.02, ctx: '64K' },
  { id: 'gemma4-31b', name: 'Gemma 4 31B', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.02, ctx: '128K' },
  { id: 'minimax-m2.7', name: 'MiniMax M2.7', category: 'budget', provider: 'AntSeed', inputPer1M: 0.01, outputPer1M: 0.02, ctx: '64K' },
]

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'frontier', label: 'Frontier' },
  { key: 'premium', label: 'Premium' },
  { key: 'mid', label: 'Mid-Range' },
  { key: 'budget', label: 'Budget' },
]

const CATEGORY_STYLES: Record<Category, { active: string; inactive: string }> = {
  all: { active: 'bg-cyan-500 text-zinc-900', inactive: 'bg-zinc-900 text-zinc-400 border border-zinc-800' },
  frontier: { active: 'bg-purple-500 text-white', inactive: 'bg-violet-500/10 text-purple-400 border border-purple-500/30' },
  premium: { active: 'bg-violet-500 text-white', inactive: 'bg-violet-500/10 text-violet-400 border border-violet-500/30' },
  mid: { active: 'bg-cyan-500 text-zinc-900', inactive: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' },
  budget: { active: 'bg-emerald-500 text-white', inactive: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' },
}

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
      { threshold: 0.1 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${className} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function AccordionItem({ item, isOpen, onToggle }: { item: typeof FAQ_ITEMS[0]; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-zinc-800/50">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="font-medium text-white">{item.q}</span>
        <ChevronDown className={`h-5 w-5 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 pb-5' : 'max-h-0'}`}>
        <p className="text-sm text-zinc-500">{item.a}</p>
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
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">OpenAI-Compatible Pricing</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            AI API Pricing
          </h1>
          <p className="mt-4 text-lg text-zinc-500">
            Credit-based billing. No subscriptions. No minimums. Access 50+ models via unified API.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={100} className="mt-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-6 hover:border-cyan-500/30 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <CreditCard className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-white">USDC (Direct)</h3>
              <p className="mt-2 text-sm text-zinc-500">Send USDC on Base or Solana. 1:1 USD credits. Instant settlement.</p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                <Check className="h-3.5 w-3.5" />
                INSTANT
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-6 hover:border-amber-500/30 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <Coins className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-white">HoudiniSwap</h3>
              <p className="mt-2 text-sm text-zinc-500">Swap 100+ cryptocurrencies (BTC, XMR, SOL, DOGE) to USDC on Base.</p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-800/50 px-3 py-1 text-xs font-semibold text-zinc-400 border border-zinc-700/50">
                100+ COINS
              </div>
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-zinc-900/50 p-6 hover:border-cyan-500/40 transition-colors">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <Rocket className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-white">x402 Pay-Per-Request</h3>
              <p className="mt-2 text-sm text-zinc-500">Gasless payments on Solana/Base. Pay per API request with automatic fee deduction.</p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                <Zap className="h-3.5 w-3.5" />
                GASLESS
              </div>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={150} className="mt-6">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex items-start gap-3">
              <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
              <div>
                <h4 className="font-semibold text-cyan-300">x402 Protocol Integration</h4>
                <p className="mt-1 text-sm text-zinc-400">
                  Native x402 support enables developers to integrate AI payments directly into applications without managing credit balances. 
                  <Link href="/crypto-payments" className="ml-1 font-medium text-cyan-400 hover:underline">Learn more</Link>
                </p>
              </div>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={200} className="mt-12">
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/50">
            <div className="border-b border-zinc-800/50 p-6">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      category === cat.key
                        ? CATEGORY_STYLES[cat.key].active
                        : CATEGORY_STYLES[cat.key].inactive
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm text-zinc-500">{filtered.length} models</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-800/50 bg-zinc-900/30">
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Model</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Provider</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Input / 1M</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Output / 1M</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Context</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => (
                    <tr key={m.id} className={`border-b border-zinc-800/30 transition-colors hover:bg-zinc-800/20 ${i % 2 === 1 ? 'bg-zinc-900/20' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{m.name}</div>
                        <div className="text-xs text-zinc-600">{m.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          m.provider === 'Venice' ? 'bg-blue-500/20 text-blue-400' :
                          m.provider === 'AntSeed' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {m.provider}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm font-medium text-cyan-400">{fmtPrice(m.inputPer1M)}</td>
                      <td className="px-6 py-4 text-right font-mono text-sm font-medium text-zinc-300">{fmtPrice(m.outputPer1M)}</td>
                      <td className="px-6 py-4 text-right text-sm text-zinc-500">{m.ctx}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={300} className="mt-12">
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-cyan-500" />
              <h3 className="text-lg font-semibold text-white">Frequently Asked Questions</h3>
            </div>
            <div>
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem
                  key={i}
                  item={item}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={400} className="mt-12 text-center">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className="btn-primary text-lg px-8 py-4"
            >
              <Zap className="h-5 w-5 mr-2" />
              Start AI Inference
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
            <Link
              href="/deposit"
              className="btn-secondary text-lg px-8 py-4"
            >
              <Coins className="h-5 w-5 mr-2" />
              Deposit Crypto
            </Link>
            <Link href="/models" className="px-6 py-4 text-base font-medium text-zinc-500 hover:text-cyan-400 transition-colors">
              View All Models
              <ArrowRight className="w-4 h-4 ml-2 inline-block" />
            </Link>
          </div>
        </AnimatedSection>

        <TinyFishPricing />

        <AnimatedSection delay={500} className="mt-12">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h4 className="font-semibold text-amber-300">Credits & Billing</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="text-sm text-zinc-400">Credits are 1:1 USD, non-redeemable, non-transferable</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="text-sm text-zinc-400">12-month rolling expiry from date of deposit</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="text-sm text-zinc-400">No credit float -- credits appear after settlement</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="text-sm text-zinc-400">Billed per token, deducted in real-time</span>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  )
}