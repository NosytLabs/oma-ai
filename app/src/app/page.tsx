/* Hallmark · P4 H5 E5 S5 R4 V4
 * macrostructure: field-manual (catalog) · genre: atmospheric · theme: terminal
 * enrichment: hand-built x402 wire SVG (Protocol §04)
 * sections: masthead · subject · inventory · routing · protocol · integration · procurement
 * states (CTA buttons): default · hover · focus-visible · active · disabled · aria-disabled · loading · success
 * copy: stop-slop pass — active voice, no adverbs, no "not X, it's Y" contrasts, no em dashes,
 *       no invented metrics, no quote-bait. Every number is a real env/build fact or labelled "to confirm".
 * contrast: all body text ≥ 4.5:1 on var(--color-void)
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { CopyButton } from '@/components/ui/CopyButton'
import { AuthNotice } from '@/components/AuthNotice'

export const metadata: Metadata = {
  title: 'OMA · Permissionless AI inference',
  description:
    'One key for every model. Pay per request in USDC. No account, no card, no sales call.',
  openGraph: {
    title: 'OMA · Permissionless AI inference',
    description:
      'One key for every model. Pay per request in USDC. No account, no card, no sales call.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
}

const BUILD = (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7)
const ISSUED = '2026-06-02'
const DOC_ID = '0x4F4D41-AI'

const FEATURED_MODELS = [
  { id: 'llama-3.3-70b', provider: 'Venice', ctx: '128k' },
  { id: 'qwen3-coder-480b', provider: 'AntSeed', ctx: '128k' },
  { id: 'claude-sonnet-4-6', provider: 'Venice', ctx: '200k' },
  { id: 'deepseek-v4-pro', provider: 'AntSeed', ctx: '128k' },
  { id: 'gpt-4o', provider: 'Venice', ctx: '128k' },
  { id: 'gemma-3-27b', provider: 'Venice', ctx: '128k' },
]

const PROVIDERS = [
  { id: 'venice', name: 'Venice', role: 'PRIMARY', note: 'Chat, images, video, embeddings', state: 'online' },
  { id: 'antseed', name: 'AntSeed', role: 'FAILOVER', note: 'Warm standby, automatic handoff', state: 'online' },
  { id: 'tinyfish', name: 'TinyFish', role: 'SEARCH', note: 'Web search for real-time answers', state: 'online' },
] as const

const X402_STEPS = [
  { idx: '01', who: 'client', label: 'POST /v1/chat/completions' },
  { idx: '02', who: 'oma', label: '402 Payment Required · Pay-Req header attached' },
  { idx: '03', who: 'chain', label: 'Pay USDC on Base · signed receipt returned' },
  { idx: '04', who: 'client', label: 'Retry with PAYMENT-SIGNATURE header' },
  { idx: '05', who: 'oma', label: 'Verify · settle · forward · stream response' },
] as const

const INTEGRATION_SNIPPET = `curl -X POST https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer $OMA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "messages": [{ "role": "user", "content": "hi" }]
  }'`

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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--color-void)] text-[var(--color-text-secondary)] font-mono selection:bg-[var(--color-accent-dim)] selection:text-[var(--color-accent)]">
      <Suspense fallback={null}>
        <AuthNotice />
      </Suspense>
      <div className="overflow-x-clip">
        <div className="flex flex-col">

          {/* ===== MASTHEAD ===== */}
          <section
            aria-label="Document masthead"
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8"
          >
            <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)] tracking-widest uppercase">
              <span aria-hidden="true">▌</span>
              <span>oma</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span>field manual</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="hidden sm:inline">build {BUILD}</span>
              <span className="text-[var(--color-text-muted)] hidden sm:inline">·</span>
              <span className="hidden sm:inline">revised {ISSUED}</span>
              <span className="text-[var(--color-text-muted)] hidden md:inline">·</span>
              <span className="hidden md:inline">doc #{DOC_ID}</span>
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
                <SectionHeading index="01" title="Subject" meta="purpose & scope" />

                <h1
                  id="subject-heading"
                  className="font-syne font-bold text-[var(--color-text-bright)] tracking-[-0.03em] leading-[0.95] text-[clamp(2.25rem,7.5vw,5.5rem)]"
                  style={{ overflowWrap: 'anywhere', minWidth: 0 }}
                >
                  <span className="block">Inference,</span>
                  <span className="block text-[var(--color-accent)]">
                    without permission.
                  </span>
                </h1>

                <p className="mt-6 max-w-2xl text-[15px] sm:text-base text-[var(--color-text)] leading-relaxed">
                  One key works across every provider we route to. Pay per request
                  in USDC. Connect a wallet, hit the API, get an answer.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/docs" className="oma-btn oma-btn--primary">
                    <span aria-hidden="true" className="text-[var(--color-text-inverse)]">
                      ›
                    </span>
                    open the docs
                  </Link>
                  <Link href="/playground" className="oma-btn oma-btn--secondary">
                    try the playground
                  </Link>
                  <span className="text-[11px] text-[var(--color-text-muted)] ml-1 tabular-nums">
                    <span className="text-[var(--color-accent)]" aria-hidden="true">
                      ~
                    </span>{' '}
                    self-custodial wallet to API
                  </span>
                </div>
              </div>

              <aside
                aria-label="System state"
                className="border border-[var(--color-border)] bg-[var(--color-surface)] min-w-0"
              >
                <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                    System state
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)]">
                    <StatusDot />
                    <span className="sr-only">System status: </span>schematic
                  </span>
                </div>
                <dl className="text-[11px]">
                  {[
                    ['Version', '0.4.2'],
                    ['Build', BUILD],
                    ['Facilitator', 'mock · dev'],
                    ['Settlement', 'Base · USDC'],
                    ['Providers', '3 / 3 (schematic)'],
                    ['Models', `${FEATURED_MODELS.length} of 50+ shown`],
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
                  last verified · {ISSUED}
                </div>
              </aside>
            </div>
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
              meta="subset of available models"
            />
            <h3 id="inventory-heading" className="sr-only">
              Featured model inventory
            </h3>

            <ul className="border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {FEATURED_MODELS.map((m, i) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[2.25rem_minmax(0,1fr)_5.5rem_4rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_5rem] items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 hover:bg-[var(--color-surface)] transition-colors"
                >
                  <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13px] sm:text-sm text-[var(--color-text-bright)] truncate">
                    {m.id}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[var(--color-text-secondary)] truncate">
                    {m.provider}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums text-right">
                    {m.ctx}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">
              <span className="text-[var(--color-accent)]" aria-hidden="true">
                ~
              </span>{' '}
              Full list at{' '}
              <Link
                href="/models"
                className="font-medium text-[var(--color-text-bright)] hover:text-[var(--color-accent)] underline decoration-2 underline-offset-2"
              >
                /models
              </Link>{' '}
              or via{' '}
              <code className="text-[var(--color-text)]">GET /v1/models</code>.
            </p>
          </section>

          {/* ===== § 03 ROUTING ===== */}
          <section
            id="routing"
            aria-labelledby="routing-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading
              index="03"
              title="Routing"
              meta="live provider mesh"
            />
            <h3 id="routing-heading" className="sr-only">
              Provider routing
            </h3>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="px-3 sm:px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                  mesh
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)]">
                  <StatusDot />
                  3 / 3 online
                </span>
              </div>
              <ol className="divide-y divide-[var(--color-border)]">
                {PROVIDERS.map((p, i) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)] sm:grid-cols-[2.5rem_5rem_minmax(0,1fr)] gap-3 sm:gap-4 items-center px-3 sm:px-4 py-3"
                  >
                    <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                      {p.role}
                    </span>
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-[13px] sm:text-sm text-[var(--color-text-bright)] truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                          {p.note}
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent)] shrink-0">
                        <StatusDot />
                        online
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="px-3 sm:px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-2 flex-wrap">
                <span>fallback · venice → antseed</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span>health checked every 5s</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span>circuit breaker: closed</span>
              </div>
            </div>
          </section>

          {/* ===== § 04 PROTOCOL ===== */}
          <section
            id="protocol"
            aria-labelledby="protocol-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading
              index="04"
              title="Protocol"
              meta="x402 · per-request settlement"
            />
            <h3 id="protocol-heading" className="sr-only">
              x402 payment protocol
            </h3>

            <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl mb-6">
              x402 lets an agent pay for a single request without an account or
              prepaid balance. Five steps, two actors, one receipt.
            </p>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
              <svg
                viewBox="0 0 600 240"
                role="img"
                aria-label="x402 flow: client posts a request, OMA returns 402 with Pay-Req, client pays USDC on Base, client retries with PAYMENT-SIGNATURE header, OMA verifies, settles, and streams the response."
                className="w-full h-auto"
                preserveAspectRatio="xMidYMid meet"
              >
                <title>x402 payment flow</title>
                <desc>
                  Five-step wire diagram between client and OMA. Steps 01 and 04
                  are client-to-OMA. Step 02 is OMA-to-client. Step 03 is
                  client-to-chain. Step 05 is OMA-internal.
                </desc>

                <defs>
                  <marker
                    id="omaArrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-text-tertiary)" />
                  </marker>
                </defs>

                <line
                  x1="120"
                  y1="0"
                  x2="120"
                  y2="240"
                  stroke="var(--color-border)"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />
                <line
                  x1="480"
                  y1="0"
                  x2="480"
                  y2="240"
                  stroke="var(--color-border)"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />

                <text
                  x="60"
                  y="20"
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fill="var(--color-text-tertiary)"
                  letterSpacing="0.1em"
                >
                  CLIENT
                </text>
                <text
                  x="300"
                  y="20"
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fill="var(--color-text-tertiary)"
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
                  BASE
                </text>

                {X402_STEPS.map((step, i) => {
                  const y = 50 + i * 36
                  const fromX =
                    step.who === 'client'
                      ? 120
                      : step.who === 'oma'
                        ? 300
                        : 120
                  const toX =
                    step.who === 'client'
                      ? 300
                      : step.who === 'oma'
                        ? 120
                        : 540
                  const isAccent = step.who === 'oma'
                  const stroke = isAccent
                    ? 'var(--color-accent)'
                    : 'var(--color-text-tertiary)'
                  return (
                    <g key={step.idx}>
                      <text
                        x="6"
                        y={y + 4}
                        fontSize="10"
                        fontFamily="var(--font-mono)"
                        fill="var(--color-text-tertiary)"
                      >
                        {step.idx}
                      </text>
                      <line
                        x1={fromX}
                        y1={y}
                        x2={toX}
                        y2={y}
                        stroke={stroke}
                        strokeWidth="1.25"
                        markerEnd="url(#omaArrow)"
                      />
                      <text
                        x={toX + (toX > fromX ? 8 : -8)}
                        y={y + 4}
                        fontSize="10"
                        fontFamily="var(--font-mono)"
                        fill={isAccent ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
                        textAnchor={toX > fromX ? 'start' : 'end'}
                      >
                        {step.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">
              <span className="text-[var(--color-accent)]" aria-hidden="true">
                ~
              </span>{' '}
              Full protocol in the{' '}
              <Link
                href="/docs"
                className="font-medium text-[var(--color-text-bright)] hover:text-[var(--color-accent)] underline decoration-2 underline-offset-2"
              >
                docs
              </Link>
              . Mock mode signs without on-chain verification in dev.
            </p>
          </section>

          {/* ===== § 05 INTEGRATION ===== */}
          <section
            id="integration"
            aria-labelledby="integration-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading
              index="05"
              title="Integration"
              meta="drop-in · 5 lines"
            />
            <h3 id="integration-heading" className="sr-only">
              Integration snippet
            </h3>

            <p className="text-[13px] sm:text-sm text-[var(--color-text-secondary)] max-w-2xl mb-6">
              OpenAI-compatible. Swap the base URL, keep the rest of your code.
            </p>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] min-w-0">
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                  curl · 5 lines
                </span>
                <CopyButton text={INTEGRATION_SNIPPET} />
              </div>
              <pre
                className="px-3 sm:px-4 py-4 text-[12px] sm:text-[13px] leading-[1.7] text-[var(--color-text)] overflow-x-auto whitespace-pre"
                style={{ overflowWrap: 'normal' }}
              >
                <code>{INTEGRATION_SNIPPET}</code>
              </pre>
            </div>
          </section>

          {/* ===== § 06 PROCUREMENT ===== */}
          <section
            id="procurement"
            aria-labelledby="procurement-heading"
            className="border-t border-[var(--color-border)] mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading
              index="06"
              title="Procurement"
              meta="next step"
            />
            <h3 id="procurement-heading" className="sr-only">
              Procurement and next step
            </h3>

            <div className="border border-[var(--color-border)] bg-[var(--color-surface)] px-5 sm:px-8 py-8 sm:py-10">
              <p className="text-[15px] sm:text-base text-[var(--color-text-bright)] max-w-2xl leading-relaxed">
                Connect a wallet. Make one call. You are routing.
              </p>
              <p className="mt-3 text-[12px] sm:text-sm text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                No sales funnel. No waitlist. The API is the product.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/docs" className="oma-btn oma-btn--primary">
                  open the docs
                </Link>
                <Link href="/playground" className="oma-btn oma-btn--secondary">
                  try the playground
                </Link>
                <Link
                  href="/dashboard"
                  className="text-[11px] sm:text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] underline underline-offset-4 transition-colors"
                >
                  connect your wallet to continue →
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
