// ponytail: production URL (https://api.oma-ai.com/v1) — references resolve once the gateway is deployed (audit C-1).
'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  Lock,
  Coins,
  TrendingDown,
  CheckCircle,
  Layers,
  Activity,
  Sliders,
  Wallet,
  FileCode,
  ServerCog,
  AlertTriangle,
} from 'lucide-react'
import { motion } from 'framer-motion'

/**
 * OMA · Surplus Min Discount Routing
 * sections: status banner · hero · value · flow diagram · operator policy · agent example · end-user request · CTA
 * conversational marketing copy
 */

const DEFAULT_FLOOR_PCT = 50
const FLOOR_RANGE = { min: 0, max: 95 } as const

const VALUE_PILLARS = [
  {
    icon: Shield,
    title: 'A ceiling, not a target',
    desc: 'You set the floor. The marketplace only routes to offers that meet or exceed your threshold. Anything below the floor is filtered out before a USDC payment is signed.',
  },
  {
    icon: TrendingDown,
    title: 'Stop overpaying for inference',
    desc: 'Without a floor, a high-priority request can resolve against a thin-book offer and bill you close to retail. A min_discount guard skips those offers and waits, or fails fast, instead of charging full price.',
  },
  {
    icon: Sliders,
    title: 'One knob, two scopes',
    desc: `Operator scope: OMA refuses to buy Surplus capacity below the configured ${DEFAULT_FLOOR_PCT}% floor. End-user scope: every agent that hits OMA carries an optional min_discount default that OMA honours when it routes on your behalf.`,
  },
  {
    icon: Activity,
    title: 'Deterministic, no silent retries',
    desc: 'When no Surplus offer clears the floor, OMA returns 422 with a structured discount_floor_violation reason. No silent retry, no surprise bill, no marketing-tier fallback to a more expensive vendor.',
  },
] as const

const OPERATOR_NOTES = [
  'Floor is set in /admin/fees alongside the existing procurement markup knobs',
  'Reads from the same fee_config table as the Venice markup, no new schema migration',
  'Applies to the operator-internal Surplus buyer only, never to user-facing traffic',
  'Effective within 30s of save; in-flight x402 orders finish at the old floor',
  'Default 50% on first install, can be lowered to 0% for opportunistic buying',
] as const

const END_USER_NOTES = [
  'Default applies to every request the agent makes through OMA',
  'Per-key override is exposed in the dashboard under Settings → Procurement',
  'A request that violates the floor is rejected with HTTP 422 before any charge',
  'Compliance evidence (floor, source offer list, rejection reason) is included in the receipt',
  'Floor cannot be set lower than the operator-internal default',
] as const

const AGENT_SNIPPET = `# Agent enforces a minimum discount when calling OMA
import os, json, requests

OMA_KEY    = os.environ["OMA_KEY"]
MIN_OFF    = 50  # refuse any offer < 50% off retail

req = {
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "summarize this"}],
    # Procurement guardrail: forwarded to the OMA router.
    # OMA will reject this call with HTTP 422 if the best
    # available Surplus offer is below 50% off retail.
    "procurement": {
        "min_discount_pct": MIN_OFF,
    },
}

r = requests.post(
    "https://api.oma-ai.com/v1/chat/completions",
    headers={"Authorization": f"Bearer {OMA_KEY}"},
    json=req,
    timeout=30,
)

if r.status_code == 422 and r.json().get("error", {}).get("code") == "discount_floor_violation":
    # No offer cleared the floor. Back off and retry, or
    # accept a more expensive direct call, or do not retry.
    print("no qualifying offer:", r.json()["error"]["details"])
elif r.ok:
    print(json.dumps(r.json(), indent=2))`

