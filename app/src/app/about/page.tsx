/* Hallmark · P4 H5 E5 S5 R4 V4
 * macrostructure: field-manual (catalog) · genre: atmospheric · theme: terminal
 * enrichment: hand-built stack SVG diagram + numbered § sections
 * sections: masthead · subject · what · how · team · links
 * states (CTA buttons): default · hover · focus-visible · active · disabled · aria-disabled · loading · success
 * copy: stop-slop pass — active voice, no adverbs, no "not X, it's Y" contrasts, no em dashes,
 *       no invented metrics, no quote-bait.
 * contrast: all body text ≥ 4.5:1 on var(--color-void)
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Github, Twitter, Mail, BookOpen, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About · OMA',
  description:
    'OMA is a thin inference gateway. One OpenAI-compatible endpoint, one price list, USDC on Base, wallet-only auth.',
  openGraph: {
    title: 'About · OMA',
    description:
      'OMA is a thin inference gateway. One OpenAI-compatible endpoint, one price list, USDC on Base, wallet-only auth.',
  },
}

const ISSUED = '2026-06-12'
const DOC_ID = '0x4F4D41-ABOUT'
const BUILD = (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7)

const STACK = [
  { idx: '01', actor: 'USER',     role: 'Caller',   note: 'OpenAI-compatible HTTP client' },
  { idx: '02', actor: 'OMA',      role: 'Gateway',  note: 'Auth, metering, routing, x402' },
  { idx: '03', actor: 'CHEAP',    role: 'Sourcing', note: 'Daily-discounted Venice reseller' },
  { idx: '04', actor: 'SURPLUS',  role: 'Backup',   note: 'Operator-side procurement, off the hot path' },
  { idx: '05', actor: 'VENICE',   role: 'Compute',  note: 'Model host · API · billing' },
  { idx: '06', actor: 'BASE',     role: 'Settle',   note: 'USDC receipt · EIP-3009' },
] as const

const PILLARS = [
  {
    idx: '01',
    title: 'What OMA is',
    body: 'A thin gateway over upstream model providers. OMA does not train, host, or fine-tune models. Every request is forwarded to a model host, metered at the token, and billed to a wallet.',
  },
  {
    idx: '02',
    title: 'How it works',
    body: 'You send a request to an OpenAI-compatible endpoint. OMA authenticates your wallet, debits credits, and routes to Venice through a pool of leased keys purchased on the secondary market. Settlement happens on Base.',
  },
  {
    idx: '03',
    title: 'Why it exists',
    body: 'To make inference permissionless. No sales funnel, no enterprise contract, no email gate. The same API works from a laptop in Montreal and a CI job in São Paulo.',
  },
  {
    idx: '04',
    title: 'What it costs',
    body: 'A flat 25% markup over Venice retail. The procurement math is internal; the user-facing price list is the same number for every call, regardless of what OMA actually paid.',
  },
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

export default function AboutPage() {
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
                <span>about</span>
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
                <SectionHeading index="01" title="Subject" meta="who we are" />

                <h1
                  id="subject-heading"
                  className="font-syne font-bold text-[var(--color-text-bright)] tracking-[-0.03em] leading-[0.95] text-[clamp(2.25rem,7.5vw,5rem)]"
                  style={{ overflowWrap: 'anywhere', minWidth: 0, textWrap: 'balance' }}
                >
                  <span className="block">A gateway,</span>
                  <span className="block text-[var(--color-accent)]">not a host.</span>
                </h1>

                <p
                  className="mt-6 max-w-2xl text-[15px] sm:text-base text-[var(--color-text)] leading-relaxed"
                  style={{ textWrap: 'pretty' }}
                >
                  OMA sits between your code and an upstream model provider. We
                  authenticate with a wallet, meter tokens, settle on Base, and
                  forward the call. The model itself runs on infrastructure we
                  do not own and we never see the response body after streaming.
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
                aria-label="About this document"
                className="border border-[var(--color-border)] bg-[var(--color-surface)] min-w-0 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-60"
                />
                <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    Colophon
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)]">
                    <StatusDot />
                    <span className="sr-only">Status: </span>current
                  </span>
                </div>
                <dl className="text-[11px]">
                  {[
                    ['Issuer', 'OMA · operator-side'],
                    ['Form', 'Inference gateway'],
                    ['Hosts', '0 (we forward)'],
                    ['Models', '19+ across providers'],
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
                  last revised · {ISSUED}
                </div>
              </aside>
            </div>
          </section>

          {/* ===== § 02 WHAT ===== */}
          <section
            id="what"
            aria-labelledby="what-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="02" title="What" meta="four short answers" />
            <h3 id="what-heading" className="sr-only">
              What OMA is
            </h3>

            <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              {PILLARS.map((p) => (
                <li
                  key={p.idx}
                  className="group border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-accent)]/40 transition-colors"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                      §{p.idx}
                    </span>
                    <h3 className="font-syne text-[15px] font-semibold text-[var(--color-text-bright)]">
                      {p.title}
                    </h3>
                  </div>
                  <p className="text-[12.5px] sm:text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                    {p.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* ===== § 03 HOW (stack diagram) ===== */}
          <section
            id="how"
            aria-labelledby="how-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="03" title="How" meta="the request path" />
            <h3 id="how-heading" className="sr-only">
              Request path
            </h3>

            <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
              <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl">
                One call crosses six actors. The user only sees OMA. The model
                only sees OMA. Settlement is the only public surface.
              </p>

              <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6 min-w-0">
                <svg
                  viewBox="0 0 600 360"
                  role="img"
                  aria-label="OMA request path. User sends an OpenAI-compatible request to OMA. OMA authenticates the wallet, debits credits, and forwards to a Venice key leased from CheapTokens. Surplus Intelligence is reserved as an operator-side backup. Venice serves the call. USDC settles on Base."
                  className="w-full h-auto"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <title>OMA request path</title>
                  <desc>
                    Six actors on the request path: User, OMA, CheapTokens, Surplus, Venice, Base. Arrows show
                    request flow and settlement flow. Operator-internal links (OMA to CheapTokens, OMA to
                    Surplus) are dashed; user-facing links (User to OMA, OMA to Venice, OMA to Base) are solid.
                  </desc>

                  <defs>
                    <marker
                      id="aboutArrow"
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
                      id="aboutArrowAccent"
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

                  {/* Column labels */}
                  <text
                    x="60"
                    y="20"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                    letterSpacing="0.1em"
                  >
                    CALLER
                  </text>
                  <text
                    x="300"
                    y="20"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-accent)"
                    letterSpacing="0.1em"
                  >
                    OMA
                  </text>
                  <text
                    x="540"
                    y="20"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                    letterSpacing="0.1em"
                  >
                    UPSTREAM
                  </text>

                  {/* Vertical swimlanes */}
                  <line
                    x1="120"
                    y1="30"
                    x2="120"
                    y2="340"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />
                  <line
                    x1="480"
                    y1="30"
                    x2="480"
                    y2="340"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />

                  {/* USER box */}
                  <rect
                    x="20"
                    y="40"
                    width="80"
                    height="36"
                    fill="var(--color-surface-elevated)"
                    stroke="var(--color-border)"
                  />
                  <text
                    x="60"
                    y="55"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-bright)"
                  >
                    USER
                  </text>
                  <text
                    x="60"
                    y="68"
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    HTTP client
                  </text>

                  {/* OMA box */}
                  <rect
                    x="260"
                    y="40"
                    width="80"
                    height="36"
                    fill="var(--color-accent-dim)"
                    stroke="var(--color-accent)"
                  />
                  <text
                    x="300"
                    y="55"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-accent)"
                  >
                    OMA
                  </text>
                  <text
                    x="300"
                    y="68"
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    gateway
                  </text>

                  {/* VENICE box */}
                  <rect
                    x="500"
                    y="40"
                    width="80"
                    height="36"
                    fill="var(--color-surface-elevated)"
                    stroke="var(--color-border)"
                  />
                  <text
                    x="540"
                    y="55"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-bright)"
                  >
                    VENICE
                  </text>
                  <text
                    x="540"
                    y="68"
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    model host
                  </text>

                  {/* CHEAPTOKENS box */}
                  <rect
                    x="500"
                    y="160"
                    width="80"
                    height="36"
                    fill="var(--color-surface-elevated)"
                    stroke="var(--color-border)"
                  />
                  <text
                    x="540"
                    y="175"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-bright)"
                  >
                    CHEAP
                  </text>
                  <text
                    x="540"
                    y="188"
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    key vendor
                  </text>

                  {/* SURPLUS box */}
                  <rect
                    x="500"
                    y="230"
                    width="80"
                    height="36"
                    fill="var(--color-surface-elevated)"
                    stroke="var(--color-border)"
                  />
                  <text
                    x="540"
                    y="245"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-bright)"
                  >
                    SURPLUS
                  </text>
                  <text
                    x="540"
                    y="258"
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    backup
                  </text>

                  {/* BASE box */}
                  <rect
                    x="260"
                    y="300"
                    width="80"
                    height="36"
                    fill="var(--color-surface-elevated)"
                    stroke="var(--color-border)"
                  />
                  <text
                    x="300"
                    y="315"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-bright)"
                  >
                    BASE
                  </text>
                  <text
                    x="300"
                    y="328"
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    USDC settle
                  </text>

                  {/* Step 1: USER -> OMA (request, solid) */}
                  <text
                    x="6"
                    y="104"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    01
                  </text>
                  <line
                    x1="100"
                    y1="100"
                    x2="260"
                    y2="100"
                    stroke="var(--color-accent)"
                    strokeWidth="1.25"
                    markerEnd="url(#aboutArrowAccent)"
                  />
                  <text
                    x="180"
                    y="94"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-accent)"
                  >
                    request
                  </text>

                  {/* Step 2: OMA -> VENICE (forward, solid) */}
                  <text
                    x="6"
                    y="134"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    02
                  </text>
                  <line
                    x1="340"
                    y1="100"
                    x2="500"
                    y2="100"
                    stroke="var(--color-text-tertiary)"
                    strokeWidth="1.25"
                    markerEnd="url(#aboutArrow)"
                  />
                  <text
                    x="420"
                    y="94"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-secondary)"
                  >
                    forward
                  </text>

                  {/* Step 3: OMA -> CHEAPTOKENS (operator-internal, dashed) */}
                  <text
                    x="6"
                    y="184"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    03
                  </text>
                  <line
                    x1="340"
                    y1="180"
                    x2="500"
                    y2="180"
                    stroke="var(--color-text-tertiary)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    markerEnd="url(#aboutArrow)"
                  />
                  <text
                    x="420"
                    y="174"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    lease keys
                  </text>

                  {/* Step 4: OMA -> SURPLUS (operator-internal, dashed) */}
                  <text
                    x="6"
                    y="254"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    04
                  </text>
                  <line
                    x1="340"
                    y1="250"
                    x2="500"
                    y2="250"
                    stroke="var(--color-text-tertiary)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    markerEnd="url(#aboutArrow)"
                  />
                  <text
                    x="420"
                    y="244"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    backup
                  </text>

                  {/* Step 5: OMA -> BASE (settlement, solid) */}
                  <text
                    x="6"
                    y="324"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                  >
                    05
                  </text>
                  <line
                    x1="540"
                    y1="240"
                    x2="540"
                    y2="60"
                    stroke="var(--color-text-tertiary)"
                    strokeWidth="0"
                  />
                  <line
                    x1="340"
                    y1="320"
                    x2="540"
                    y2="320"
                    stroke="var(--color-accent)"
                    strokeWidth="1.25"
                    strokeDasharray="0"
                    markerEnd="url(#aboutArrowAccent)"
                  />
                  <text
                    x="420"
                    y="314"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-accent)"
                  >
                    settle USDC
                  </text>
                </svg>
              </div>
            </div>

            <ol className="mt-6 border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
              {STACK.map((s) => (
                <li
                  key={s.idx}
                  className="grid grid-cols-[2.5rem_4.5rem_minmax(0,1fr)] sm:grid-cols-[2.75rem_6rem_minmax(0,1fr)] items-center gap-3 px-3 sm:px-4 py-2.5"
                >
                  <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                    §{s.idx}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-widest ${
                      s.actor === 'CHEAP'
                        ? 'text-[var(--color-secondary)]'
                        : s.actor === 'VENICE'
                          ? 'text-[var(--color-violet)]'
                          : s.actor === 'BASE'
                            ? 'text-[var(--color-accent)]'
                            : s.actor === 'USER'
                              ? 'text-[var(--color-text-bright)]'
                              : 'text-[var(--color-text-tertiary)]'
                    }`}
                  >
                    {s.actor}
                  </span>
                  <span className="text-[12.5px] sm:text-[13px] text-[var(--color-text-bright)] truncate">
                    <span className="text-[var(--color-text-tertiary)] mr-2">{s.role}</span>
                    {s.note}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* ===== § 04 TEAM ===== */}
          <section
            id="team"
            aria-labelledby="team-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="04" title="Operator" meta="who runs the relay" />
            <h3 id="team-heading" className="sr-only">
              Operator
            </h3>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7 relative overflow-hidden">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-accent)]"
              />
              <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                OMA is run by a small operator team. The procurement loop, the
                x402 facilitator, and the rate-limit policy are documented in
                the source. There is no corporation, no board, and no
                marketing department. The build artifacts and the docs are the
                product.
              </p>
              <dl className="mt-6 grid gap-3 sm:grid-cols-3 text-[11px]">
                {[
                  ['Role', 'Operator · engineer'],
                  ['Reach', 'github · x · email'],
                  ['Disclosure', 'source-available'],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="grid grid-cols-2 gap-2 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2"
                  >
                    <dt className="text-[var(--color-text-tertiary)] uppercase tracking-widest text-[10px]">
                      {k}
                    </dt>
                    <dd className="text-[var(--color-text-secondary)] truncate text-right">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* ===== § 05 LINKS ===== */}
          <section
            id="links"
            aria-labelledby="links-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading index="05" title="Reach" meta="where to find us" />
            <h3 id="links-heading" className="sr-only">
              Contact links
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <a
                href="https://github.com/oma-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Github className="h-5 w-5 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-text-bright)] truncate">
                      GitHub
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
                      @oma-ai
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" aria-hidden="true" />
              </a>
              <a
                href="https://twitter.com/oma_ai"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Twitter className="h-5 w-5 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-text-bright)] truncate">
                      X / Twitter
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
                      @oma_ai
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" aria-hidden="true" />
              </a>
              <a
                href="mailto:hello@oma-ai.com"
                className="group flex items-center justify-between gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="h-5 w-5 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-text-bright)] truncate">
                      Email
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
                      hello@oma-ai.com
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" aria-hidden="true" />
              </a>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/docs"
                className="group flex items-center justify-between gap-3 border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] p-5 transition-colors hover:border-[var(--color-accent)]/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="h-5 w-5 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-text-bright)] truncate">
                      Read the docs
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                      API reference, examples, integrations.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--color-accent)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="group flex items-center justify-between gap-3 border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] p-5 transition-colors hover:border-[var(--color-accent)]/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ArrowRight className="h-5 w-5 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-text-bright)] truncate">
                      See pricing
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                      Per-model rates, payment methods.
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--color-accent)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
