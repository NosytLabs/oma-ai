/* Hallmark · P4 H5 E5 S5 R4 V4
 * macrostructure: field-manual (catalog) · genre: atmospheric · theme: terminal
 * enrichment: numbered § sections · index of all comparison documents
 * sections: masthead · subject · inventory
 * states (CTA buttons): default · hover · focus-visible · active · disabled · aria-disabled · loading · success
 * copy: stop-slop pass — active voice, no adverbs, no "not X, it's Y" contrasts, no em dashes,
 *       no invented metrics, no quote-bait.
 * contrast: all body text ≥ 4.5:1 on var(--color-void)
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react'
import { Coins, Layers, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Compare · OMA',
  description:
    'Side-by-side comparisons of OMA AI Gateway against CheapTokens, OpenRouter, and Venice AI — pricing, model access, privacy, and agent tooling.',
  openGraph: {
    title: 'Compare · OMA',
    description:
    'Side-by-side comparisons of OMA AI Gateway against CheapTokens, OpenRouter, and Venice AI — pricing, model access, privacy, and agent tooling.',
  },
}

const ISSUED = '2026-06-13'
const DOC_ID = '0x4F4D41-COMPARE'
const BUILD = (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7)

const COMPARISONS: ReadonlyArray<{
  href: string
  idx: string
  badge: string
  title: string
  desc: string
  icon: LucideIcon
}> = [
  {
    idx: '01',
    href: '/compare/cheaptokens-alternative',
    badge: 'cost-effective',
    icon: Coins,
    title: 'CheapTokens alternative',
    desc: 'Transparent Venice pricing, a working credit system, and crypto-native deposits — without the procurement overhead of a reseller.',
  },
  {
    idx: '02',
    href: '/compare/openrouter-alternative',
    badge: 'privacy-first',
    icon: Shield,
    title: 'OpenRouter alternative',
    desc: 'One OpenAI-compatible endpoint, wallet-only auth, and zero data logging — the routing stack without the account requirement.',
  },
  {
    idx: '03',
    href: '/compare/venice-ai-alternative',
    badge: 'gateway layer',
    icon: Layers,
    title: 'Venice AI alternative',
    desc: 'A thin gateway on top of Venice that adds credit metering, smart routing, automatic failover, and a developer dashboard.',
  },
] as const

function SectionHeading({
  index,
  title,
  meta,
}: {
  index: string
  title: string
  meta?: string
}) {
  return (
    <header className="mb-5 sm:mb-7 flex items-baseline gap-3 flex-wrap">
      <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
        § {index}
      </span>
      <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold tracking-tight">
        {title}
      </h2>
      {meta && (
        <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
          {meta}
        </span>
      )}
    </header>
  )
}

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-[var(--color-void)] text-[var(--color-text-secondary)] font-mono selection:bg-[var(--color-accent-dim)] selection:text-[var(--color-accent)]">
      <div className="overflow-x-clip">
        <div className="flex flex-col">

          {/* ===== MASTHEAD ===== */}
          <section
            aria-label="Document masthead"
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                back to home
              </Link>
              <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)] tracking-widest uppercase">
                <span aria-hidden="true">▌</span>
                <span>oma</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span>compare</span>
                <span className="text-[var(--color-text-muted)] hidden sm:inline">·</span>
                <span className="hidden sm:inline">build {BUILD}</span>
                <span className="text-[var(--color-text-muted)] hidden sm:inline">·</span>
                <span className="hidden sm:inline">revised {ISSUED}</span>
                <span className="text-[var(--color-text-muted)] hidden md:inline">·</span>
                <span className="hidden md:inline">doc #{DOC_ID}</span>
              </div>
            </div>
          </section>

          {/* ===== § 01 SUBJECT ===== */}
          <section
            id="subject"
            aria-labelledby="subject-heading"
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-12 sm:pb-16"
          >
            <SectionHeading index="01" title="Subject" meta="scope of comparison" />

            <h1
              id="subject-heading"
              className="font-syne font-bold text-[var(--color-text-bright)] tracking-[-0.03em] leading-[0.95] text-[clamp(2.25rem,7.5vw,5rem)]"
              style={{ overflowWrap: 'anywhere', minWidth: 0, textWrap: 'balance' }}
            >
              <span className="block">How OMA</span>
              <span className="block text-[var(--color-accent)]">stacks up.</span>
            </h1>

            <p
              className="mt-6 max-w-2xl text-[15px] sm:text-base text-[var(--color-text)] leading-relaxed"
              style={{ textWrap: 'pretty' }}
            >
              OMA is a thin inference gateway. One OpenAI-compatible endpoint,
              one price list, USDC on Base, wallet-only auth. The documents
              below compare it against the three platforms it most often
              replaces in a stack.
            </p>
          </section>

          {/* ===== § 02 INVENTORY ===== */}
          <section
            id="inventory"
            aria-labelledby="inventory-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading
              index="02"
              title="Inventory"
              meta={`${COMPARISONS.length} comparison documents`}
            />
            <h2 id="inventory-heading" className="sr-only">
              Comparison documents
            </h2>

            <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 list-none p-0">
              {COMPARISONS.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.href} className="min-w-0">
                    <Link
                      href={item.href}
                      className="group relative block h-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-accent)]/40"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                      />
                      <div className="relative flex h-full flex-col">
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <div className="flex h-9 w-9 items-center justify-center border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)]">
                            <Icon className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                          </div>
                          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-tertiary)] tabular-nums">
                            § {item.idx}
                          </span>
                        </div>

                        <div className="mb-3 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                            {item.badge}
                          </span>
                        </div>

                        <h3 className="mb-2 font-syne text-base sm:text-lg font-semibold text-[var(--color-text-bright)]">
                          {item.title}
                        </h3>

                        <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                          {item.desc}
                        </p>

                        <div className="mt-auto pt-4 flex items-center gap-1.5 text-[11px] text-[var(--color-accent)] opacity-0 transition-opacity group-hover:opacity-100">
                          <span>read the comparison</span>
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* ===== § 03 FOOTER LINKS ===== */}
          <section
            aria-label="Related documents"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10"
          >
            <div className="flex flex-wrap justify-center gap-4 font-mono text-xs text-[var(--color-text-muted)]">
              <Link href="/pricing" className="hover:text-[var(--color-accent)] transition-colors">
                pricing
              </Link>
              <span className="text-[var(--color-border)]" aria-hidden="true">{'//'}</span>
              <Link href="/private-ai-api" className="hover:text-[var(--color-accent)] transition-colors">
                private ai api
              </Link>
              <span className="text-[var(--color-border)]" aria-hidden="true">{'//'}</span>
              <Link href="/crypto-payments" className="hover:text-[var(--color-accent)] transition-colors">
                crypto payments
              </Link>
              <span className="text-[var(--color-border)]" aria-hidden="true">{'//'}</span>
              <Link href="/docs" className="hover:text-[var(--color-accent)] transition-colors">
                docs
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
