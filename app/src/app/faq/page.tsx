import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FAQClient, type FAQGroup } from './FAQClient'
import { MODEL_COUNT } from '@/lib/models-data'

export const metadata: Metadata = {
  title: 'FAQ · OMA',
  description:
    'Common questions about OMA, the wallet-only inference gateway, x402 pay-per-request, USDC on Base, and the data we keep on file.',
}

const GROUPS: FAQGroup[] = [
  {
    idx: '01',
    name: 'Getting started',
    items: [
      {
        iconName: 'HelpCircle',
        q: 'How do I start?',
        a: 'Connect a wallet, sign the SIWE challenge, and the dashboard generates an API key. No email, no password, no account. You can make your first call in under a minute.',
      },
      {
        iconName: 'KeyRound',
        q: 'Do I need an account?',
        a: 'No. Your wallet is your account. Sign in with Ethereum (or Solana), and the dashboard generates an API key automatically. There is no signup form anywhere.',
      },
      {
        iconName: 'Layers',
        q: 'How is OMA different from Venice, CheapTokens, or OpenRouter?',
        a: 'Venice is the model host. CheapTokens is a Venice reseller. OpenRouter is a multi-vendor router. OMA combines a CheapTokens-sourced Venice stack behind a single wallet-only API, with credit metering and x402 settlement on Base.',
      },
      {
        iconName: 'Cpu',
        q: 'Which models can I call?',
        a: `${MODEL_COUNT} models across Venice, AntSeed, OpenRouter, Together, Anthropic, and Google. The live catalog is at GET /v1/models. The price list is at /pricing. Every model is served OpenAI-compatible.`,
      },
    ],
  },
  {
    idx: '02',
    name: 'Billing',
    items: [
      {
        iconName: 'Coins',
        q: 'How much does it cost?',
        a: 'Pay per request. From about $0.0001 per token for the smallest models. The full price list is on the /pricing page. A 25% markup over Venice retail covers the gateway, the metering, and the x402 settlement.',
      },
      {
        iconName: 'Receipt',
        q: 'How does payment work?',
        a: 'You deposit USDC on Base to the OMA deposit address. Credits are issued 1:1 against the dollar value of the transfer. Credits are deducted per token as you use the API.',
      },
      {
        iconName: 'RefreshCw',
        q: 'What is x402?',
        a: 'x402 turns the HTTP 402 Payment Required status into a settlement primitive. When your credit balance runs out, OMA returns 402 with a Pay-Req header. The client signs a USDC transfer on Base and resubmits with a PAYMENT-SIGNATURE header. The request is then settled and forwarded.',
      },
      {
        iconName: 'Zap',
        q: 'What if I run out of credits mid-request?',
        a: 'You get a 402 response with a Pay-Req header. If your client handles 402 (the OMA SDK does), it pays and retries inline. If not, the response tells the client to top up.',
      },
      {
        iconName: 'FileText',
        q: 'What is the refund policy?',
        a: 'Credits are non-redeemable. They cannot be withdrawn for USDC or transferred to another wallet. They expire on a 12-month rolling schedule from the deposit date. If a deposit was made in error within the last 24 hours and the credits have not been used, email billing@oma-ai.com with the transaction hash. We will review case by case.',
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
        a: 'Yes. The base URL is https://api.oma-ai.com/v1. The /v1/chat/completions, /v1/completions, /v1/embeddings, and /v1/images/generations endpoints all match the OpenAI shape. Swap the base URL and keep the rest of your code.',
      },
      {
        iconName: 'Zap',
        q: 'Do you support streaming?',
        a: 'Yes. Server-sent events on /v1/chat/completions. The bytes you receive are the bytes you would get from the upstream provider, repackaged.',
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
        a: 'No. Inference request and response bodies stream in memory only and are released on stream close. We only write a per-call counter (model id, tokens in, tokens out, latency, http status) to the usage log.',
      },
      {
        iconName: 'Lock',
        q: 'What is "private mode"?',
        a: 'Private mode is the default. Every request is forwarded to a single provider (Venice) and never reaches a multi-vendor routing layer. The set of counterparties is small and the data path is verifiable from the source.',
      },
      {
        iconName: 'FileText',
        q: 'Where can I read the full policy?',
        a: 'See the /privacy page. The short version: OMA collects your wallet address, API key hash, per-call counter, and deposit transaction hash. Nothing else.',
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
        a: 'A buyer-side guardrail announced by Surplus on 2026-06-12. OMA sets a minimum discount floor; any Surplus offer below the floor is filtered out before a USDC payment is signed. Default 50%, range 0 to 95%. The floor applies to the operator-internal Surplus buyer and to the optional procurement.min_discount_pct field that an agent can pass on every call.',
      },
      {
        iconName: 'Sliders',
        q: 'How do I set the operator floor?',
        a: 'Open /admin/fees and look for "Surplus Min Discount Routing" at the bottom. The operator floor is the first field; the user-facing default is the second. The user default cannot be set below the operator floor. Changes take effect within 30 seconds.',
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

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: GROUPS.flatMap((g) =>
    g.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  ),
}

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <div className="overflow-x-clip">
        <div className="flex flex-col">

          {/* ===== HERO ===== */}
          <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-10 sm:pb-14">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to home
            </Link>

            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                {TOTAL} answers
              </span>

              <h1
                className="h1-hero text-text-bright mt-6"
                style={{ overflowWrap: 'anywhere', minWidth: 0, textWrap: 'balance' }}
              >
                <span className="block">Questions,</span>
                <span className="block text-accent">answered plain.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed" style={{ textWrap: 'pretty' }}>
                A working reference for builders who want to wire OMA into a
                product. The answers are short on purpose. For the protocol
                spec, the source, and the procurement math, head to the docs.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/docs" className="bg-accent text-void hover:bg-accent-hover px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  <span aria-hidden="true" className="text-text-inverse">›</span>
                  Read the docs
                </Link>
                <Link href="/pricing" className="bg-surface text-text border border-border hover:bg-surface-elevated px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  See pricing
                </Link>
              </div>
            </div>
          </section>

          {/* ===== GROUPS ===== */}
          <FAQClient groups={GROUPS} />

          {/* ===== FUNDING FLOW ===== */}
          <section
            id="funding"
            aria-labelledby="funding-heading"
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20"
          >
            <header className="mb-6 sm:mb-8 max-w-2xl">
              <h2
                id="funding-heading"
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
              >
                How funding works
              </h2>
              <p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
                A USDC transfer on Base moves from your wallet to the OMA
                deposit address, the transfer is matched to your account, and
                the credit ledger is incremented. The whole loop is settled
                before the API responds.
              </p>
            </header>

            <div className="border border-border bg-surface p-4 sm:p-6 max-w-3xl">
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
          </section>

          {/* ===== ASK ===== */}
          <section
            className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20"
          >
            <div className="rounded-2xl border border-accent/30 bg-accent-dim px-6 sm:px-10 py-10 sm:py-14 relative overflow-hidden">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
              />
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright max-w-2xl">
                Still have questions?
              </h2>
              <p className="mt-3 text-[14px] sm:text-base text-text-secondary max-w-2xl leading-relaxed">
                Billing questions go to{' '}
                <a
                  href="mailto:billing@oma-ai.com"
                  className="font-medium text-accent hover:text-accent-hover underline decoration-2 underline-offset-2"
                >
                  billing@oma-ai.com
                </a>
                . Privacy questions go to{' '}
                <a
                  href="mailto:privacy@oma-ai.com"
                  className="font-medium text-accent hover:text-accent-hover underline decoration-2 underline-offset-2"
                >
                  privacy@oma-ai.com
                </a>
                . Everything else goes to{' '}
                <a
                  href="mailto:hello@oma-ai.com"
                  className="font-medium text-accent hover:text-accent-hover underline decoration-2 underline-offset-2"
                >
                  hello@oma-ai.com
                </a>
                . We aim to respond within 14 days.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/docs" className="bg-accent text-void hover:bg-accent-hover px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  Read the docs
                </Link>
                <Link href="/pricing" className="bg-surface text-text border border-border hover:bg-surface-elevated px-5 py-2.5 rounded-2xl font-medium transition-colors">
                  See pricing
                </Link>
                <Link
                  href="/about"
                  className="text-[12.5px] sm:text-[13px] text-text-muted hover:text-text-bright underline underline-offset-4 transition-colors"
                >
                  About OMA →
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
