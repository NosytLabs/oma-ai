import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Coins, Layers, Shield, type LucideIcon } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Compare · OMA',
  description:
    'See how OMA compares to CheapTokens, OpenRouter, and Venice AI. Permissionless AI inference, pay per request in USDC, no account required.',
  openGraph: {
    title: 'Compare · OMA',
    description:
      'See how OMA compares to CheapTokens, OpenRouter, and Venice AI. Permissionless AI inference, pay per request in USDC, no account required.',
  },
}

const COMPARISONS: ReadonlyArray<{
  href: string
  badge: string
  title: string
  desc: string
  icon: LucideIcon
  highlight: string
}> = [
  {
    href: '/compare/cheaptokens-alternative',
    badge: 'Save money',
    icon: Coins,
    title: 'OMA vs CheapTokens',
    desc: 'Transparent Venice pricing, a working credit system, and crypto-native deposits without the procurement overhead of a reseller.',
    highlight: 'Lower friction',
  },
  {
    href: '/compare/openrouter-alternative',
    badge: 'Stay private',
    icon: Shield,
    title: 'OMA vs OpenRouter',
    desc: 'One OpenAI-compatible endpoint, wallet-only auth, and minimal data retention. The routing stack without the account requirement.',
    highlight: 'No account needed',
  },
  {
    href: '/compare/venice-ai-alternative',
    badge: 'Add a layer',
    icon: Layers,
    title: 'OMA vs Venice AI',
    desc: 'A thin gateway on top of Venice that adds credit metering, smart routing, automatic failover, and a developer dashboard.',
    highlight: 'Same models, easier billing',
  },
]

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
      <div className="overflow-x-clip">
        <div className="flex flex-col">

          {/* ===== HERO ===== */}
          <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-12 sm:pb-16">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                Side-by-side comparisons
              </span>

              <h1
                className="h1-hero text-text-bright mt-6"
                style={{ overflowWrap: 'anywhere', minWidth: 0, textWrap: 'balance' }}
              >
                <span className="block">How OMA</span>
                <span className="block text-accent">stacks up.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed" style={{ textWrap: 'pretty' }}>
                OMA is a thin inference gateway. One OpenAI-compatible endpoint,
                one price list, USDC on Base, wallet-only auth. See how it
                compares to the platforms it most often replaces in a stack.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/dashboard" className="bg-accent text-void hover:bg-accent-hover px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  <span aria-hidden="true" className="text-text-inverse">›</span>
                  Start in 30 seconds
                </Link>
                <Link href="/pricing" className="bg-surface text-text border border-border hover:bg-surface-elevated px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  See pricing
                </Link>
              </div>
            </div>
          </section>

          {/* ===== QUICK COMPARISON ===== */}
          <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
              {[
                { label: 'Auth', value: 'Wallet only', note: 'No email, no password' },
                { label: 'Billing', value: 'Pay per request', note: 'USDC on Base' },
                { label: 'Setup', value: '30 seconds', note: 'Connect a wallet, get a key' },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-surface p-5">
                  <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">
                    {c.label}
                  </p>
                  <p className="mt-2 font-display text-lg font-semibold text-text-bright">
                    {c.value}
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-muted">
                    {c.note}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ===== COMPARISONS ===== */}
          <section className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
            <header className="mb-8 sm:mb-10 max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
                Pick your comparison
              </h2>
              <p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
                Each page covers pricing, auth, data handling, and the things
                developers ask about before switching.
              </p>
            </header>

            <ul className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
              {COMPARISONS.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.href} className="min-w-0">
                    <Link
                      href={item.href}
                      className="group relative block h-full overflow-hidden rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent/40"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                      />
                      <div className="relative flex h-full flex-col">
                        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/5">
                          <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                        </div>

                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] font-medium text-text-muted">
                          {item.badge}
                        </span>

                        <h3 className="mt-3 mb-2 font-display text-lg sm:text-xl font-semibold text-text-bright">
                          {item.title}
                        </h3>

                        <p className="text-[13px] sm:text-sm leading-relaxed text-text-secondary">
                          {item.desc}
                        </p>

                        <p className="mt-3 text-[12px] text-accent">
                          {item.highlight}
                        </p>

                        <div className="mt-auto pt-5 flex items-center gap-1.5 text-[12.5px] font-medium text-accent">
                          <span>Read the comparison</span>
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* ===== WHY PEOPLE SWITCH ===== */}
          <section className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
                  Why people switch to OMA
                </h2>
                <p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed max-w-md">
                  The same three reasons come up over and over. If any of them
                  matches what you are wrestling with, the comparison pages go
                  deeper.
                </p>
              </div>

              <ul className="space-y-4 list-none p-0">
                {[
                  {
                    title: 'No account, no friction',
                    body: 'Connect a wallet, get a key, start calling. No email verification, no KYC, no sales funnel.',
                  },
                  {
                    title: 'Pay per request in USDC',
                    body: 'Deposit USDC on Base, get credits 1:1, and pay only for the tokens you use. No subscriptions, no minimums.',
                  },
                  {
                    title: 'Privacy by default',
                    body: 'Prompts and completions stream in memory and are never logged. Only a per-call counter is recorded for billing.',
                  },
                ].map((item) => (
                  <li
                    key={item.title}
                    className="rounded-xl border border-border bg-surface p-5"
                  >
                    <h3 className="font-display text-[15px] sm:text-base font-semibold text-text-bright">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] sm:text-sm leading-relaxed text-text-secondary">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ===== CTA ===== */}
          <section className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
            <div className="rounded-2xl border border-accent/30 bg-accent-dim px-6 sm:px-10 py-10 sm:py-14 relative overflow-hidden">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
              />
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright max-w-2xl">
                Ready to try OMA?
              </h2>
              <p className="mt-3 text-[14px] sm:text-base text-text-secondary max-w-2xl leading-relaxed">
                Connect a wallet, deposit some USDC, and make your first call
                in under a minute. The OpenAI-compatible endpoint means your
                existing code works with a one-line base URL change.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/dashboard" className="bg-accent text-void hover:bg-accent-hover px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  <span aria-hidden="true" className="text-text-inverse">›</span>
                  Start building
                </Link>
                <Link href="/pricing" className="bg-surface text-text border border-border hover:bg-surface-elevated px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  See pricing
                </Link>
              </div>
            </div>
          </section>

          {/* ===== FOOTER LINKS ===== */}
          <section
            aria-label="Related pages"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10"
          >
            <div className="flex flex-wrap justify-center gap-4 text-[13px] text-text-muted">
              <Link href="/pricing" className="hover:text-accent transition-colors">
                Pricing
              </Link>
              <span className="text-border" aria-hidden="true">·</span>
              <Link href="/private-ai-api" className="hover:text-accent transition-colors">
                Private AI API
              </Link>
              <span className="text-border" aria-hidden="true">·</span>
              <Link href="/crypto-payments" className="hover:text-accent transition-colors">
                Crypto payments
              </Link>
              <span className="text-border" aria-hidden="true">·</span>
              <Link href="/docs" className="hover:text-accent transition-colors">
                Docs
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