function StatusDot({ tone = 'accent' }: { tone?: 'accent' | 'warning' }) {
  const color = tone === 'warning' ? 'var(--color-warning)' : 'var(--color-accent)'
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

const SectionHeading = ({ index, title, meta }: { index?: string; title: string; meta?: string }) => (
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

export default function SurplusMinDiscountRoutingPage() {
  return (
    <div className="min-h-screen bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
      <div className="overflow-x-clip">
        <div className="flex flex-col">

          {/* ===== System status banner ===== */}
          <div
            role="status"
            aria-live="polite"
            className="border-b border-warning/30 bg-warning-dim"
          >
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-3 flex items-start gap-2.5">
              <AlertTriangle
                className="h-4 w-4 mt-0.5 shrink-0 text-warning"
                aria-hidden="true"
              />
              <p className="text-[11.5px] sm:text-[12.5px] text-text leading-relaxed">
                <span className="font-semibold text-warning text-[11px] mr-2">
                  temporarily disabled
                </span>
                Surplus Intelligence routing is offline while the EIP-712 payment
                signer is being repaired. The floor, scope, and end-user API
                surface described below remain spec-only until the signer is
                fixed. Track status in the operator channel.
              </p>
            </div>
          </div>

          {/* ===== Back nav ===== */}
          <section
            aria-label="Back to home"
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[11px] text-text-tertiary hover:text-accent transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              back to home
            </Link>
          </section>

          {/* ===== HERO ===== */}
          {/* ===== HERO ===== */}
          <section
            aria-labelledby="subject-heading"
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-12 sm:pb-16"
          >
            <div className="grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  Surplus Min Discount Routing
                </span>

                <h1
                  id="subject-heading"
                  className="h1-hero text-text-bright mt-6"
                  style={{ overflowWrap: 'anywhere', minWidth: 0, textWrap: 'balance' }}
                >
                  <span className="block">Set a discount</span>
                  <span className="block text-accent">floor. Pay less.</span>
                </h1>

                <p
                  className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed"
                  style={{ textWrap: 'pretty' }}
                >
                  Minimum Discount Routing is a first-class guardrail on OMA.
                  We won&apos;t buy Surplus Intelligence capacity below the
                  floor you set, and end-user agents can request the same
                  floor for their own spend. Stop overpaying for inference.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[12px] font-medium text-accent">
                    <Layers className="h-3 w-3" />
                    Guardrail
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-text-muted">
                    <Lock className="h-3 w-3" />
                    Private
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-text-muted">
                    <Coins className="h-3 w-3" />
                    x402 on Base
                  </span>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/dashboard" className="bg-accent text-void hover:bg-accent-hover px-5 py-2.5 rounded-2xl font-medium transition-colors">
                    <span aria-hidden="true" className="text-text-inverse">›</span>
                    open the dashboard
                  </Link>
                  <Link href="/admin/fees" className="bg-surface text-text border border-border hover:bg-surface-elevated px-5 py-2.5 rounded-2xl font-medium transition-colors">
                    set operator floor
                  </Link>
                </div>
              </div>

              <aside
                aria-label="Floor policy"
                className="border border-border bg-surface min-w-0 relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60"
                />
                <div className="px-4 py-2.5 border-b border-border bg-panel flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-text-bright">
                    Floor policy
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-accent">
                    <StatusDot />
                    <span className="sr-only">Status: </span>live
                  </span>
                </div>
                <dl className="text-[12px]">
                  {[
                    ['Operator default', `≥ ${DEFAULT_FLOOR_PCT}% off retail`],
                    ['Operator range', `${FLOOR_RANGE.min}–${FLOOR_RANGE.max}%`],
                    ['User override', 'per-api-key, ≥ operator default'],
                    ['Empty-result code', '422 · discount_floor_violation'],
                    ['Scope', 'Surplus Intelligence only'],
                    ['Settlement', 'USDC on Base'],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="grid grid-cols-2 gap-2 px-4 py-2 border-b border-border last:border-b-0"
                    >
                      <dt className="text-text-muted text-[11.5px]">{k}</dt>
                      <dd className="text-text-secondary tabular-nums truncate text-right">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="px-4 py-2.5 border-t border-border text-[11px] text-text-tertiary">
                  Source: AskSurplus announcement and docs/INTERNAL-SOURCING.md
                </div>
              </aside>
            </div>
          </section>

          {/* ===== VALUE ===== */}
          <section
            aria-labelledby="value-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="Why a discount floor matters" meta="What it actually buys you" />
            <h2 id="value-heading" className="sr-only">Value pillars</h2>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              {VALUE_PILLARS.map((p, i) => (
                <motion.article
                  key={p.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.4, delay: i * 0.05, ease: 'easeOut' }}
                  className="group border border-border bg-surface p-5 hover:border-accent/40 transition-colors"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center border border-accent/30 bg-accent-dim">
                      <p.icon className="h-4 w-4 text-accent" aria-hidden="true" />
                    </div>
                    <h3 className="font-display text-[15px] font-semibold text-text-bright">
                      {p.title}
                    </h3>
                  </div>
                  <p className="text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
                    {p.desc}
                  </p>
                </motion.article>
              ))}
            </div>
          </section>

          {/* ===== FLOW DIAGRAM ===== */}
          <section
            aria-labelledby="flow-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="How the routing flow works" meta="An 8-step loop between you, OMA, and Surplus" />
            <h2 id="flow-heading" className="sr-only">Minimum discount routing flow</h2>

            <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
              <p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl">
                An agent posts a request with a min_discount_pct. OMA pulls the
                current Surplus offer list, drops any offer below the floor,
                and either routes the call or returns a structured 422. The
                client never sees an offer it would have rejected.
              </p>

              <div className="border border-border bg-surface p-4 sm:p-6 min-w-0">
                <svg
                  viewBox="0 0 600 360"
                  role="img"
                  aria-label="Minimum discount routing flow. Step 01: client posts /v1/chat/completions with min_discount_pct. Step 02: OMA pulls the current Surplus offer list. Step 03: Surplus returns N offers with per-offer discount percent. Step 04: OMA filters out offers below the floor. Step 05: if no offer clears the floor, OMA returns 422 discount_floor_violation. Step 06: if at least one offer clears, OMA picks the best. Step 07: client signs x402 Payment and pays USDC on Base. Step 08: Surplus settles, serves the inference, and returns a receipt."
                  className="w-full h-auto"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <title>Min discount routing flow</title>
                  <desc>
                    Eight-step wire diagram between client, OMA, Surplus, and Base.
                    Steps 1 and 7 are client-to-OMA. Steps 2 and 5 are OMA-to-client.
                    Step 3 is Surplus-to-OMA. Step 4 is OMA-internal. Step 6 is
                    OMA-to-OMA. Step 8 is Surplus-internal.
                  </desc>

                  <defs>
                    <marker
                      id="minDiscountArrow"
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
                      id="minDiscountArrowAccent"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
                    </marker>
                    <marker
                      id="minDiscountArrowReject"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-warning)" />
                    </marker>
                  </defs>

                  {/* Lifelines */}
                  <line
                    x1="90"
                    y1="0"
                    x2="90"
                    y2="360"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />
                  <line
                    x1="300"
                    y1="0"
                    x2="300"
                    y2="360"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />
                  <line
                    x1="510"
                    y1="0"
                    x2="510"
                    y2="360"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />

                  {/* Lane labels */}
                  <text
                    x="45"
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
                    x="195"
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
                    x="405"
                    y="20"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                    letterSpacing="0.1em"
                  >
                    SURPLUS
                  </text>
                  <text
                    x="555"
                    y="20"
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-text-tertiary)"
                    letterSpacing="0.1em"
                  >
                    BASE
                  </text>

                  {/* Floor threshold pill */}
                  <g>
                    <rect
                      x="120"
                      y="36"
                      width="360"
                      height="18"
                      fill="var(--color-warning-dim)"
                      stroke="var(--color-warning)"
                      strokeWidth="0.5"
                    />
                    <text
                      x="300"
                      y="49"
                      textAnchor="middle"
                      fontSize="10"
                      fontFamily="var(--font-mono)"
                      fill="var(--color-warning)"
                      letterSpacing="0.1em"
                    >
                      FLOOR · ≥ {DEFAULT_FLOOR_PCT}% OFF RETAIL
                    </text>
                  </g>

                  {/* Steps */}
                  {[
                    { idx: '01', fromX: 90,  toX: 300, y: 80,  label: 'POST /v1/chat/completions · min_discount_pct', accent: true },
                    { idx: '02', fromX: 300, toX: 510, y: 110, label: 'GET /v1/offers?model=…', accent: false, who: 'oma->surplus' },
                    { idx: '03', fromX: 510, toX: 300, y: 140, label: 'N offers · per-offer discount %', accent: false, who: 'surplus->oma' },
                    { idx: '04', fromX: 240, toX: 360, y: 170, label: 'FILTER · keep discount ≥ floor', accent: true, internal: true },
                    { idx: '05', fromX: 300, toX: 90,  y: 200, label: '422 discount_floor_violation', accent: false, reject: true },
                    { idx: '06', fromX: 240, toX: 360, y: 230, label: 'PICK · best non-violator', accent: true, internal: true },
                    { idx: '07', fromX: 300, toX: 555, y: 270, label: '402 → sign x402 Payment', accent: true, who: 'oma->base' },
                    { idx: '08', fromX: 510, toX: 300, y: 310, label: 'settle · serve · receipt', accent: false, who: 'surplus->oma' },
                  ].map((s) => {
                    const stroke = s.reject
                      ? 'var(--color-warning)'
                      : s.accent
                        ? 'var(--color-accent)'
                        : 'var(--color-text-tertiary)'
                    const marker = s.reject
                      ? 'url(#minDiscountArrowReject)'
                      : s.accent
                        ? 'url(#minDiscountArrowAccent)'
                        : 'url(#minDiscountArrow)'
                    const textColor = s.reject
                      ? 'var(--color-warning)'
                      : s.accent
                        ? 'var(--color-accent)'
                        : 'var(--color-text-secondary)'
                    return (
                      <g key={s.idx}>
                        <text
                          x="6"
                          y={s.y + 4}
                          fontSize="10"
                          fontFamily="var(--font-mono)"
                          fill="var(--color-text-tertiary)"
                        >
                          {s.idx}
                        </text>
                        <line
                          x1={s.fromX}
                          y1={s.y}
                          x2={s.toX}
                          y2={s.y}
                          stroke={stroke}
                          strokeWidth="1.25"
                          markerEnd={marker}
                        />
                        <text
                          x={s.toX > s.fromX ? s.toX + 8 : s.toX - 8}
                          y={s.y + 4}
                          fontSize="10"
                          fontFamily="var(--font-mono)"
                          fill={textColor}
                          textAnchor={s.toX > s.fromX ? 'start' : 'end'}
                        >
                          {s.label}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>
          </section>

          {/* ===== OPERATOR POLICY ===== */}
          <section
            aria-labelledby="operator-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="How OMA uses the floor" meta="Operator-side policy" />
            <h2 id="operator-heading" className="sr-only">Operator policy</h2>

            <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ServerCog className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h3 className="font-display text-[15px] font-semibold text-text-bright">
                    OMA refuses to buy below the floor
                  </h3>
                </div>
                <p className="text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
                  When the CheapTokens pool sells out, the OMA operator falls
                  back to Surplus Intelligence on x402. With Minimum Discount
                  Routing enabled, that fallback honours{' '}
                  <code className="font-mono text-text-bright">minDiscountPct</code>{' '}
                  from <code className="font-mono text-text-bright">/admin/fees</code>.
                  The x402 payment is never signed for an offer whose discount
                  is below the configured floor, regardless of which operator
                  script is running. Default {DEFAULT_FLOOR_PCT}%, range{' '}
                  {FLOOR_RANGE.min}–{FLOOR_RANGE.max}%.
                </p>
                <ul className="mt-4 space-y-2">
                  {OPERATOR_NOTES.map((note) => (
                    <li
                      key={note}
                      className="flex items-start gap-2.5 text-[12.5px] sm:text-[13px] text-text"
                    >
                      <CheckCircle
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <aside
                aria-label="Operator config keys"
                className="border border-border bg-surface min-w-0 rounded-xl overflow-hidden"
              >
                <div className="px-4 py-2.5 border-b border-border bg-panel flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-text-bright">
                    fee_config · minDiscountPct
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-accent">
                    <StatusDot />
                    live
                  </span>
                </div>
                <pre
                  className="px-3 py-3 text-[11.5px] sm:text-[12px] leading-[1.7] text-text overflow-x-auto whitespace-pre"
                  style={{ overflowWrap: 'normal' }}
                >
{`PUT /api/admin/config/fees
{
  "config": {
    "providers": { "venice": { "markupPercent": 25 } },
    "procurement": {
      "minDiscountPct": 50,
      "minDiscountRangePct": [0, 95]
    }
  }
}`}
                </pre>
                <div className="px-4 py-2.5 border-t border-border text-[11px] text-text-tertiary">
                  Same endpoint as the Venice markup.
                </div>
              </aside>
            </div>
          </section>

          {/* ===== AGENT EXAMPLE ===== */}
          <section
            aria-labelledby="agent-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="For agents and integrators" meta="The 22-line example" />
            <h2 id="agent-heading" className="sr-only">Agent example</h2>

            <p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-6">
              Any agent that hits OMA can set its own min_discount_pct per
              request. OMA will reject the call with HTTP 422 if the best
              available Surplus offer is below the threshold. The agent
              decides whether to back off, retry, or accept a more expensive
              direct call.
            </p>

            <div className="border border-border bg-surface min-w-0 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-panel">
                <span className="text-[12px] font-semibold text-text-bright flex items-center gap-2">
                  <FileCode className="h-3 w-3" aria-hidden="true" />
                  Python · 22 lines
                </span>
                <span className="text-[11px] text-text-tertiary">
                  min_discount_pct = 50
                </span>
              </div>
              <pre
                className="px-3 sm:px-4 py-4 text-[12px] sm:text-[12.5px] leading-[1.7] text-text overflow-x-auto whitespace-pre"
                style={{ overflowWrap: 'normal' }}
              >
                <code>{AGENT_SNIPPET}</code>
              </pre>
            </div>
          </section>

          {/* ===== END-USER REQUEST ===== */}
          <section
            aria-labelledby="enduser-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="For end users" meta="How to request a floor on your behalf" />
            <h2 id="enduser-heading" className="sr-only">End-user request</h2>

            <div className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="h-4 w-4 text-accent" aria-hidden="true" />
                  <h3 className="font-display text-[15px] font-semibold text-text-bright">
                    Ask OMA to honour a floor on your behalf
                  </h3>
                </div>
                <p className="text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
                  End users do not need to call Surplus directly. Every request
                  through OMA can carry a <code className="font-mono text-text-bright">procurement.min_discount_pct</code>{' '}
                  guardrail. To make it sticky across calls, set the per-key
                  default in the dashboard, or email{' '}
                  <a
                    href="mailto:hello@oma-ai.com"
                    className="text-accent hover:underline underline-offset-2"
                  >
                    hello@oma-ai.com
                  </a>{' '}
                  to set a team-wide policy.
                </p>
                <ul className="mt-4 space-y-2">
                  {END_USER_NOTES.map((note) => (
                    <li
                      key={note}
                      className="flex items-start gap-2.5 text-[12.5px] sm:text-[13px] text-text"
                    >
                      <CheckCircle
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <aside
                aria-label="What to expect when the floor blocks the call"
                className="border border-warning/30 bg-warning-dim p-5 min-w-0"
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle
                    className="h-4 w-4 text-warning"
                    aria-hidden="true"
                  />
                  <h3 className="font-display text-[14px] font-semibold text-text-bright">
                    When the floor blocks the call
                  </h3>
                </div>
                <p className="text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
                  If no Surplus offer clears the configured floor, OMA returns
                  HTTP 422 with the following shape. The agent decides what
                  to do next.
                </p>
                <pre
                  className="mt-3 px-3 py-3 text-[11.5px] sm:text-[12px] leading-[1.7] text-text bg-panel border border-border overflow-x-auto whitespace-pre"
                  style={{ overflowWrap: 'normal' }}
                >
{`HTTP/1.1 422 Unprocessable Entity
{
  "error": {
    "code": "discount_floor_violation",
    "message": "No Surplus offer met the configured discount floor.",
    "details": {
      "min_discount_pct": 50,
      "offers_seen": 4,
      "best_offer_pct": 32,
      "best_offer_id": "srf_8x2…"
    }
  }
}`}
                </pre>
              </aside>
            </div>
          </section>

          {/* ===== CTA ===== */}
          <section
            aria-labelledby="cta-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
          >
            <SectionHeading title="Set the floor" meta="The next step" />
            <h2 id="cta-heading" className="sr-only">Set the floor</h2>

            <div className="border border-border bg-surface px-5 sm:px-8 py-8 sm:py-10 relative overflow-hidden">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
              />
              <p className="text-[15px] sm:text-base text-text-bright max-w-2xl leading-relaxed">
                Operators set the floor at <Link href="/admin/fees" className="text-accent underline underline-offset-2 hover:text-accent-hover">/admin/fees</Link>. End users set it in the dashboard, per API key.
              </p>
              <p className="mt-3 text-[12px] sm:text-sm text-text-secondary max-w-xl leading-relaxed">
                Default 50%. Range 0–95%. Effective within 30 seconds. The
                floor applies to the Surplus fallback only — Venice and the
                CheapTokens pool are not affected.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/admin/fees" className="bg-accent text-void hover:bg-accent-hover px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  set operator floor
                </Link>
                <Link href="/dashboard" className="bg-surface text-text border border-border hover:bg-surface-elevated px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  open the dashboard
                </Link>
                <Link
                  href="/compare/venice-ai-alternative"
                  className="text-[11px] sm:text-xs text-text-muted hover:text-text-bright underline underline-offset-4 transition-colors"
                >
                  vs venice alternative <ArrowRight className="inline h-3 w-3 ml-1" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
