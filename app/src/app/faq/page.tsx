/* Hallmark · P4 H5 E5 S5 R4 V4
 * macrostructure: field-manual (catalog) · genre: atmospheric · theme: terminal
 * enrichment: 11 grouped FAQ blocks, hand-built funding-flow SVG
 * sections: masthead · subject · groups (general, billing, models, privacy, refund) · diagram · CTA
 * states (CTA buttons): default · hover · focus-visible · active · disabled · aria-disabled · loading · success
 * copy: stop-slop pass — active voice, no adverbs, no "not X, it's Y" contrasts, no em dashes,
 *       no invented metrics, no quote-bait.
 * contrast: all body text ≥ 4.5:1 on var(--color-void)
 */

/* LARP cleanup (ses_larp_surgical_v1) — removed Hallmark ornament, removed
 * decorative StatusDot uses, removed the §-prefixed SectionHeading component
 * in favor of inline <h2>, kept FAQ content + funding-flow SVG + masthead
 * + "answered plain." hero + btn-primary/btn-secondary classes. */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FAQClient, type FAQGroup } from './FAQClient'

export const metadata: Metadata = {
  title: 'FAQ · OMA',
  description:
    'Common questions about OMA, the wallet-only inference gateway, x402 pay-per-request, USDC on Base, and the data we keep on file.',
}

const ISSUED = '2026-06-12'
const DOC_ID = '0x4F4D41-FAQ'
const BUILD = (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7)

