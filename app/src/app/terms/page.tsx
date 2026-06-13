/* Hallmark · P4 H5 E5 S5 R4 V4
 * macrostructure: field-manual (legal) · genre: atmospheric · theme: terminal
 * sections: masthead · subject · usage · acceptable-use · liability · credits · termination · contact
 * copy: stop-slop pass — active voice, no adverbs, no "not X, it's Y" contrasts, no em dashes,
 *       no invented metrics, no quote-bait. Every number is a real env/build fact or labelled "to confirm".
 * contrast: all body text ≥ 4.5:1 on var(--color-void)
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CircleAlert, CheckCircle2, CircleX, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms · OMA',
  description:
    'OMA API usage rules, acceptable use policy, credit mechanics, and account termination. Pay per request in USDC, no sales funnel.',
  openGraph: {
    title: 'Terms · OMA',
    description:
      'OMA API usage rules, acceptable use policy, credit mechanics, and account termination. Pay per request in USDC, no sales funnel.',
  },
}

const ISSUED = '2026-01-01'
const DOC_ID = '0x4F4D41-TERMS'
const BUILD = (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7)

const SECTIONS = [
  { idx: '02', id: 'usage', title: 'Usage', meta: 'api rules' },
  { idx: '03', id: 'acceptable-use', title: 'Acceptable use', meta: 'what is not allowed' },
  { idx: '04', id: 'liability', title: 'Liability', meta: 'no uptime warranty' },
  { idx: '05', id: 'credits', title: 'Credits', meta: 'non-redeemable · 12 mo' },
  { idx: '06', id: 'termination', title: 'Termination', meta: 'for cause' },
] as const

function StatusDot({ tone = 'accent' }: { tone?: 'accent' | 'warning' | 'error' }) {
  const color =
    tone === 'warning'
      ? 'var(--color-warning)'
      : tone === 'error'
        ? 'var(--color-error)'
        : 'var(--color-accent)'
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-1.5 w-1.5"
        style={{ backgroundColor: color }}
      />
    </span>
  )
}

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

function RulePoint({
  term,
  detail,
  tone = 'default',
}: {
  term?: string
  detail: string
  tone?: 'default' | 'warning' | 'error'
}) {
  const dot =
    tone === 'error'
      ? 'var(--color-error)'
      : tone === 'warning'
        ? 'var(--color-warning)'
        : 'var(--color-accent)'
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot }}
        aria-hidden="true"
      />
      <span className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
        {term && (
          <span className="font-semibold text-[var(--color-text-bright)]">{term}: </span>
        )}
        {detail}
      </span>
    </li>
  )
}

export default function TermsPage() {
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
                <span>terms</span>
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
            <div className="grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start">
              <div className="min-w-0">
                <SectionHeading index="01" title="Subject" meta="what you agree to" />

                <h1
                  id="subject-heading"
                  className="font-syne font-bold text-[var(--color-text-bright)] tracking-[-0.03em] leading-[0.95] text-[clamp(2.25rem,7.5vw,4.5rem)]"
                  style={{ overflowWrap: 'anywhere', minWidth: 0, textWrap: 'balance' }}
                >
                  <span className="block">Pay per call,</span>
                  <span className="block text-[var(--color-accent)]">no sales call.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-[15px] sm:text-base text-[var(--color-text)] leading-relaxed">
                  OMA gives you access to text generation, chat, embeddings,
                  images, audio, and video through an OpenAI-compatible API.
                  By using the service you agree to the rules in §§ 02-06.
                </p>

                <div className="mt-7 border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-4 sm:p-5 flex items-start gap-3">
                  <CircleAlert
                    className="h-5 w-5 shrink-0 text-[var(--color-warning)] mt-0.5"
                    aria-hidden="true"
                  />
                  <p className="text-[12.5px] sm:text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                    <span className="font-semibold text-[var(--color-warning)]">Important:</span>{' '}
                    By using OMA services you agree to these Terms. If you do
                    not agree, do not use the service.
                  </p>
                </div>
              </div>

              <aside
                aria-label="Document metadata"
                className="border border-[var(--color-border)] bg-[var(--color-surface)] min-w-0 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-60"
                />
                <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    Document
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)]">
                    <StatusDot />
                    <span className="sr-only">Status: </span>active
                  </span>
                </div>
                <dl className="text-[11px]">
                  {[
                    ['Issuer', 'OMA · operator-side'],
                    ['Issued', ISSUED],
                    ['Build', BUILD],
                    ['Form', 'API Terms of Service'],
                    ['Auth', 'Wallet · SIWE'],
                    ['Settlement', 'USDC · Base'],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <dt className="text-[var(--color-text-tertiary)] uppercase tracking-widest text-[10px]">
                        {k}
                      </dt>
                      <dd className="text-[var(--color-text-secondary)] tabular-nums truncate text-right">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="px-3 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)]">
                  contact · legal@oma-ai.com
                </div>
              </aside>
            </div>
          </section>

          {/* ===== § 02 USAGE ===== */}
          <section
            id="usage"
            aria-labelledby="usage-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="02" title="Usage" meta="api rules" />
            <h3 id="usage-heading" className="sr-only">
              API usage rules
            </h3>

            <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl mb-5">
              The OMA AI API gives you access to text generation, chat,
              embeddings, and image generation. By using the API you agree to:
            </p>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <ul className="space-y-3">
                <RulePoint term="Lawful" detail="Use the API only for lawful purposes." />
                <RulePoint term="Rate limits" detail="Do not exceed rate limits or abuse the service." />
                <RulePoint term="No resale" detail="Do not resell or redistribute API access without written permission." />
                <RulePoint term="Key custody" detail="Keep your API keys secure. You are responsible for everything that happens under your account." />
              </ul>
            </div>
          </section>

          {/* ===== § 03 ACCEPTABLE USE ===== */}
          <section
            id="acceptable-use"
            aria-labelledby="acceptable-use-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="03" title="Acceptable use" meta="what is not allowed" />
            <h3 id="acceptable-use-heading" className="sr-only">
              Acceptable use policy
            </h3>

            <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl mb-5">
              Do not use OMA AI services for any of the following:
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <CircleX className="h-4 w-4 text-[var(--color-error)]" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-tertiary)]">
                    Prohibited content
                  </span>
                </div>
                <ul className="space-y-3">
                  <RulePoint detail="Anything illegal, harmful, or malicious." tone="error" />
                  <RulePoint detail="Generating offensive or defamatory content." tone="error" />
                  <RulePoint detail="Automated spam or mass text generation." tone="error" />
                  <RulePoint detail="Training competing AI models without permission." tone="error" />
                  <RulePoint detail="Probing or attacking our infrastructure." tone="error" />
                </ul>
              </div>
              <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-tertiary)]">
                    What you can build
                  </span>
                </div>
                <ul className="space-y-3">
                  <RulePoint detail="Production applications and APIs that call OMA." />
                  <RulePoint detail="Internal tools, batch jobs, and CI workloads." />
                  <RulePoint detail="Products that surface model output to end users." />
                  <RulePoint detail="Research and evaluation against your own benchmarks." />
                  <RulePoint detail="Workflows that chain models with your own code." />
                </ul>
              </div>
            </div>
          </section>

          {/* ===== § 04 LIABILITY ===== */}
          <section
            id="liability"
            aria-labelledby="liability-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="04" title="Liability" meta="no uptime warranty" />
            <h3 id="liability-heading" className="sr-only">
              Limitations of liability
            </h3>

            <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl mb-5">
              OMA AI provides services &quot;AS IS&quot;. We do not guarantee:
            </p>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <ul className="space-y-3">
                <RulePoint term="Uptime" detail="Continuous availability of the API or any specific model." tone="warning" />
                <RulePoint term="Accuracy" detail="Fitness or correctness of model output for any particular use." tone="warning" />
                <RulePoint term="Errors" detail="Error-free operation or absence of defects." tone="warning" />
              </ul>
              <p className="mt-5 text-[12.5px] sm:text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                OMA is not liable for any indirect, incidental, special, or
                consequential damages from using the service, including lost
                profits, data, or any other loss, even if OMA was advised of
                the possibility of such damages.
              </p>
            </div>
          </section>

          {/* ===== § 05 CREDITS ===== */}
          <section
            id="credits"
            aria-labelledby="credits-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="05" title="Credits" meta="non-redeemable · 12 mo" />
            <h3 id="credits-heading" className="sr-only">
              Credit system
            </h3>

            <ul className="border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
              {[
                ['Non-redeemable', 'Credits are not redeemable for cash and are non-transferable; they expire after 12 months.'],
                ['Per-token deduction', 'Credits are consumed per token processed and are deducted in real time at settlement.'],
                ['OMA token bonus', 'OMA token deposits include a 5% bonus subject to circuit-breaker conditions.'],
                ['Staking discounts', 'Staking discounts apply to inference costs only and cannot exceed 20% combined.'],
              ].map(([title, body], i) => (
                <li
                  key={title}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)] sm:grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3 px-3 sm:px-4 py-3"
                >
                  <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13px] sm:text-sm text-[var(--color-text-bright)]">
                    {title}
                  </span>
                  <span className="hidden sm:inline text-[11px] sm:text-xs text-[var(--color-text-muted)]">
                    {body}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ===== § 06 TERMINATION ===== */}
          <section
            id="termination"
            aria-labelledby="termination-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="06" title="Termination" meta="for cause" />
            <h3 id="termination-heading" className="sr-only">
              Account termination
            </h3>

            <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl mb-5">
              OMA may suspend or terminate accounts that violate these Terms,
              abuse the service, or pose a risk to our infrastructure or
              other users. When that happens:
            </p>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <CircleX className="h-4 w-4 text-[var(--color-error)]" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-tertiary)]">
                    What happens
                  </span>
                </div>
                <ul className="space-y-3">
                  <RulePoint detail="All remaining credits are forfeited." tone="error" />
                  <RulePoint detail="API keys are revoked immediately." tone="error" />
                  <RulePoint detail="Staked OMA is returned after the standard cooldown period." tone="error" />
                </ul>
              </div>
              <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-tertiary)]">
                    You can also leave
                  </span>
                </div>
                <ul className="space-y-3">
                  <RulePoint detail="Delete your account at any time from the dashboard." />
                  <RulePoint detail="Outstanding usage is settled before deletion." />
                  <RulePoint detail="On-chain deposits and withdrawals are not reversible." />
                </ul>
              </div>
            </div>
          </section>

          {/* ===== CONTACT ===== */}
          <section
            aria-label="Contact"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] sm:text-xs text-[var(--color-text-muted)]">
                Questions about these Terms?{' '}
                <a
                  href="mailto:legal@oma-ai.com"
                  className="font-medium text-[var(--color-accent)] underline decoration-2 underline-offset-2 hover:no-underline"
                >
                  legal@oma-ai.com
                </a>
                , or reach us via{' '}
                <Link
                  href="/about"
                  className="font-medium text-[var(--color-accent)] underline decoration-2 underline-offset-2 hover:no-underline"
                >
                  our docs
                </Link>
                .
              </p>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] sm:text-xs">
                {[
                  { href: '/privacy', label: 'Privacy' },
                  { href: '/about', label: 'About' },
                  { href: '/pricing', label: 'Pricing' },
                  { href: '/docs', label: 'API docs' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Hidden TOC for crawlers & a11y */}
          <nav aria-label="Section index" className="sr-only">
            <ol>
              <li>
                <a href="#subject">§ 01 Subject</a>
              </li>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>§ {s.idx} {s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </div>
  )
}
