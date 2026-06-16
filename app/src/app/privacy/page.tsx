/* OMA · Privacy page
 * conversational legal layout · sections: hero · summary · collection · auth · logs · retention · third parties · rights · contact
 * copy: plain English summary at the top, active voice
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Shield, Eye, Database, Lock, CreditCard, CheckCircle2, CircleAlert, CircleX } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy · OMA',
  description:
    'OMA collects the minimum data needed to operate the service. Wallet address, API usage, and on-chain deposit hashes. No prompt or completion logging, ever.',
  openGraph: {
    title: 'Privacy · OMA',
    description:
      'OMA collects the minimum data needed to operate the service. Wallet address, API usage, and on-chain deposit hashes. No prompt or completion logging, ever.',
  },
}

const ISSUED = '2026-01-01'

const SECTIONS = [
  { idx: '02', id: 'collection', title: 'Collection', meta: 'what we keep' },
  { idx: '03', id: 'auth', title: 'Authentication', meta: 'wallet only' },
  { idx: '04', id: 'logs', title: 'Logs and billing', meta: 'metering records' },
  { idx: '05', id: 'retention', title: 'Retention', meta: 'how long' },
  { idx: '06', id: 'third-parties', title: 'Third parties', meta: 'who sees what' },
  { idx: '07', id: 'rights', title: 'Your rights', meta: 'what you control' },
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
  index?: string
  title: string
  meta?: string
}) {
  return (
    <header className="mb-5 sm:mb-7">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-bright">
        {index && (
          <span className="text-accent mr-2 tabular-nums">{index}</span>
        )}
        {title}
      </h2>
      {meta && (
        <p className="mt-1.5 text-[13px] sm:text-[14px] text-text-muted">
          {meta}
        </p>
      )}
    </header>
  )
}

function DataPoint({
  term,
  detail,
  tone = 'default',
}: {
  term: string
  detail: string
  tone?: 'default' | 'warning'
}) {
  const dot = tone === 'warning' ? 'var(--color-warning)' : 'var(--color-accent)'
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot }}
        aria-hidden="true"
      />
      <span className="text-[13px] text-text-secondary leading-relaxed">
        <span className="font-semibold text-text-bright">{term}:</span> {detail}
      </span>
    </li>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
      <div className="overflow-x-clip">
        <div className="flex flex-col">

          {/* ===== HERO ===== */}
          <section
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-10 sm:pb-14"
          >
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to home
            </Link>

            <div className="grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  Privacy policy
                </span>

                <h1
                  className="h1-hero text-text-bright mt-6"
                  style={{ overflowWrap: 'anywhere', minWidth: 0, textWrap: 'balance' }}
                >
                  <span className="block">Minimal data,</span>
                  <span className="block text-accent">no prompt logging.</span>
                </h1>

                {/* Plain English summary */}
                <div className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-5 sm:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-2">
                    The short version
                  </p>
                  <p className="text-[14px] sm:text-[15px] text-text-bright leading-relaxed">
                    OMA collects the minimum data needed to run the service:
                    your wallet address, a salted hash of any API keys, a
                    per-call usage counter, and the on-chain hash of your
                    deposits.
                  </p>
                  <p className="mt-3 text-[13.5px] sm:text-[14px] text-text-secondary leading-relaxed">
                    We do not track, store, or sell personal information.
                    Inference requests are processed in memory and never
                    persisted. You can export or delete everything we have on
                    you from the dashboard.
                  </p>
                </div>
              </div>

              <aside
                aria-label="At a glance"
                className="border border-border bg-surface min-w-0 relative overflow-hidden rounded-xl"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60"
                />
                <div className="px-4 py-2.5 border-b border-border bg-panel flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-text-bright">
                    At a glance
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-accent">
                    <StatusDot />
                    <span className="sr-only">Status: </span>active
                  </span>
                </div>
                <dl className="text-[12px]">
                  {[
                    ['Scope', 'All OMA surfaces'],
                    ['Logging', 'Metadata only'],
                    ['Sale of data', 'Never'],
                    ['Effective', ISSUED],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="grid grid-cols-2 gap-2 px-4 py-2 border-b border-border last:border-b-0"
                    >
                      <dt className="text-text-muted text-[11.5px]">
                        {k}
                      </dt>
                      <dd className="text-text-secondary tabular-nums truncate text-right">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="px-4 py-2.5 border-t border-border text-[11px] text-text-tertiary">
                  Questions? <a href="mailto:privacy@oma-ai.com" className="text-accent hover:underline underline-offset-2">privacy@oma-ai.com</a>
                </div>
              </aside>
            </div>
          </section>

          {/* ===== COLLECTION ===== */}
          <section
            id="collection"
            aria-labelledby="collection-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="What we collect" meta="The data we keep and the data we never touch" />
            <h3 id="collection-heading" className="sr-only">
              Data we collect
            </h3>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="border border-border bg-surface p-5 rounded-xl">
                <div className="mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h3 className="text-[13px] font-semibold text-text-bright">
                    What we store
                  </h3>
                </div>
                <ul className="space-y-3">
                  <DataPoint term="Wallet address" detail="Used for authentication via SIWE (EVM) or Solana signatures." />
                  <DataPoint term="API usage" detail="Token counts and timestamps for billing." />
                  <DataPoint term="Transaction hashes" detail="For on-chain deposit verification." />
                  <DataPoint term="API keys" detail="Hashed for authentication, prefixed for identification." />
                </ul>
              </div>
              <div className="border border-border bg-surface p-5 rounded-xl">
                <div className="mb-3 flex items-center gap-2">
                  <CircleX className="h-4 w-4 text-error" aria-hidden="true" />
                  <h3 className="text-[13px] font-semibold text-text-bright">
                    What we never store
                  </h3>
                </div>
                <ul className="space-y-3">
                  <DataPoint term="Prompt text" detail="Inference runs in memory; content is not persisted." tone="warning" />
                  <DataPoint term="Completion text" detail="Model output is streamed to you and discarded." tone="warning" />
                  <DataPoint term="Wallet activity" detail="We do not read balances, NFTs, or transaction history." tone="warning" />
                  <DataPoint term="Personal profile" detail="No name, email, or contact info is required." tone="warning" />
                </ul>
              </div>
            </div>
          </section>

          {/* ===== AUTHENTICATION ===== */}
          <section
            id="auth"
            aria-labelledby="auth-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="Authentication" meta="Wallet-only sign-in" />
            <h3 id="auth-heading" className="sr-only">
              Wallet authentication
            </h3>

            <p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
              Sign-In With Ethereum (SIWE) or Solana signatures authenticate every
              request. Your wallet address is used to:
            </p>

            <div className="border border-border bg-surface p-5">
              <ul className="space-y-3">
                <DataPoint term="Session token" detail="Issue a short-lived JWT bound to your wallet." />
                <DataPoint term="Usage attribution" detail="Associate token spend with your account for billing." />
                <DataPoint term="Credit deposit" detail="Link incoming transfers to your credit balance." />
              </ul>
              <p className="mt-5 text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
                Your wallet address is stored, but OMA does not track wallet
                activity. We cannot see your token balances, NFTs, or
                transaction history on-chain.
              </p>
            </div>
          </section>

          {/* ===== LOGS AND BILLING ===== */}
          <section
            id="logs"
            aria-labelledby="logs-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="Logs and billing" meta="What we meter, what we never see" />
            <h3 id="logs-heading" className="sr-only">
              API logs and billing
            </h3>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="border border-border bg-surface p-5 rounded-xl">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h3 className="text-[13px] font-semibold text-text-bright">
                    For billing
                  </h3>
                </div>
                <ul className="space-y-3">
                  <DataPoint term="Model id" detail='e.g. "claude-sonnet-4"' />
                  <DataPoint term="Token counts" detail="Prompt and completion tokens per request." />
                  <DataPoint term="Cost in cents" detail="Computed at settlement time." />
                  <DataPoint term="Request timestamp" detail="UTC, to the second." />
                </ul>
              </div>
              <div className="border border-border bg-surface p-5 rounded-xl">
                <div className="mb-3 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-error" aria-hidden="true" />
                  <h3 className="text-[13px] font-semibold text-text-bright">
                    We do not log
                  </h3>
                </div>
                <ul className="space-y-3">
                  <DataPoint term="Prompt text" detail="The body of your request is never stored." tone="warning" />
                  <DataPoint term="Completion text" detail="The model's response is never stored." tone="warning" />
                  <DataPoint term="Tool payloads" detail="Function-call arguments and outputs are not retained." tone="warning" />
                  <DataPoint term="File contents" detail="Uploaded files are processed transiently and dropped." tone="warning" />
                </ul>
              </div>
            </div>
          </section>

          {/* ===== RETENTION ===== */}
          <section
            id="retention"
            aria-labelledby="retention-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="Retention" meta="How long we keep things" />
            <h3 id="retention-heading" className="sr-only">
              Data retention windows
            </h3>

            <ul className="border border-border bg-surface divide-y divide-border">
              {[
                ['API logs', '90 days', 'for usage reporting'],
                ['Account data', 'until deletion', 'wallet address and profile'],
                ['Credits', '12 months', 'non-redeemable, rolling expiry'],
                ['API keys', 'on revoke', 'deletion revokes immediately'],
              ].map(([k, v, note]) => (
                <li
                  key={k}
                  className="grid grid-cols-[minmax(0,1fr)_8rem] sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] items-center gap-3 px-3 sm:px-4 py-3"
                >
                  <span className="text-[13px] sm:text-sm text-text-bright">
                    {k}
                  </span>
                  <span className="text-[11px] sm:text-xs text-warning tabular-nums">
                    {v}
                  </span>
                  <span className="hidden sm:inline text-[11px] sm:text-xs text-text-muted">
                    {note}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ===== THIRD PARTIES ===== */}
          <section
            id="third-parties"
            aria-labelledby="third-parties-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="Third parties" meta="Who sees what" />
            <h3 id="third-parties-heading" className="sr-only">
              Third-party data sharing
            </h3>

            <p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
              OMA shares the minimum metadata needed to route inference, swap
              tokens, and verify deposits. No party receives prompt or
              completion content.
            </p>

            <ul className="border border-border bg-surface divide-y divide-border">
              {[
                ['Venice AI', 'Inference', 'routes model calls; content not logged'],
                ['AntSeed', 'P2P routing', 'peer-to-peer failover; no content logging'],
                ['Houdini Swap', 'Token swap', 'operates independently; swap metadata only'],
                ['Base', 'Settlement', 'on-chain transaction verification'],
              ].map(([name, role, note]) => (
                <li
                  key={name}
                  className="grid grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] items-center gap-3 px-3 sm:px-4 py-3"
                >
                  <span className="text-[13px] sm:text-sm text-text-bright">
                    {name}
                  </span>
                  <span className="text-[12.5px] text-text-muted">
                    {role}
                  </span>
                  <span className="hidden sm:inline text-[11px] sm:text-xs text-text-muted">
                    {note}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-text-muted">
              <span className="text-accent" aria-hidden="true">
                ~
              </span>{' '}
              We do not sell, rent, or share any personal data with advertisers
              or analytics services.
            </p>
          </section>

          {/* ===== YOUR RIGHTS ===== */}
          <section
            id="rights"
            aria-labelledby="rights-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="Your rights" meta="What you control" />
            <h3 id="rights-heading" className="sr-only">
              Your rights
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: CircleAlert,
                  title: 'Request deletion',
                  body: 'Ask us to remove your account data. API keys revoke immediately; usage logs age out per the Retention section above.',
                },
                {
                  icon: Shield,
                  title: 'Revoke API keys',
                  body: 'Disable any key from the dashboard at any time. Revocation is immediate and final.',
                },
                {
                  icon: Eye,
                  title: 'Export your data',
                  body: 'Download deposits, withdrawals, and usage as CSV or JSON from the dashboard.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Contact us',
                  body: 'Email privacy@oma-ai.com for any privacy concern. We reply within five business days.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="group border border-border bg-surface p-5 hover:border-accent/40 transition-colors"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <card.icon
                      className="h-4 w-4 text-accent shrink-0"
                      aria-hidden="true"
                    />
                    <h3 className="font-display text-[15px] font-semibold text-text-bright">
                      {card.title}
                    </h3>
                  </div>
                  <p className="text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ===== FOOTER NAV ===== */}
          <section
            aria-label="Related documents"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] sm:text-xs text-text-muted">
                Questions?{' '}
                <a
                  href="mailto:privacy@oma-ai.com"
                  className="text-accent hover:underline underline-offset-2"
                >
                  privacy@oma-ai.com
                </a>
              </p>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] sm:text-xs">
                {[
                  { href: '/terms', label: 'Terms' },
                  { href: '/about', label: 'About' },
                  { href: '/pricing', label: 'Pricing' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-text-muted hover:text-accent transition-colors"
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
                <a href="#subject">Summary</a>
              </li>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </div>
  )
}