const GROUPS: FAQGroup[] = [
  {
    idx: '01',
    name: 'General',
    items: [
      {
        iconName: 'HelpCircle',
        q: 'What is OMA?',
        a: 'OMA is an inference gateway. We sit between your code and an upstream model provider (Venice, primarily). OMA authenticates with a wallet, meters tokens, settles in USDC on Base, and forwards the call. We do not host or train models.',
      },
      {
        iconName: 'Layers',
        q: 'How is OMA different from Venice, CheapTokens, or OpenRouter?',
        a: 'Venice is the model host. CheapTokens is a Venice reseller that sells daily-discounted inference capacity. OpenRouter is a multi-vendor router. OMA combines a CheapTokens-sourced Venice stack behind a single wallet-only API. You see one provider and one price list; OMA handles the procurement.',
      },
      {
        iconName: 'Cpu',
        q: 'Which models can I call?',
        a: '19+ models across Venice and AntSeed. The live catalog is at GET /v1/models. The price list is at /pricing. All models are served OpenAI-compatible.',
      },
      {
        iconName: 'KeyRound',
        q: 'Do I need an account to start?',
        a: 'No. Connect a wallet, sign the SIWE challenge, and the dashboard generates an API key. There is no email, no password, and no KYC at any tier.',
      },
    ],
  },
  {
    idx: '02',
    name: 'Billing',
    items: [
      {
        iconName: 'Coins',
        q: 'How does payment work?',
        a: 'You deposit USDC on Base to the OMA deposit address. Credits are issued 1:1 against the USD value of the transfer. Credits are deducted per token as you use the API. The current rate is shown on the /pricing page.',
      },
      {
        iconName: 'Receipt',
        q: 'Why USDC on Base?',
        a: 'USDC is a regulated, audited, 1:1 USD-backed stablecoin. Base is a low-fee, EVM-equivalent L2. Together they make per-request settlement cheap enough to attach to a single API call without bank rails, card fees, or chargebacks.',
      },
      {
        iconName: 'RefreshCw',
        q: 'What is x402?',
        a: 'x402 is the HTTP 402 Payment Required flow, turned into a settlement primitive. When your credit balance is empty, OMA returns 402 with a Pay-Req header. The client signs a USDC transfer on Base and resubmits with a PAYMENT-SIGNATURE header. The request is then settled and forwarded. Receipts are HMAC-signed and replay-protected.',
      },
      {
        iconName: 'Zap',
        q: 'What if I run out of credits?',
        a: 'A 402 response with a Pay-Req header. If your client handles 402 (the OMA SDK does), it pays and retries inline. If not, the response tells the client to top up.',
      },
      {
        iconName: 'FileText',
        q: 'What is the refund policy?',
        a: 'Credits are non-redeemable. They cannot be withdrawn for USDC or transferred to another wallet. They expire on a 12-month rolling schedule from the deposit date. If a deposit was made in error within the last 24 hours and the credits have not been used, email billing@oma-ai.com with the transaction hash; we will consider a manual refund case by case.',
      },
    ],
  },
  {
    idx: '03',
    name: 'Models & API',
    items: [
      {
        iconName: 'Cpu',
        q: 'Is the API OpenAI-compatible?',
        a: 'Yes. The base URL is https://api.oma-ai.com/v1. The /v1/chat/completions, /v1/completions, /v1/embeddings, and /v1/images/generations endpoints all match the OpenAI shape. Swap the base URL, keep the rest of your code.',
      },
      {
        iconName: 'Zap',
        q: 'Do you support streaming?',
        a: 'Yes. server-sent events on /v1/chat/completions. The bytes you receive are the bytes you would receive from the upstream provider, repackaged.',
      },
      {
        iconName: 'KeyRound',
        q: 'How do I get an API key?',
        a: 'Connect a wallet to the dashboard, click "create key", and copy the plaintext. The plaintext is shown exactly once. The OMA store keeps a salted hash plus a public prefix for identification.',
      },
    ],
  },
  {
    idx: '04',
    name: 'Privacy',
    items: [
      {
        iconName: 'Shield',
        q: 'Do you store my prompts?',
        a: 'No. The inference request and response bodies are streamed in memory only and released on stream close. Only a per-call counter (model id, tokens in, tokens out, latency, http status) is written to the usage log.',
      },
      {
        iconName: 'Lock',
        q: 'What is "private mode"?',
        a: 'Private mode is the default. Every request is forwarded to a single provider (Venice) and never reaches a multi-vendor routing layer. The set of counterparties is small and the data path is verifiable from the source.',
      },
      {
        iconName: 'FileText',
        q: 'Where can I read the full policy?',
        a: 'See the /privacy page. For a single-paragraph summary: OMA collects wallet address, API key hash, per-call counter, and deposit tx hash; nothing else.',
      },
    ],
  },
  {
    idx: '05',
    name: 'Procurement',
    items: [
      {
        iconName: 'TrendingDown',
        q: 'What is Minimum Discount Routing?',
        a: 'A buyer-side guardrail announced by Surplus on 2026-06-12. OMA sets a minimum discount floor; any Surplus offer below the floor is filtered out before a USDC payment is signed. Default 50%, range 0–95%. The floor applies to the operator-internal Surplus buyer and to the optional procurement.min_discount_pct field that an agent can pass on every call.',
      },
      {
        iconName: 'Sliders',
        q: 'How do I set the operator floor?',
        a: 'Open /admin/fees and look for "Surplus Min Discount Routing" at the bottom. The operator floor is the first field; the user-facing default is the second. The user default cannot be set below the operator floor. Save takes effect within 30 seconds.',
      },
      {
        iconName: 'AlertTriangle',
        q: 'What happens when no offer clears the floor?',
        a: 'The operator aborts that cycle and waits for the next poll. End-user calls get a structured HTTP 422 with code discount_floor_violation and the best offer percent in the details object. There is no silent retry, no surprise bill, and no fallback to a more expensive vendor. The agent decides whether to back off, retry later, or accept a more expensive direct call.',
      },
    ],
  },
]

const TOTAL = GROUPS.reduce((acc, g) => acc + g.items.length, 0)

export default function FaqPage() {
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
                <span>faq</span>
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
                <header className="mb-5 sm:mb-7 flex items-baseline gap-3 flex-wrap">
                  <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold tracking-tight">
                    Subject
                  </h2>
                  <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                    {TOTAL} short answers
                  </span>
                </header>

                <h1
                  id="subject-heading"
                  className="font-syne font-bold text-[var(--color-text-bright)] tracking-[-0.03em] leading-[0.95] text-[clamp(2.25rem,7.5vw,5rem)]"
                  style={{ overflowWrap: 'anywhere', minWidth: 0, textWrap: 'balance' }}
                >
                  <span className="block">Questions,</span>
                  <span className="block text-[var(--color-accent)]">answered plain.</span>
                </h1>

                <p
                  className="mt-6 max-w-2xl text-[15px] sm:text-base text-[var(--color-text)] leading-relaxed"
                  style={{ textWrap: 'pretty' }}
                >
                  A working reference for builders who want to wire OMA into a
                  product. The answers are short on purpose. For the protocol
                  spec, the source, and the procurement math, head to the docs.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/docs" className="oma-btn oma-btn--primary">
                    <span aria-hidden="true" className="text-[var(--color-text-inverse)]">
                      ›
                    </span>
                    read the docs
                  </Link>
                  <Link href="/pricing" className="oma-btn oma-btn--secondary">
                    see pricing
                  </Link>
                </div>
              </div>

              <aside
                aria-label="FAQ summary"
                className="border border-[var(--color-border)] bg-[var(--color-surface)] min-w-0 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-60"
                />
                <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    Index
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)]">
                    <span className="sr-only">Status: </span>{TOTAL} answers
                  </span>
                </div>
                <dl className="text-[11px]">
                  {GROUPS.map((g) => (
                    <div
                      key={g.idx}
                      className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <dt className="text-[var(--color-text-tertiary)] uppercase tracking-widest text-[10px]">
                        {g.name}
                      </dt>
                      <dd className="text-[var(--color-text-secondary)] tabular-nums truncate text-right">
                        {g.items.length} answers
                      </dd>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-b-0">
                    <dt className="text-[var(--color-text-tertiary)] uppercase tracking-widest text-[10px]">Auth</dt>
                    <dd className="text-[var(--color-text-secondary)] tabular-nums truncate text-right">Wallet · SIWE</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-b-0">
                    <dt className="text-[var(--color-text-tertiary)] uppercase tracking-widest text-[10px]">Settlement</dt>
                    <dd className="text-[var(--color-text-secondary)] tabular-nums truncate text-right">USDC · Base</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-[var(--color-border)] last:border-b-0">
                    <dt className="text-[var(--color-text-tertiary)] uppercase tracking-widest text-[10px]">Refund</dt>
                    <dd className="text-[var(--color-text-secondary)] tabular-nums truncate text-right">manual · 24h window</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-3 py-1.5">
                    <dt className="text-[var(--color-text-tertiary)] uppercase tracking-widest text-[10px]">Contact</dt>
                    <dd className="text-[var(--color-text-secondary)] tabular-nums truncate text-right">hello@oma-ai.com</dd>
                  </div>
                </dl>
                <div className="px-3 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)]">
                  last revised · {ISSUED}
                </div>
              </aside>
            </div>
          </section>

          {/* ===== § 02–05 GROUPS (client component handles accordion state) ===== */}
          <FAQClient groups={GROUPS} />

          {/* ===== § 06 FUNDING FLOW ===== */}
          <section
            id="funding"
            aria-labelledby="funding-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <header className="mb-5 sm:mb-7 flex items-baseline gap-3 flex-wrap">
              <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold tracking-tight">
                Funding
              </h2>
              <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                the credit ledger in 4 steps
              </span>
            </header>
            <h3 id="funding-heading" className="sr-only">
              Funding flow
            </h3>

            <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
              <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl">
                A USDC transfer on Base moves from your wallet to the OMA
                deposit address, the transfer is matched to your principal, and
                the credit ledger is incremented. The whole loop is settled
                before the API responds.
              </p>

              <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6 min-w-0">
                <svg
                  viewBox="0 0 600 220"
                  role="img"
                  aria-label="Funding flow. Step 01: wallet sends USDC on Base. Step 02: Base emits a transfer event. Step 03: OMA deposit watcher matches the tx hash to the wallet principal. Step 04: OMA credit ledger increments. Step 05: API requests debit credits per token."
                  className="w-full h-auto"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <title>Funding flow</title>
                  <desc>
                    Five-step linear flow from wallet to credit balance. Steps 1 and 5 are user-facing;
                    steps 2 to 4 are operator-internal.
                  </desc>

                  <defs>
                    <marker
                      id="faqArrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-text-tertiary)" />
                    </marker>
                    <marker
                      id="faqArrowAccent"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
                    </marker>
                  </defs>

                  {/* Nodes */}
                  {[
                    { x: 30,  y: 50, w: 100, h: 40, label: 'WALLET',  sub: 'Base USDC' },
                    { x: 160, y: 50, w: 100, h: 40, label: 'BASE',    sub: 'transfer' },
                    { x: 290, y: 50, w: 100, h: 40, label: 'OMA',     sub: 'matcher' },
                    { x: 420, y: 50, w: 100, h: 40, label: 'LEDGER',  sub: 'credit' },
                    { x: 420, y: 140, w: 100, h: 40, label: 'API',     sub: 'debit' },
                  ].map((n, i) => (
                    <g key={i}>
                      <rect
                        x={n.x}
                        y={n.y}
                        width={n.w}
                        height={n.h}
                        fill={i === 2 ? 'var(--color-accent-dim)' : 'var(--color-surface-elevated)'}
                        stroke={i === 2 ? 'var(--color-accent)' : 'var(--color-border)'}
                      />
                      <text
                        x={n.x + n.w / 2}
                        y={n.y + 17}
                        textAnchor="middle"
                        fontSize="10"
                        fontFamily="var(--font-mono)"
                        fill={i === 2 ? 'var(--color-accent)' : 'var(--color-text-bright)'}
                      >
                        {n.label}
                      </text>
                      <text
                        x={n.x + n.w / 2}
                        y={n.y + 32}
                        textAnchor="middle"
                        fontSize="9"
                        fontFamily="var(--font-mono)"
                        fill="var(--color-text-tertiary)"
                      >
                        {n.sub}
                      </text>
                    </g>
                  ))}

                  {/* Arrows */}
                  {[
                    { x1: 130, y1: 70, x2: 160, y2: 70, accent: true, label: '01' },
                    { x1: 260, y1: 70, x2: 290, y2: 70, accent: false, label: '02' },
                    { x1: 390, y1: 70, x2: 420, y2: 70, accent: true, label: '03' },
                    { x1: 470, y1: 90, x2: 470, y2: 140, accent: true, label: '04' },
                    { x1: 420, y1: 160, x2: 160, y2: 160, accent: false, label: '05', reverse: true },
                  ].map((a, i) => (
                    <g key={i}>
                      <line
                        x1={a.x1}
                        y1={a.y1}
                        x2={a.x2}
                        y2={a.y2}
                        stroke={a.accent ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}
                        strokeWidth="1.25"
                        markerEnd={`url(#${a.accent ? 'faqArrowAccent' : 'faqArrow'})`}
                      />
                      <text
                        x={a.reverse ? a.x1 - 6 : a.x2 + 6}
                        y={a.y1 + (a.x1 === a.x2 ? -6 : 4)}
                        textAnchor={a.reverse ? 'end' : 'start'}
                        fontSize="10"
                        fontFamily="var(--font-mono)"
                        fill={a.accent ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}
                      >
                        {a.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </section>

          {/* ===== § 07 CTA ===== */}
          <section
            id="cta"
            aria-labelledby="cta-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <header className="mb-5 sm:mb-7 flex items-baseline gap-3 flex-wrap">
              <h2 className="font-syne text-lg sm:text-xl text-[var(--color-text-bright)] font-bold tracking-tight">
                Ask
              </h2>
              <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                the next step
              </span>
            </header>
            <h3 id="cta-heading" className="sr-only">
              Ask the team
            </h3>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] px-5 sm:px-8 py-8 sm:py-10 relative overflow-hidden">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-accent)]"
              />
              <p className="text-[15px] sm:text-base text-[var(--color-text-bright)] max-w-2xl leading-relaxed">
                Still have questions? Email the team.
              </p>
              <p className="mt-3 text-[12px] sm:text-sm text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                Billing questions go to{' '}
                <a
                  href="mailto:billing@oma-ai.com"
                  className="font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] underline decoration-2 underline-offset-2"
                >
                  billing@oma-ai.com
                </a>
                . Privacy questions go to{' '}
                <a
                  href="mailto:privacy@oma-ai.com"
                  className="font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] underline decoration-2 underline-offset-2"
                >
                  privacy@oma-ai.com
                </a>
                . Everything else goes to{' '}
                <a
                  href="mailto:hello@oma-ai.com"
                  className="font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] underline decoration-2 underline-offset-2"
                >
                  hello@oma-ai.com
                </a>
                . We aim to respond within 14 days.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/docs" className="oma-btn oma-btn--primary">
                  read the docs
                </Link>
                <Link href="/pricing" className="oma-btn oma-btn--secondary">
                  see pricing
                </Link>
                <Link
                  href="/about"
                  className="text-[11px] sm:text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] underline underline-offset-4 transition-colors"
                >
                  about oma →
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
